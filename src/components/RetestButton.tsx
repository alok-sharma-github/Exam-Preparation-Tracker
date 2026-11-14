"use client";

import { useActionState } from "react";
import { startRetest } from "@/app/actions";

export function RetestButton({ topicIds, label = "Start re-test", secondary = false }: { topicIds: string[]; label?: string; secondary?: boolean }) {
  const [state, action, pending] = useActionState(startRetest, undefined);
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      {topicIds.map((id) => <input key={id} type="hidden" name="topicIds" value={id} />)}
      <button className={secondary ? "btn-secondary" : "btn"} disabled={pending || topicIds.length === 0}>
        {pending ? "Writing questions…" : label}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
