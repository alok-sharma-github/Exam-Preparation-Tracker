import Link from "next/link";
import { requireStudent } from "@/lib/session";
import { getSessions } from "@/lib/data";
import { formatDate, hours } from "@/lib/dates";
import { SESSION_TYPES, type SessionType } from "@/lib/constants";
import { getTopic } from "@/syllabus";

export default async function SessionsPage() {
  const user = await requireStudent();
  const sessions = await getSessions(user.id, 100);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold">Study history</h1>
      {sessions.length === 0 && (
        <p className="text-sm text-muted">Nothing logged yet. <Link href="/log" className="text-accent underline">Log your first session</Link>.</p>
      )}
      <ul className="space-y-3">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link href={`/sessions/${s.id}`} className="card block hover:border-accent">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{formatDate(s.studiedOn)}</span>
                <span>· {SESSION_TYPES[s.sessionType as SessionType]}</span>
                <span>· {hours(s.durationMinutes)}</span>
                <span>· {s.source}</span>
                <span className="ml-auto">
                  {s.quiz?.status === "submitted" ? (
                    <span className={`pill ${(s.quiz.scorePercent ?? 0) >= 70 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200"}`}>
                      check {Math.round(s.quiz.scorePercent ?? 0)}%
                    </span>
                  ) : (
                    <span className="pill bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">not tested</span>
                  )}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium">
                {s.topicIds.map((t) => { const r = getTopic(t); return r ? `${r.paper.code} ${r.topic.name}` : t; }).join(" · ")}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{s.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
