"use client";

import { useActionState } from "react";
import { retryInstantQuiz } from "@/app/actions";

export function RetryQuizButton({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(retryInstantQuiz.bind(null, sessionId), undefined);
  return (
    <form action={action} className="flex flex-col gap-1">
      <button className="btn" disabled={pending}>{pending ? "Writing questions…" : "Generate understanding check"}</button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
