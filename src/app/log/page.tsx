import { LogForm } from "@/components/LogForm";
import { requireStudent } from "@/lib/session";
import { getMasteryMap } from "@/lib/data";
import { displayStatus } from "@/lib/mastery";
import { todayIST } from "@/lib/dates";
import { getPapers, type CaGroup, type CaLevel } from "@/syllabus";

export const maxDuration = 60;

export default async function LogPage() {
  const user = await requireStudent();
  const papers = getPapers(user.profile.level as CaLevel, user.profile.group as CaGroup);
  const mastery = await getMasteryMap(user.id);
  const statuses = Object.fromEntries([...mastery].map(([id, m]) => [id, displayStatus(m)]));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Log a study session</h1>
      <p className="mb-6 text-sm text-muted">Takes a minute. Right after saving you get a short test on exactly what you logged.</p>
      <LogForm papers={papers} statuses={statuses} today={todayIST()} />
    </div>
  );
}
