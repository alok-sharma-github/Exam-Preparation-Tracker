import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai";

export { gradeNumeric, parseNumber } from "./numeric";

export interface ShortAnswerInput {
  id: string;
  prompt: string;
  modelAnswer: string;
  rubric: string[];
  marks: number;
  studentAnswer: string;
}

const gradeSchema = z.object({
  grades: z.array(
    z.object({
      id: z.string(),
      awardedMarks: z.number().describe("Marks awarded, can be in steps of 0.5"),
      feedback: z.string().describe("1-3 sentences: which rubric points were met and what was missing or wrong"),
    }),
  ),
});

const SYSTEM = `You are a strict but fair ICAI examiner marking CA Intermediate answers.
Award marks only for rubric points that are clearly and correctly made in the student's answer; vague or generic statements earn nothing.
Quoting the right Standard / section / framework and applying it to the facts matters. Do not reward length.
Return one grade per answer id.`;

export async function gradeShortAnswers(items: ShortAnswerInput[]) {
  const toGrade = items.filter((i) => i.studentAnswer.trim().length > 0);
  const result = new Map<string, { awardedMarks: number; feedback: string }>();
  for (const i of items) {
    if (!i.studentAnswer.trim()) result.set(i.id, { awardedMarks: 0, feedback: "Not answered." });
  }
  if (toGrade.length === 0) return result;

  const prompt = toGrade
    .map(
      (i) =>
        `### Answer id: ${i.id} (max ${i.marks} marks)\nQuestion: ${i.prompt}\nModel answer: ${i.modelAnswer}\nRubric: ${i.rubric.map((r, n) => `(${n + 1}) ${r}`).join(" ")}\nStudent answer: """${i.studentAnswer}"""`,
    )
    .join("\n\n");

  const { data } = await generateJson({
    system: SYSTEM,
    prompt,
    schema: gradeSchema,
    temperature: 0.1,
    mock: () => ({
      grades: toGrade.map((i) => ({
        id: i.id,
        awardedMarks: Math.min(i.marks, Math.round((i.studentAnswer.length / 60) * 2) / 2),
        feedback: "Mock grading based on answer length.",
      })),
    }),
  });

  for (const i of toGrade) {
    const g = data.grades.find((x) => x.id === i.id);
    result.set(i.id, {
      awardedMarks: g ? Math.max(0, Math.min(i.marks, g.awardedMarks)) : 0,
      feedback: g?.feedback ?? "Could not be graded automatically.",
    });
  }
  return result;
}
