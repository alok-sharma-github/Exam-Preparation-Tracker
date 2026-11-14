"use client";

import { useState } from "react";
import type { Paper } from "@/syllabus/types";
import { STATUS_META } from "@/lib/constants";

type StatusKey = keyof typeof STATUS_META;

export function TopicPicker({
  papers,
  statuses,
  name = "topicIds",
  max = 8,
}: {
  papers: Paper[];
  statuses: Record<string, StatusKey>;
  name?: string;
  max?: number;
}) {
  const [paperId, setPaperId] = useState(papers[0]?.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const paper = papers.find((p) => p.id === paperId);
  const names = new Map(papers.flatMap((p) => p.chapters.flatMap((c) => c.topics.map((t) => [t.id, `${p.code} · ${t.name}`] as const))));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < max) n.add(id);
      return n;
    });
  }

  return (
    <div>
      {[...selected].map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      <div className="mb-3 flex flex-wrap gap-2">
        {papers.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setPaperId(p.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${p.id === paperId ? "border-accent bg-accent/10 font-medium text-accent" : "border-border"}`}
          >
            {p.code} {p.name}
          </button>
        ))}
      </div>
      <div className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {paper?.chapters.map((c, ci) => {
          const count = c.topics.filter((t) => selected.has(t.id)).length;
          const isOpen = open === c.id;
          return (
            <div key={c.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-background">
                <span className="w-6 text-muted">{ci + 1}.</span>
                <span className="flex-1 font-medium">{c.name}</span>
                {count > 0 && <span className="pill bg-accent/10 text-accent">{count}</span>}
                <span className="text-muted">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="space-y-1 bg-background/50 px-3 pb-3 pl-11">
                  {c.topics.map((t) => {
                    const st = statuses[t.id] ?? "not_started";
                    return (
                      <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-surface">
                        <input type="checkbox" className="mt-0.5" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                        <span className="flex-1">{t.name}</span>
                        {st !== "not_started" && <span className={`pill ${STATUS_META[st].className}`}>{STATUS_META[st].label}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {selected.size === 0 ? (
          <p className="hint">No topics selected yet (max {max}).</p>
        ) : (
          [...selected].map((id) => (
            <button type="button" key={id} onClick={() => toggle(id)} className="pill bg-accent/10 text-accent hover:line-through">
              {names.get(id)} ✕
            </button>
          ))
        )}
      </div>
    </div>
  );
}
