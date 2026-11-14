import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/session";
import { getSession } from "@/lib/data";
import { formatDate, hours } from "@/lib/dates";
import { SESSION_TYPES, type SessionType } from "@/lib/constants";
import { getTopic } from "@/syllabus";
import { RetryQuizButton } from "@/components/RetryQuizButton";

export const maxDuration = 60;

export default async function SessionPage({ params, searchParams }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const { quizError } = await searchParams;
  const user = await requireStudent();
  const s = await getSession(user.id, id);
  if (!s) notFound();
  const done = s.quizzes.find((q) => q.status === "submitted");
  const open = s.quizzes.find((q) => q.status === "ready");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/sessions" className="text-sm text-muted hover:text-foreground">← History</Link>
        <h1 className="mt-1 text-2xl font-semibold">Session on {formatDate(s.studiedOn)}</h1>
        <p className="text-sm text-muted">
          {SESSION_TYPES[s.sessionType as SessionType]} · {hours(s.durationMinutes)} · {s.source}
        </p>
      </div>

      {quizError && !done && !open && (
        <div className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          Your session was saved, but the AI couldn&apos;t write the understanding check just now. Try again:
        </div>
      )}

      <div className="card space-y-3 text-sm">
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Topics</div>
          <ul className="list-disc pl-5">
            {s.topicIds.map((t) => { const r = getTopic(t); return <li key={t}>{r ? `${r.paper.code} · ${r.chapter.name} → ${r.topic.name}` : t}</li>; })}
          </ul>
        </div>
        {s.itemsCovered && <p><b>Covered:</b> {s.itemsCovered}</p>}
        {s.practiceAttempted !== null && <p><b>Practice:</b> {s.practiceCorrect ?? "?"}/{s.practiceAttempted} correct</p>}
        <p><b>Confidence:</b> {s.confidence}/5</p>
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Own-words summary</div>
          <p className="whitespace-pre-wrap">{s.summary}</p>
        </div>
        {s.summaryScore !== null && (
          <div className="rounded-lg bg-background p-3">
            <b>AI review of summary: {s.summaryScore}/10.</b> {s.summaryFeedback}
          </div>
        )}
        {s.doubts && <p><b>Doubts:</b> {s.doubts}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        {done && <Link href={`/quiz/${done.id}`} className="btn-secondary">View check result ({Math.round(done.scorePercent ?? 0)}%)</Link>}
        {open && <Link href={`/quiz/${open.id}`} className="btn">Take the understanding check</Link>}
        {!done && !open && <RetryQuizButton sessionId={s.id} />}
      </div>
    </div>
  );
}
