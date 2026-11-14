"use client";

import { useActionState, useState } from "react";
import { logStudySession } from "@/app/actions";
import { SESSION_TYPES, SOURCES, STATUS_META } from "@/lib/constants";
import type { Paper } from "@/syllabus/types";
import { TopicPicker } from "./TopicPicker";

const CONFIDENCE = ["", "Lost", "Shaky", "Okay", "Confident", "Can teach it"];

export function LogForm({ papers, statuses, today }: { papers: Paper[]; statuses: Record<string, keyof typeof STATUS_META>; today: string }) {
  const [state, action, pending] = useActionState(logStudySession, undefined);
  const [duration, setDuration] = useState("60");
  const [confidence, setConfidence] = useState(3);
  const [summary, setSummary] = useState("");

  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-3">
        <h2 className="font-medium">1. What did you study?</h2>
        <TopicPicker papers={papers} statuses={statuses} />
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">2. Session details</h2>
        <div>
          <label className="label" htmlFor="studiedOn">Date</label>
          <input className="input" type="date" id="studiedOn" name="studiedOn" defaultValue={today} max={today} required />
        </div>
        <div>
          <label className="label" htmlFor="sessionType">Type of session</label>
          <select className="input" id="sessionType" name="sessionType" defaultValue="first_read">
            {Object.entries(SESSION_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="source">Source</label>
          <select className="input" id="source" name="source" defaultValue={SOURCES[0]}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="durationMinutes">Duration (minutes)</label>
          <input className="input" type="number" id="durationMinutes" name="durationMinutes" min={5} max={900} value={duration} onChange={(e) => setDuration(e.target.value)} required />
          <div className="mt-1.5 flex gap-1.5">
            {[30, 60, 90, 120, 180].map((m) => (
              <button type="button" key={m} className="pill border border-border hover:bg-background" onClick={() => setDuration(String(m))}>{m}</button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="itemsCovered">Exactly what did you cover?</label>
          <input className="input" id="itemsCovered" name="itemsCovered" maxLength={500} placeholder="e.g. Study material Illustrations 4–9, RTP May 2025 Q3, SA 230 para 8–11" />
          <p className="hint">Questions are modelled on these, so be specific.</p>
        </div>
        <div>
          <label className="label" htmlFor="practiceAttempted">Practice questions attempted</label>
          <input className="input" type="number" id="practiceAttempted" name="practiceAttempted" min={0} max={500} placeholder="optional" />
        </div>
        <div>
          <label className="label" htmlFor="practiceCorrect">…of which correct</label>
          <input className="input" type="number" id="practiceCorrect" name="practiceCorrect" min={0} max={500} placeholder="optional" />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-medium">3. Show what you understood</h2>
        <div>
          <label className="label" htmlFor="summary">Explain it in your own words (3–5 lines)</label>
          <textarea
            className="input min-h-32"
            id="summary"
            name="summary"
            required
            minLength={40}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Without looking at the book: what is the concept, when is it used, and what is the formula or key rule? Mention one tricky point."
          />
          <p className="hint">{summary.trim().length}/40 characters minimum. The AI reviews this and uses it to write your test.</p>
        </div>
        <div>
          <span className="label">How confident are you? <b>{confidence} · {CONFIDENCE[confidence]}</b></span>
          <input type="range" name="confidence" min={1} max={5} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          <p className="hint">Be honest. The app compares this with your test score to catch over-confidence.</p>
        </div>
        <div>
          <label className="label" htmlFor="doubts">Doubts / what confused you</label>
          <textarea className="input" id="doubts" name="doubts" rows={2} maxLength={2000} placeholder="optional" />
        </div>
      </section>

      {state?.error && <p className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? "Saving and writing your understanding check…" : "Save and take the quick check"}</button>
        {pending && <span className="text-sm text-muted">Takes about 10–30 seconds.</span>}
      </div>
    </form>
  );
}
