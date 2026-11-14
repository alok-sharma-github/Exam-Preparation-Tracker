import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema, type Tx } from "@/db";
import { generateQuiz, type SessionContext } from "./generate";
import { gradeNumeric, gradeShortAnswers } from "./grade";
import { recordTestResults } from "@/lib/mastery";
import { ATTEMPT_MONTHS } from "@/lib/constants";
import { GROUP_LABELS, LEVEL_LABELS, type CaGroup, type CaLevel } from "@/syllabus";
import type { Profile } from "@/lib/session";

export function attemptLabel(p: Profile) {
  return `${LEVEL_LABELS[p.level as CaLevel]} ${GROUP_LABELS[p.group as CaGroup]}, ${ATTEMPT_MONTHS[p.attemptMonth] ?? p.attemptMonth} ${p.attemptYear} attempt`;
}

export async function createInstantQuiz(userId: string, profile: Profile, sessionId: string) {
  const db = await getDb();
  const [session] = await db
    .select()
    .from(schema.studySessions)
    .where(and(eq(schema.studySessions.id, sessionId), eq(schema.studySessions.userId, userId)));
  if (!session) throw new Error("Session not found");
  const topicIds = (
    await db.select().from(schema.sessionTopics).where(eq(schema.sessionTopics.sessionId, sessionId))
  ).map((t) => t.topicId);

  const ctx: SessionContext = {
    sessionType: session.sessionType as SessionContext["sessionType"],
    source: session.source,
    itemsCovered: session.itemsCovered,
    summary: session.summary,
    doubts: session.doubts,
    confidence: session.confidence,
  };
  const gen = await generateQuiz({ topicIds, attemptLabel: attemptLabel(profile), session: ctx });

  return db.transaction(async (tx) => {
    if (gen.summaryReview) {
      await tx
        .update(schema.studySessions)
        .set({ summaryScore: gen.summaryReview.score, summaryFeedback: gen.summaryReview.feedback })
        .where(eq(schema.studySessions.id, sessionId));
    }
    const [quiz] = await tx
      .insert(schema.quizzes)
      .values({ userId, sessionId, kind: "instant", topicIds, provider: gen.provider })
      .returning({ id: schema.quizzes.id });
    await insertQuestions(tx, quiz.id, gen.questions);
    return quiz.id;
  });
}

export async function createRetestQuiz(userId: string, profile: Profile, topicIds: string[]) {
  const db = await getDb();
  const recentSessions = await db
    .select({ summary: schema.studySessions.summary })
    .from(schema.studySessions)
    .innerJoin(schema.sessionTopics, eq(schema.sessionTopics.sessionId, schema.studySessions.id))
    .where(and(eq(schema.studySessions.userId, userId), inArray(schema.sessionTopics.topicId, topicIds)))
    .orderBy(desc(schema.studySessions.createdAt))
    .limit(3);
  const wrong = await db
    .select({ prompt: schema.questions.prompt })
    .from(schema.questions)
    .innerJoin(schema.quizzes, eq(schema.quizzes.id, schema.questions.quizId))
    .where(and(eq(schema.quizzes.userId, userId), inArray(schema.questions.topicId, topicIds), eq(schema.questions.awardedMarks, 0)))
    .orderBy(desc(schema.quizzes.createdAt))
    .limit(5);

  const gen = await generateQuiz({
    topicIds,
    attemptLabel: attemptLabel(profile),
    previousSummaries: recentSessions.map((s) => s.summary),
    weakNotes: wrong.map((w) => w.prompt.slice(0, 160)),
  });
  return db.transaction(async (tx) => {
    const [quiz] = await tx
      .insert(schema.quizzes)
      .values({ userId, kind: "retest", topicIds, provider: gen.provider })
      .returning({ id: schema.quizzes.id });
    await insertQuestions(tx, quiz.id, gen.questions);
    return quiz.id;
  });
}

async function insertQuestions(
  tx: Tx,
  quizId: string,
  qs: Awaited<ReturnType<typeof generateQuiz>>["questions"],
) {
  await tx.insert(schema.questions).values(
    qs.map((q, i) => ({
      quizId,
      position: i,
      topicId: q.topicId,
      type: q.type,
      prompt: q.prompt,
      options: q.type === "mcq" ? q.options : null,
      correctIndex: q.type === "mcq" ? q.correctIndex : null,
      numericAnswer: q.type === "numeric" ? q.numericAnswer : null,
      tolerancePercent: q.type === "numeric" ? q.tolerancePercent || 1 : null,
      unit: q.unit || null,
      modelAnswer: q.modelAnswer,
      rubric: q.type === "short" ? q.rubric : null,
      explanation: q.explanation,
      marks: q.marks > 0 ? q.marks : q.type === "mcq" ? 2 : 4,
    })),
  );
}

/**
 * Saves answers first (so nothing is lost if AI grading fails), then grades:
 * MCQ and numeric deterministically, short answers via AI. Updates topic mastery.
 */
export async function submitQuiz(userId: string, quizId: string, answers: Map<string, string>, skipped: Set<string>) {
  const db = await getDb();
  const [quiz] = await db
    .select()
    .from(schema.quizzes)
    .where(and(eq(schema.quizzes.id, quizId), eq(schema.quizzes.userId, userId)));
  if (!quiz) throw new Error("Quiz not found");
  if (quiz.status === "submitted") return;

  const qs = await db.select().from(schema.questions).where(eq(schema.questions.quizId, quizId));
  for (const q of qs) {
    await db
      .update(schema.questions)
      .set({ studentAnswer: answers.get(q.id) ?? "", flagged: skipped.has(q.id) })
      .where(eq(schema.questions.id, q.id));
  }

  const shortGrades = await gradeShortAnswers(
    qs
      .filter((q) => q.type === "short" && !skipped.has(q.id))
      .map((q) => ({
        id: q.id,
        prompt: q.prompt,
        modelAnswer: q.modelAnswer,
        rubric: q.rubric ?? [],
        marks: q.marks,
        studentAnswer: answers.get(q.id) ?? "",
      })),
  );

  const topicTotals = new Map<string, { got: number; max: number }>();
  let got = 0;
  let max = 0;
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const q of qs) {
      if (skipped.has(q.id)) continue;
      const answer = answers.get(q.id) ?? "";
      let awarded = 0;
      let feedback: string | null = null;
      if (q.type === "mcq") awarded = answer !== "" && Number(answer) === q.correctIndex ? q.marks : 0;
      else if (q.type === "numeric") awarded = gradeNumeric(answer, q.numericAnswer ?? NaN, q.tolerancePercent) ? q.marks : 0;
      else {
        const g = shortGrades.get(q.id);
        awarded = g?.awardedMarks ?? 0;
        feedback = g?.feedback ?? null;
      }
      await tx.update(schema.questions).set({ awardedMarks: awarded, feedback }).where(eq(schema.questions.id, q.id));
      got += awarded;
      max += q.marks;
      const t = topicTotals.get(q.topicId) ?? { got: 0, max: 0 };
      t.got += awarded;
      t.max += q.marks;
      topicTotals.set(q.topicId, t);
    }
    const scorePercent = max > 0 ? Math.round((got / max) * 1000) / 10 : null;
    await tx
      .update(schema.quizzes)
      .set({ status: "submitted", submittedAt: now, scorePercent })
      .where(eq(schema.quizzes.id, quizId));
    const perTopic = new Map([...topicTotals].map(([id, t]) => [id, Math.round((t.got / t.max) * 1000) / 10]));
    await recordTestResults(tx, userId, perTopic, now);
  });
}
