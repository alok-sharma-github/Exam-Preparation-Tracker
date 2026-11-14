import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MasteryRow } from "@/lib/mastery";

export async function getMasteryMap(userId: string): Promise<Map<string, MasteryRow>> {
  const db = await getDb();
  const rows = await db.select().from(schema.topicMastery).where(eq(schema.topicMastery.userId, userId));
  return new Map(rows.map((r) => [r.topicId, r]));
}

export async function getSessions(userId: string, limit = 50) {
  const db = await getDb();
  const sessions = await db
    .select()
    .from(schema.studySessions)
    .where(eq(schema.studySessions.userId, userId))
    .orderBy(desc(schema.studySessions.studiedOn), desc(schema.studySessions.createdAt))
    .limit(limit);
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const topics = await db.select().from(schema.sessionTopics).where(inArray(schema.sessionTopics.sessionId, ids));
  const quizzes = await db
    .select({ id: schema.quizzes.id, sessionId: schema.quizzes.sessionId, status: schema.quizzes.status, scorePercent: schema.quizzes.scorePercent })
    .from(schema.quizzes)
    .where(inArray(schema.quizzes.sessionId, ids))
    .orderBy(desc(schema.quizzes.createdAt));
  return sessions.map((s) => ({
    ...s,
    topicIds: topics.filter((t) => t.sessionId === s.id).map((t) => t.topicId),
    quiz: quizzes.find((q) => q.sessionId === s.id) ?? null,
  }));
}

export async function getSession(userId: string, sessionId: string) {
  const db = await getDb();
  const [s] = await db
    .select()
    .from(schema.studySessions)
    .where(and(eq(schema.studySessions.id, sessionId), eq(schema.studySessions.userId, userId)));
  if (!s) return null;
  const topics = await db.select().from(schema.sessionTopics).where(eq(schema.sessionTopics.sessionId, sessionId));
  const quizzes = await db
    .select()
    .from(schema.quizzes)
    .where(eq(schema.quizzes.sessionId, sessionId))
    .orderBy(desc(schema.quizzes.createdAt));
  return { ...s, topicIds: topics.map((t) => t.topicId), quizzes };
}

/** Minutes studied per day for the last `days` days (YYYY-MM-DD → minutes). */
export async function getDailyMinutes(userId: string, days: number) {
  const db = await getDb();
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const rows = await db
    .select({ day: schema.studySessions.studiedOn, minutes: sql<number>`sum(${schema.studySessions.durationMinutes})::int` })
    .from(schema.studySessions)
    .where(and(eq(schema.studySessions.userId, userId), gte(schema.studySessions.studiedOn, since)))
    .groupBy(schema.studySessions.studiedOn);
  return new Map(rows.map((r) => [String(r.day), Number(r.minutes)]));
}

export async function getOpenDoubts(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.doubts)
    .where(and(eq(schema.doubts.userId, userId), eq(schema.doubts.resolved, false)))
    .orderBy(desc(schema.doubts.createdAt))
    .limit(10);
}

export async function getPendingQuizzes(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.quizzes)
    .where(and(eq(schema.quizzes.userId, userId), eq(schema.quizzes.status, "ready")))
    .orderBy(desc(schema.quizzes.createdAt))
    .limit(5);
}

export async function getQuiz(userId: string, quizId: string) {
  const db = await getDb();
  const [quiz] = await db
    .select()
    .from(schema.quizzes)
    .where(and(eq(schema.quizzes.id, quizId), eq(schema.quizzes.userId, userId)));
  if (!quiz) return null;
  const questions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.quizId, quizId))
    .orderBy(schema.questions.position);
  return { ...quiz, questions };
}
