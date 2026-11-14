import Link from "next/link";
import { requireStudent } from "@/lib/session";
import { getDailyMinutes, getMasteryMap, getOpenDoubts, getPendingQuizzes } from "@/lib/data";
import { displayStatus, isDue, isOverconfident, isUnderconfident } from "@/lib/mastery";
import { daysAgoIST, examDate, formatRelativeDays, hours } from "@/lib/dates";
import { getPapers, getTopic, topicCount, type CaGroup, type CaLevel } from "@/syllabus";
import { ATTEMPT_MONTHS } from "@/lib/constants";
import { RetestButton } from "@/components/RetestButton";
import { resolveDoubt } from "../actions";

export const maxDuration = 60;

function topicLabel(id: string) {
  const r = getTopic(id);
  return r ? `${r.paper.code} · ${r.topic.name}` : id;
}

export default async function Dashboard() {
  const user = await requireStudent();
  const { profile } = user;
  const papers = getPapers(profile.level as CaLevel, profile.group as CaGroup);
  const [mastery, daily, doubts, pending] = await Promise.all([
    getMasteryMap(user.id),
    getDailyMinutes(user.id, 14),
    getOpenDoubts(user.id),
    getPendingQuizzes(user.id),
  ]);

  const now = new Date();
  const exam = examDate(profile);
  const daysLeft = Math.max(0, Math.ceil((exam.date.getTime() - now.getTime()) / 86400000));
  const total = topicCount(papers);
  const rows = [...mastery.values()].filter((m) => getTopic(m.topicId));
  const studied = rows.length;
  const verified = rows.filter((m) => m.status === "verified").length;

  const last14 = Array.from({ length: 14 }, (_, i) => daysAgoIST(13 - i));
  const weekMinutes = last14.slice(7).reduce((s, d) => s + (daily.get(d) ?? 0), 0);
  let streak = 0;
  for (let i = last14.length - 1; i >= 0; i--) {
    if ((daily.get(last14[i]) ?? 0) > 0) streak++;
    else if (i !== last14.length - 1) break; // today not logged yet doesn't break the streak
  }
  const maxDay = Math.max(profile.dailyTargetMinutes, ...last14.map((d) => daily.get(d) ?? 0));

  const due = rows.filter((m) => isDue(m, now)).sort((a, b) => +a.nextReviewAt! - +b.nextReviewAt!);
  const weak = rows.filter((m) => m.status === "weak");
  const untested = rows.filter((m) => m.status === "claimed");
  const over = rows.filter(isOverconfident);
  const under = rows.filter(isUnderconfident);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hi {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted">
          {ATTEMPT_MONTHS[profile.attemptMonth]} {profile.attemptYear} attempt ·{" "}
          <b className="text-foreground">{daysLeft} days</b> to go{exam.exact ? "" : " (approx.; set the exact date in Settings)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Studied (claimed)" value={`${studied}/${total}`} sub={`${Math.round((studied / Math.max(total, 1)) * 100)}% of topics`} />
        <Stat label="Understood (tested)" value={`${verified}/${total}`} sub={`${Math.round((verified / Math.max(total, 1)) * 100)}% of topics`} highlight />
        <Stat label="Last 7 days" value={hours(weekMinutes)} sub={`target ${hours(profile.dailyTargetMinutes * 7)}`} />
        <Stat label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub="days in a row with study logged" />
      </div>

      {studied > 0 && studied > verified && (
        <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <b>{studied - verified}</b> topic{studied - verified === 1 ? " is" : "s are"} logged as studied but not yet proven by a test
          ({untested.length} untested, {weak.length} failed).
        </p>
      )}

      <section className="card">
        <h2 className="mb-3 font-medium">Coverage by paper</h2>
        <div className="space-y-3">
          {papers.map((p) => {
            const ids = p.chapters.flatMap((c) => c.topics.map((t) => t.id));
            const counts = { verified: 0, due: 0, weak: 0, claimed: 0 };
            for (const id of ids) {
              const s = displayStatus(mastery.get(id), now);
              if (s !== "not_started") counts[s]++;
            }
            const pct = (n: number) => `${(n / ids.length) * 100}%`;
            return (
              <div key={p.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{p.code} {p.name}</span>
                  <span className="text-muted">{counts.verified + counts.due}/{ids.length} understood</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="bg-emerald-500" style={{ width: pct(counts.verified) }} title="Understood" />
                  <div className="bg-sky-500" style={{ width: pct(counts.due) }} title="Re-test due" />
                  <div className="bg-red-500" style={{ width: pct(counts.weak) }} title="Weak" />
                  <div className="bg-amber-400" style={{ width: pct(counts.claimed) }} title="Studied, not tested" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          <Legend c="bg-emerald-500" l="Understood" /><Legend c="bg-sky-500" l="Re-test due" />
          <Legend c="bg-red-500" l="Weak" /><Legend c="bg-amber-400" l="Studied, not tested" />
          <Legend c="bg-zinc-300 dark:bg-zinc-700" l="Not started" />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-1 font-medium">Re-tests due ({due.length})</h2>
          <p className="mb-3 text-xs text-muted">Spaced re-tests check you still remember topics you passed.</p>
          {due.length === 0 ? (
            <p className="text-sm text-muted">Nothing due. 🎉</p>
          ) : (
            <>
              <ul className="mb-3 space-y-1 text-sm">
                {due.slice(0, 6).map((m) => (
                  <li key={m.topicId} className="flex justify-between gap-2">
                    <span>{topicLabel(m.topicId)}</span>
                    <span className="shrink-0 text-xs text-muted">{formatRelativeDays(m.nextReviewAt!, now)}</span>
                  </li>
                ))}
              </ul>
              <RetestButton topicIds={due.slice(0, 4).map((m) => m.topicId)} label={`Re-test ${Math.min(due.length, 4)} topic(s)`} />
            </>
          )}
        </section>

        <section className="card">
          <h2 className="mb-1 font-medium">Confidence check</h2>
          <p className="mb-3 text-xs text-muted">Felt confident (4–5) but scored under 60%. These need attention first.</p>
          {over.length === 0 ? (
            <p className="text-sm text-muted">No over-confidence detected yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {over.map((m) => (
                <li key={m.topicId} className="flex justify-between gap-2">
                  <span>{topicLabel(m.topicId)}</span>
                  <span className="shrink-0 text-xs text-red-600">felt {m.lastConfidence}/5 · scored {Math.round(m.lastScore!)}%</span>
                </li>
              ))}
            </ul>
          )}
          {under.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Under-confident (you know more than you think): {under.map((m) => getTopic(m.topicId)?.topic.name).join(", ")}
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 font-medium">Last 14 days</h2>
          <div className="flex h-28 items-end gap-1">
            {last14.map((d) => {
              const m = daily.get(d) ?? 0;
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${hours(m)}`}>
                  <div className={`w-full rounded-t ${m >= profile.dailyTargetMinutes ? "bg-emerald-500" : "bg-accent/70"}`} style={{ height: `${(m / maxDay) * 96}px` }} />
                  <span className="text-[10px] text-muted">{d.slice(8)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Green = daily target ({hours(profile.dailyTargetMinutes)}) met.</p>
        </section>

        <section className="card space-y-4">
          {pending.length > 0 && (
            <div>
              <h2 className="mb-2 font-medium">Unfinished tests</h2>
              <ul className="space-y-1 text-sm">
                {pending.map((q) => (
                  <li key={q.id}>
                    <Link href={`/quiz/${q.id}`} className="text-accent underline">
                      {q.kind === "instant" ? "Check" : "Re-test"}: {q.topicIds.map((t) => getTopic(t)?.topic.name).join(", ")}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h2 className="mb-2 font-medium">Open doubts ({doubts.length})</h2>
            {doubts.length === 0 ? (
              <p className="text-sm text-muted">No open doubts.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {doubts.map((d) => (
                  <li key={d.id} className="flex items-start gap-2">
                    <span className="flex-1 whitespace-pre-wrap">{d.text}</span>
                    <form action={resolveDoubt.bind(null, d.id)}>
                      <button className="text-xs text-accent underline">Resolved</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {studied === 0 && (
            <div>
              <p className="mb-2 text-sm">Start by logging what you studied today.</p>
              <Link href="/log" className="btn">Log study</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`card ${highlight ? "border-emerald-400" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${c}`} />{l}</span>;
}
