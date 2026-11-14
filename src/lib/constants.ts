export const SESSION_TYPES = {
  first_read: "First read / concept class",
  revision_1: "Revision 1",
  revision_2: "Revision 2",
  revision_3: "Revision 3+",
  practice: "Question practice",
  mock: "Mock / test paper",
} as const;
export type SessionType = keyof typeof SESSION_TYPES;

export const SOURCES = [
  "ICAI Study Material",
  "ICAI RTP",
  "ICAI MTP",
  "Past exam papers",
  "Coaching lecture",
  "Coaching notes / book",
  "Reference book",
  "Other",
] as const;

export const ATTEMPT_MONTHS: Record<number, string> = { 1: "January", 5: "May", 9: "September" };

export type MasteryStatus = "not_started" | "claimed" | "weak" | "verified";

export const STATUS_META: Record<MasteryStatus | "due", { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  claimed: { label: "Studied, not tested", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" },
  weak: { label: "Weak, re-study", className: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
  verified: { label: "Understood", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  due: { label: "Re-test due", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200" },
};

/** Score (%) at or above which a topic counts as understood. */
export const PASS_PERCENT = 70;
/** Spaced re-test intervals in days after each successful test. */
export const REVIEW_INTERVALS_DAYS = [3, 7, 21, 45, 90];
