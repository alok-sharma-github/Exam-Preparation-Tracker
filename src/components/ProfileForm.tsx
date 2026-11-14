"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "@/app/actions";

interface Props {
  initial: { level: string; group: string; attemptMonth: number; attemptYear: number; examDate: string; dailyTargetHours: number };
  available: string[]; // "level:group" combos with a syllabus
  submitLabel: string;
}

const LEVELS = [
  ["foundation", "CA Foundation"],
  ["intermediate", "CA Intermediate"],
  ["final", "CA Final"],
] as const;
const GROUPS = [
  ["group1", "Group I"],
  ["group2", "Group II"],
  ["both", "Both groups"],
] as const;
const MONTHS = [
  [1, "January"],
  [5, "May"],
  [9, "September"],
] as const;

export function ProfileForm({ initial, available, submitLabel }: Props) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const [level, setLevel] = useState(initial.level);
  const [group, setGroup] = useState(initial.group);
  const year = new Date().getFullYear();
  const supported = available.includes(`${level}:${group}`) || (group === "both" && available.some((a) => a.startsWith(`${level}:`)));

  return (
    <form action={action} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="level">CA level</label>
          <select className="input" id="level" name="level" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="group">Group</label>
          <select className="input" id="group" name="group" value={group} onChange={(e) => setGroup(e.target.value)}>
            {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="attemptMonth">Attempt month</label>
          <select className="input" id="attemptMonth" name="attemptMonth" defaultValue={initial.attemptMonth}>
            {MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="attemptYear">Attempt year</label>
          <select className="input" id="attemptYear" name="attemptYear" defaultValue={initial.attemptYear}>
            {[year, year + 1, year + 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="examDate">First paper date (optional)</label>
          <input className="input" id="examDate" name="examDate" type="date" defaultValue={initial.examDate} />
          <p className="hint">Set this once ICAI announces the timetable. Until then the countdown uses the 1st of the month.</p>
        </div>
        <div>
          <label className="label" htmlFor="dailyTargetHours">Daily study target (hours)</label>
          <input className="input" id="dailyTargetHours" name="dailyTargetHours" type="number" min={1} max={16} step={0.5} defaultValue={initial.dailyTargetHours} />
        </div>
      </div>
      {!supported && (
        <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          The syllabus for this level/group isn&apos;t loaded yet. Right now only CA Intermediate Group II is available.
        </p>
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn" disabled={pending || !supported}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
