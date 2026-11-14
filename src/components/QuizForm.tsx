"use client";

import { useActionState } from "react";
import { submitQuizAction } from "@/app/actions";

export interface QuizQuestionView {
  id: string;
  type: string;
  prompt: string;
  options: string[] | null;
  unit: string | null;
  marks: number;
  topicLabel: string;
  savedAnswer: string | null;
  savedSkip: boolean;
}

export function QuizForm({ quizId, questions }: { quizId: string; questions: QuizQuestionView[] }) {
  const [state, action, pending] = useActionState(submitQuizAction.bind(null, quizId), undefined);
  return (
    <form action={action} className="space-y-4">
      {questions.map((q, i) => (
        <fieldset key={q.id} className="card space-y-3">
          <legend className="sr-only">Question {i + 1}</legend>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-medium text-foreground">Q{i + 1}</span>
            <span>{q.topicLabel}</span>
            <span className="ml-auto">{q.marks} marks · {q.type === "mcq" ? "MCQ" : q.type === "numeric" ? "Numerical" : "Descriptive"}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{q.prompt}</p>
          {q.type === "mcq" && q.options && (
            <div className="space-y-1.5">
              {q.options.map((o, oi) => (
                <label key={oi} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-background has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                  <input type="radio" name={`a:${q.id}`} value={oi} defaultChecked={q.savedAnswer === String(oi)} className="mt-0.5" />
                  <span><b>{String.fromCharCode(65 + oi)}.</b> {o}</span>
                </label>
              ))}
            </div>
          )}
          {q.type === "numeric" && (
            <div className="flex items-center gap-2">
              <input className="input max-w-56" name={`a:${q.id}`} inputMode="decimal" placeholder="Final answer" defaultValue={q.savedAnswer ?? ""} autoComplete="off" />
              {q.unit && <span className="text-sm text-muted">{q.unit}</span>}
            </div>
          )}
          {q.type === "short" && (
            <textarea className="input min-h-36" name={`a:${q.id}`} defaultValue={q.savedAnswer ?? ""} placeholder="Answer as you would in the exam: provision / concept → application to the facts → conclusion." />
          )}
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name={`skip:${q.id}`} defaultChecked={q.savedSkip} />
            This question looks wrong or out of syllabus. Don&apos;t count it.
          </label>
        </fieldset>
      ))}
      {state?.error && <p className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Marking your answers…" : "Submit answers"}</button>
    </form>
  );
}
