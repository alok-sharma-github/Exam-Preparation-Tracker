"use client";

import { useActionState, useState } from "react";
import { startRetest } from "@/app/actions";

/** Wraps the syllabus tree so the student can tick topics and test themselves on them. */
export function SyllabusSelect({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState(startRetest, undefined);
  const [count, setCount] = useState(0);
  return (
    <form
      action={action}
      onChange={(e) => setCount((e.currentTarget as HTMLFormElement).querySelectorAll('input[name="topicIds"]:checked').length)}
    >
      <div className="sticky top-26 z-[5] sm:top-14 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur">
        <span className="text-sm">{count === 0 ? "Tick topics (up to 6) to test yourself on them." : `${count} topic(s) selected`}</span>
        <button className="btn ml-auto" disabled={pending || count === 0 || count > 6}>
          {pending ? "Writing questions…" : "Test me on these"}
        </button>
        {count > 6 && <span className="text-xs text-red-600">Max 6 topics per test.</span>}
        {state?.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
      </div>
      {children}
    </form>
  );
}
