import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, type DB, type Tx as DbTx } from "@/db";
import { PASS_PERCENT, REVIEW_INTERVALS_DAYS, type MasteryStatus, type SessionType } from "@/lib/constants";

type Tx = DbTx | DB;

const DAY = 24 * 3600 * 1000;

export async function recordStudy(
  tx: Tx,
  userId: string,
  topicIds: string[],
  s: { durationMinutes: number; sessionType: SessionType; confidence: number; studiedOn: string },
) {
  const perTopic = Math.round(s.durationMinutes / topicIds.length);
  const isRevision = s.sessionType.startsWith("revision") ? 1 : 0;
  for (const topicId of topicIds) {
    await tx
      .insert(schema.topicMastery)
      .values({
        userId,
        topicId,
        status: "claimed",
        studyMinutes: perTopic,
        sessionsCount: 1,
        revisionCount: isRevision,
        lastConfidence: s.confidence,
        lastStudiedAt: s.studiedOn,
      })
      .onConflictDoUpdate({
        target: [schema.topicMastery.userId, schema.topicMastery.topicId],
        set: {
          studyMinutes: sql`${schema.topicMastery.studyMinutes} + ${perTopic}`,
          sessionsCount: sql`${schema.topicMastery.sessionsCount} + 1`,
          revisionCount: sql`${schema.topicMastery.revisionCount} + ${isRevision}`,
          lastConfidence: s.confidence,
          lastStudiedAt: sql`greatest(${schema.topicMastery.lastStudiedAt}, ${s.studiedOn}::date)`,
          status: sql`case when ${schema.topicMastery.status} = 'not_started' then 'claimed' else ${schema.topicMastery.status} end`,
        },
      });
  }
}

/** Apply per-topic test results: pass => verified + push next re-test out; fail => weak, re-test tomorrow. */
export async function recordTestResults(tx: Tx, userId: string, perTopic: Map<string, number>, now = new Date()) {
  if (perTopic.size === 0) return;
  const existing = await tx
    .select()
    .from(schema.topicMastery)
    .where(and(eq(schema.topicMastery.userId, userId), inArray(schema.topicMastery.topicId, [...perTopic.keys()])));
  const byId = new Map(existing.map((m) => [m.topicId, m]));

  for (const [topicId, score] of perTopic) {
    const m = byId.get(topicId);
    const passed = score >= PASS_PERCENT;
    const stage = passed ? Math.min((m?.reviewStage ?? 0) + 1, REVIEW_INTERVALS_DAYS.length) : 0;
    const nextReviewAt = new Date(now.getTime() + (passed ? REVIEW_INTERVALS_DAYS[stage - 1] : 1) * DAY);
    const status: MasteryStatus = passed ? "verified" : "weak";
    const values = {
      status,
      testsTaken: (m?.testsTaken ?? 0) + 1,
      lastScore: score,
      bestScore: Math.max(m?.bestScore ?? 0, score),
      lastTestedAt: now,
      reviewStage: stage,
      nextReviewAt,
    };
    if (m) {
      await tx
        .update(schema.topicMastery)
        .set(values)
        .where(and(eq(schema.topicMastery.userId, userId), eq(schema.topicMastery.topicId, topicId)));
    } else {
      await tx.insert(schema.topicMastery).values({ userId, topicId, ...values });
    }
  }
}

export type MasteryRow = typeof schema.topicMastery.$inferSelect;

export function isDue(m: MasteryRow, now = new Date()) {
  return m.status === "verified" && m.nextReviewAt !== null && m.nextReviewAt <= now;
}

export function displayStatus(m: MasteryRow | undefined, now = new Date()): MasteryStatus | "due" {
  if (!m) return "not_started";
  if (isDue(m, now)) return "due";
  return m.status as MasteryStatus;
}

/** High self-confidence but failed the test: the "I think I know it" trap. */
export function isOverconfident(m: MasteryRow) {
  return (m.lastConfidence ?? 0) >= 4 && m.lastScore !== null && m.lastScore < 60;
}

export function isUnderconfident(m: MasteryRow) {
  return (m.lastConfidence ?? 5) <= 2 && m.lastScore !== null && m.lastScore >= 80;
}
