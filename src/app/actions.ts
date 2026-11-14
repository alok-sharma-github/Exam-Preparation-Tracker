"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { createSession, destroySession, requireStudent, requireUser } from "@/lib/session";
import { recordStudy } from "@/lib/mastery";
import { createInstantQuiz, createRetestQuiz, submitQuiz } from "@/lib/quiz/service";
import { SESSION_TYPES, SOURCES } from "@/lib/constants";
import { getTopic } from "@/syllabus";

export type FormState = { error?: string } | undefined;

function isRedirect(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

// ---------- Auth ----------

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = credentials
    .extend({ name: z.string().trim().min(1, "Enter your name").max(80) })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email));
  if (existing) return { error: "An account with this email already exists. Log in instead." };
  const [user] = await db
    .insert(schema.users)
    .values({ email: parsed.data.email, name: parsed.data.name, passwordHash: await bcrypt.hash(parsed.data.password, 10) })
    .returning({ id: schema.users.id });
  await createSession(user.id);
  redirect("/onboarding");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Invalid email or password" };
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email));
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------- Profile / onboarding ----------

const profileSchema = z.object({
  level: z.enum(["foundation", "intermediate", "final"]),
  group: z.enum(["group1", "group2", "both"]),
  attemptMonth: z.coerce.number().int().refine((m) => [1, 5, 9].includes(m), "Pick an attempt month"),
  attemptYear: z.coerce.number().int().min(2025).max(2035),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dailyTargetHours: z.coerce.number().min(1).max(16),
});

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;
  const values = {
    level: p.level,
    group: p.group,
    attemptMonth: p.attemptMonth,
    attemptYear: p.attemptYear,
    examDate: p.examDate || null,
    dailyTargetMinutes: Math.round(p.dailyTargetHours * 60),
    updatedAt: new Date(),
  };
  const db = await getDb();
  await db
    .insert(schema.profiles)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: schema.profiles.userId, set: values });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ---------- Study sessions ----------

const sessionSchema = z.object({
  studiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  sessionType: z.enum(Object.keys(SESSION_TYPES) as [keyof typeof SESSION_TYPES, ...(keyof typeof SESSION_TYPES)[]]),
  source: z.enum(SOURCES),
  itemsCovered: z.string().trim().max(500).default(""),
  durationMinutes: z.coerce.number().int().min(5, "Duration must be at least 5 minutes").max(900),
  practiceAttempted: z.coerce.number().int().min(0).max(500).optional(),
  practiceCorrect: z.coerce.number().int().min(0).max(500).optional(),
  summary: z.string().trim().min(40, "Write at least 2-3 sentences in your own words (40+ characters). This is what proves understanding."),
  confidence: z.coerce.number().int().min(1).max(5),
  doubts: z.string().trim().max(2000).default(""),
});

const emptyToUndefined = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : v);

export async function logStudySession(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStudent();
  const topicIds = [...new Set(fd.getAll("topicIds").map(String))].filter((id) => getTopic(id));
  if (topicIds.length === 0) return { error: "Select at least one topic you studied." };
  if (topicIds.length > 8) return { error: "Select at most 8 topics per session. Log separate sessions for more." };

  const parsed = sessionSchema.safeParse({
    studiedOn: fd.get("studiedOn"),
    sessionType: fd.get("sessionType"),
    source: fd.get("source"),
    itemsCovered: fd.get("itemsCovered") ?? "",
    durationMinutes: fd.get("durationMinutes"),
    practiceAttempted: emptyToUndefined(fd.get("practiceAttempted")),
    practiceCorrect: emptyToUndefined(fd.get("practiceCorrect")),
    summary: fd.get("summary"),
    confidence: fd.get("confidence"),
    doubts: fd.get("doubts") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = parsed.data;
  if (s.practiceCorrect !== undefined && (s.practiceAttempted === undefined || s.practiceCorrect > s.practiceAttempted)) {
    return { error: "Questions correct cannot exceed questions attempted." };
  }

  const db = await getDb();
  const sessionId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.studySessions)
      .values({ userId: user.id, ...s, practiceAttempted: s.practiceAttempted ?? null, practiceCorrect: s.practiceCorrect ?? null })
      .returning({ id: schema.studySessions.id });
    await tx.insert(schema.sessionTopics).values(topicIds.map((topicId) => ({ sessionId: row.id, topicId })));
    if (s.doubts) await tx.insert(schema.doubts).values({ userId: user.id, sessionId: row.id, text: s.doubts });
    await recordStudy(tx, user.id, topicIds, s);
    return row.id;
  });

  let quizId: string;
  try {
    quizId = await createInstantQuiz(user.id, user.profile, sessionId);
  } catch (e) {
    console.error("[logStudySession] quiz generation failed", e);
    redirect(`/sessions/${sessionId}?quizError=1`);
  }
  revalidatePath("/dashboard");
  redirect(`/quiz/${quizId}`);
}

export async function retryInstantQuiz(sessionId: string): Promise<FormState> {
  const user = await requireStudent();
  try {
    const quizId = await createInstantQuiz(user.id, user.profile, sessionId);
    redirect(`/quiz/${quizId}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: (e as Error).message };
  }
}

export async function startRetest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStudent();
  const topicIds = [...new Set(fd.getAll("topicIds").map(String))].filter((id) => getTopic(id)).slice(0, 6);
  if (topicIds.length === 0) return { error: "Pick at least one topic." };
  try {
    const quizId = await createRetestQuiz(user.id, user.profile, topicIds);
    redirect(`/quiz/${quizId}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: (e as Error).message };
  }
}

export async function submitQuizAction(quizId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStudent();
  const answers = new Map<string, string>();
  const skipped = new Set<string>();
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("a:")) answers.set(k.slice(2), String(v));
    if (k.startsWith("skip:")) skipped.add(k.slice(5));
  }
  try {
    await submitQuiz(user.id, quizId, answers, skipped);
  } catch (e) {
    return { error: `Grading failed: ${(e as Error).message}. Your answers are saved; try submitting again.` };
  }
  revalidatePath(`/quiz/${quizId}`);
  revalidatePath("/dashboard");
  redirect(`/quiz/${quizId}`);
}

export async function resolveDoubt(doubtId: string) {
  const user = await requireStudent();
  const db = await getDb();
  await db
    .update(schema.doubts)
    .set({ resolved: true })
    .where(and(eq(schema.doubts.id, doubtId), eq(schema.doubts.userId, user.id)));
  revalidatePath("/dashboard");
}
