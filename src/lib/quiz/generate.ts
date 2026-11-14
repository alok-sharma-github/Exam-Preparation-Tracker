import "server-only";
import { z } from "zod";
import { generateJson, type ProviderName } from "@/lib/ai";
import { getTopic, type TopicRef } from "@/syllabus";
import { SESSION_TYPES, type SessionType } from "@/lib/constants";

const questionSchema = z.object({
  topicId: z.string().describe("One of the topic ids provided"),
  type: z.enum(["mcq", "numeric", "short"]),
  prompt: z.string().describe("The full question, including any case facts / figures"),
  options: z.array(z.string()).describe("Exactly 4 options for mcq; empty array otherwise"),
  correctIndex: z.number().int().describe("0-3 for mcq; -1 otherwise"),
  numericAnswer: z.number().describe("Final numeric answer for numeric questions; 0 otherwise"),
  tolerancePercent: z.number().describe("Accepted relative error for numeric answers, e.g. 1"),
  unit: z.string().describe("Unit of the numeric answer, e.g. '₹', 'units', '%', 'times'; empty otherwise"),
  modelAnswer: z.string().describe("Model answer (short) or worked solution (numeric)"),
  rubric: z.array(z.string()).describe("Marking points for short questions; empty otherwise"),
  explanation: z.string().describe("Why the answer is right and the misconception each wrong option targets"),
  marks: z.number().int(),
});

const quizSchema = z.object({
  summaryReview: z.object({
    score: z.number().int().min(0).max(10).describe("Accuracy and depth of the student's own-words summary"),
    feedback: z.string().describe("2-4 sentences: what is right, what is wrong or missing"),
  }),
  questions: z.array(questionSchema),
});

export type GeneratedQuestion = z.infer<typeof questionSchema>;

export interface SessionContext {
  sessionType: SessionType;
  source: string;
  itemsCovered: string;
  summary: string;
  doubts: string;
  confidence: number;
}

export interface QuizRequest {
  topicIds: string[];
  attemptLabel: string; // e.g. "CA Intermediate Group II, January 2027"
  session?: SessionContext; // instant check after logging
  previousSummaries?: string[]; // for re-tests
  weakNotes?: string[]; // wrong answers from earlier attempts on these topics
}

function questionPlan(refs: TopicRef[], isRetest: boolean) {
  const numerical = refs.filter((r) => r.paper.style === "numerical").length >= refs.length / 2;
  const total = isRetest ? 6 : 5;
  if (numerical) return { total, mix: isRetest ? "2 mcq, 3 numeric, 1 short" : "2 mcq, 2 numeric, 1 short" };
  return { total, mix: isRetest ? "3 mcq, 3 short" : "3 mcq, 2 short" };
}

const SYSTEM = `You are an experienced ICAI faculty member and examiner for the Chartered Accountancy course in India.
You write tests that reveal whether a student has genuinely UNDERSTOOD a topic, not whether they can recall a definition.
Rules:
- Follow the ICAI study material, current Standards on Auditing, Companies Act 2013, CAS and the ICAI new scheme exam style.
- Use Indian context and ₹. Case-scenario style like ICAI MCQs: short facts, then a question, with four plausible options where each wrong option reflects a real misconception.
- Numeric questions: model them on ICAI illustrations but with different figures. Solve step by step in modelAnswer and DOUBLE-CHECK the arithmetic; numericAnswer must equal the final figure of your solution. Ask for exactly one final figure and state rounding (e.g. "round to 2 decimals").
- Short questions: ICAI-style "comment / advise / analyse" on a mini case; give 3-5 rubric points that an examiner would award marks for, quoting the relevant SA / section / framework.
- Marks: mcq = 2, numeric = 4, short = 4.
- If the student's own summary contains errors or gaps, target at least one question at them.
- Never reveal the answer in the prompt text.`;

export async function generateQuiz(req: QuizRequest): Promise<{ questions: GeneratedQuestion[]; summaryReview: { score: number; feedback: string } | null; provider: ProviderName }> {
  const refs = req.topicIds.map(getTopic).filter((r): r is TopicRef => Boolean(r));
  if (refs.length === 0) throw new Error("No valid topics selected");
  const plan = questionPlan(refs, !req.session);
  const papers = [...new Map(refs.map((r) => [r.paper.id, r.paper])).values()];

  const lines: string[] = [];
  lines.push(`Student: ${req.attemptLabel}.`);
  for (const p of papers) lines.push(`Paper ${p.code} ${p.name} (${p.marks} marks). Exam style: ${p.examHint}`);
  lines.push("", "Topics to test (use these exact topicId values):");
  for (const r of refs) lines.push(`- topicId "${r.topic.id}": ${r.chapter.name} → ${r.topic.name}`);

  if (req.session) {
    const s = req.session;
    lines.push(
      "",
      "The student just logged this study session:",
      `- Session type: ${SESSION_TYPES[s.sessionType]}`,
      `- Source: ${s.source}`,
      `- Items covered: ${s.itemsCovered || "(not specified)"}`,
      `- Self-rated confidence: ${s.confidence}/5`,
      `- Doubts: ${s.doubts || "(none)"}`,
      `- Student's own-words summary: """${s.summary}"""`,
      "",
      "Review the summary (summaryReview) for accuracy and depth, then write the test.",
    );
  } else {
    lines.push("", "This is a spaced re-test some days after the student studied these topics. Test retention and application, mixing in a different angle than a first test would.");
    if (req.previousSummaries?.length) lines.push(`Student's earlier summaries: ${req.previousSummaries.map((s) => `"""${s}"""`).join(" ")}`);
    if (req.weakNotes?.length) lines.push(`Areas the student got wrong before: ${req.weakNotes.join("; ")}`);
    lines.push('For summaryReview return score 0 and feedback "" (no summary in a re-test).');
  }
  lines.push("", `Write exactly ${plan.total} questions: ${plan.mix}. Spread them across the topics.`);

  const { data, provider } = await generateJson({
    system: SYSTEM,
    prompt: lines.join("\n"),
    schema: quizSchema,
    temperature: 0.5,
    mock: () => mockQuiz(refs, plan.total),
  });

  const allowed = new Set(refs.map((r) => r.topic.id));
  const questions = data.questions
    .map((q) => ({ ...q, topicId: allowed.has(q.topicId) ? q.topicId : refs[0].topic.id }))
    .filter(isUsable);
  if (questions.length < 3) throw new Error(`AI (${provider}) produced too few usable questions; please retry.`);
  return {
    questions,
    summaryReview: req.session ? data.summaryReview : null,
    provider,
  };
}

function isUsable(q: GeneratedQuestion): boolean {
  if (!q.prompt.trim()) return false;
  if (q.type === "mcq") return q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4;
  if (q.type === "numeric") return Number.isFinite(q.numericAnswer);
  return q.modelAnswer.trim().length > 0;
}

function mockQuiz(refs: TopicRef[], total: number): z.infer<typeof quizSchema> {
  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < total; i++) {
    const r = refs[i % refs.length];
    const type = (["mcq", "numeric", "short"] as const)[i % 3];
    questions.push({
      topicId: r.topic.id,
      type,
      prompt: `[Mock ${type}] Question ${i + 1} on "${r.topic.name}" (${r.paper.code}).` + (type === "numeric" ? " What is 1200 × 1.5?" : ""),
      options: type === "mcq" ? ["Option A (correct)", "Option B", "Option C", "Option D"] : [],
      correctIndex: type === "mcq" ? 0 : -1,
      numericAnswer: type === "numeric" ? 1800 : 0,
      tolerancePercent: 1,
      unit: type === "numeric" ? "₹" : "",
      modelAnswer: type === "short" ? "A model answer mentioning the key concept." : "1200 × 1.5 = 1800",
      rubric: type === "short" ? ["Identifies the concept", "Applies it to the facts", "Concludes"] : [],
      explanation: "Mock explanation.",
      marks: type === "mcq" ? 2 : 4,
    });
  }
  return { summaryReview: { score: 6, feedback: "Mock review: mostly correct, add an example." }, questions };
}
