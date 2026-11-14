import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/session";
import { getQuiz } from "@/lib/data";
import { getTopic } from "@/syllabus";
import { QuizForm } from "@/components/QuizForm";
import { PASS_PERCENT } from "@/lib/constants";

export const maxDuration = 60;

function topicLabel(id: string) {
  const r = getTopic(id);
  return r ? `${r.paper.code} · ${r.topic.name}` : id;
}

export default async function QuizPage({ params }: PageProps<"/quiz/[id]">) {
  const { id } = await params;
  const user = await requireStudent();
  const quiz = await getQuiz(user.id, id);
  if (!quiz) notFound();

  const heading = quiz.kind === "instant" ? "Understanding check" : "Spaced re-test";
  const topics = quiz.topicIds.map(topicLabel);

  if (quiz.status !== "submitted") {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-semibold">{heading}</h1>
        <p className="mb-1 text-sm text-muted">{topics.join(" · ")}</p>
        <p className="mb-6 text-sm text-muted">
          Close the book. Score {PASS_PERCENT}%+ on a topic to mark it <b>Understood</b>.
        </p>
        <QuizForm
          quizId={quiz.id}
          questions={quiz.questions.map((q) => ({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            unit: q.unit,
            marks: q.marks,
            topicLabel: topicLabel(q.topicId),
            savedAnswer: q.studentAnswer,
            savedSkip: q.flagged,
          }))}
        />
      </div>
    );
  }

  const score = quiz.scorePercent ?? 0;
  const passed = score >= PASS_PERCENT;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">{heading}: results</h1>
        <p className="text-sm text-muted">{topics.join(" · ")}</p>
      </div>
      <div className={`card flex items-center gap-4 ${passed ? "border-emerald-400" : "border-red-400"}`}>
        <div className={`text-4xl font-semibold ${passed ? "text-emerald-600" : "text-red-600"}`}>{Math.round(score)}%</div>
        <div className="text-sm">
          {passed
            ? "Good. These topics are marked Understood, and a re-test is scheduled so you don't forget them."
            : "Not there yet. These topics are marked Weak. Re-study the explanations below, then re-test from the Syllabus page."}
        </div>
      </div>
      {quiz.questions.map((q, i) => {
        const ok = q.awardedMarks !== null && q.awardedMarks >= q.marks;
        const partial = !ok && (q.awardedMarks ?? 0) > 0;
        return (
          <div key={q.id} className="card space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-medium text-foreground">Q{i + 1}</span>
              <span>{topicLabel(q.topicId)}</span>
              <span className={`ml-auto pill ${q.flagged ? "bg-zinc-200 dark:bg-zinc-800" : ok ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" : partial ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200"}`}>
                {q.flagged ? "Not counted" : `${q.awardedMarks ?? 0}/${q.marks}`}
              </span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{q.prompt}</p>
            {q.type === "mcq" && q.options && (
              <ul className="space-y-1">
                {q.options.map((o, oi) => {
                  const chosen = q.studentAnswer === String(oi);
                  const correct = q.correctIndex === oi;
                  return (
                    <li key={oi} className={`rounded-lg border p-2 ${correct ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : chosen ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-border"}`}>
                      <b>{String.fromCharCode(65 + oi)}.</b> {o} {correct && "✓"} {chosen && !correct && "(your answer)"}
                    </li>
                  );
                })}
              </ul>
            )}
            {q.type !== "mcq" && (
              <div className="rounded-lg bg-background p-3">
                <div className="mb-1 text-xs font-medium text-muted">Your answer</div>
                <p className="whitespace-pre-wrap">{q.studentAnswer || "(blank)"}{q.type === "numeric" && q.unit ? ` ${q.unit}` : ""}</p>
              </div>
            )}
            {q.type === "numeric" && (
              <p><b>Correct answer:</b> {q.numericAnswer?.toLocaleString("en-IN")} {q.unit}</p>
            )}
            {q.feedback && <p><b>Examiner feedback:</b> {q.feedback}</p>}
            <details className="rounded-lg border border-border p-3" open={!ok}>
              <summary className="cursor-pointer font-medium">{q.type === "numeric" ? "Worked solution" : q.type === "short" ? "Model answer" : "Explanation"}</summary>
              <div className="mt-2 space-y-2 whitespace-pre-wrap leading-relaxed">
                {q.type !== "mcq" && q.modelAnswer && <p>{q.modelAnswer}</p>}
                {q.rubric && q.rubric.length > 0 && (
                  <ul className="list-disc pl-5">{q.rubric.map((r, ri) => <li key={ri}>{r}</li>)}</ul>
                )}
                {q.explanation && <p className="text-muted">{q.explanation}</p>}
              </div>
            </details>
          </div>
        );
      })}
      <div className="flex gap-3">
        <Link href="/dashboard" className="btn">Back to dashboard</Link>
        <Link href="/log" className="btn-secondary">Log another session</Link>
      </div>
      <p className="text-xs text-muted">Questions generated by {quiz.provider}. AI can make mistakes: if an answer key looks wrong, check it against the study material.</p>
    </div>
  );
}
