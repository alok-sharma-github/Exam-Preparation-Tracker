import { requireStudent } from "@/lib/session";
import { getMasteryMap } from "@/lib/data";
import { displayStatus } from "@/lib/mastery";
import { formatRelativeDays, hours } from "@/lib/dates";
import { STATUS_META } from "@/lib/constants";
import { getPapers, type CaGroup, type CaLevel } from "@/syllabus";
import { SyllabusSelect } from "@/components/SyllabusSelect";

export const maxDuration = 60;

export default async function SyllabusPage() {
  const user = await requireStudent();
  const papers = getPapers(user.profile.level as CaLevel, user.profile.group as CaGroup);
  const mastery = await getMasteryMap(user.id);
  const now = new Date();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Syllabus map</h1>
      <p className="mb-4 text-sm text-muted">Every topic, with what you claimed and what tests proved.</p>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS_META).map(([k, v]) => <span key={k} className={`pill ${v.className}`}>{v.label}</span>)}
      </div>
      <SyllabusSelect>
        <div className="space-y-6">
          {papers.map((p) => (
            <section key={p.id} className="card">
              <h2 className="mb-3 font-semibold">{p.code} · {p.name} <span className="text-sm font-normal text-muted">({p.marks} marks)</span></h2>
              <div className="space-y-4">
                {p.chapters.map((c, ci) => (
                  <div key={c.id}>
                    <h3 className="mb-1.5 text-sm font-medium">{ci + 1}. {c.name}</h3>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {c.topics.map((t) => {
                        const m = mastery.get(t.id);
                        const st = displayStatus(m, now);
                        return (
                          <label key={t.id} className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm ${STATUS_META[st].className}`}>
                            <input type="checkbox" name="topicIds" value={t.id} className="mt-0.5" />
                            <span className="flex-1">
                              <span className="block">{t.name}</span>
                              {m && (
                                <span className="block text-xs opacity-80">
                                  {hours(m.studyMinutes)} · {m.sessionsCount} session{m.sessionsCount === 1 ? "" : "s"}
                                  {m.revisionCount > 0 && ` · ${m.revisionCount} revision${m.revisionCount === 1 ? "" : "s"}`}
                                  {m.lastScore !== null && ` · last test ${Math.round(m.lastScore)}%`}
                                  {m.lastConfidence !== null && ` · felt ${m.lastConfidence}/5`}
                                  {m.nextReviewAt && m.status === "verified" && ` · re-test ${formatRelativeDays(m.nextReviewAt, now)}`}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SyllabusSelect>
    </div>
  );
}
