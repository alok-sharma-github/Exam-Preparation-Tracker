/** Dates are shown in India time; the app's users are ICAI students. */
export const TZ = "Asia/Kolkata";

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function daysAgoIST(n: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() - n * 86400000));
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00+05:30`) : d;
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatRelativeDays(target: Date, now = new Date()): string {
  const days = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `${-days} day${days === -1 ? "" : "s"} overdue`;
}

export function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** Exam day: exact date if set, otherwise the 1st of the attempt month (ICAI usually starts early in the month). */
export function examDate(p: { examDate: string | null; attemptMonth: number; attemptYear: number }): { date: Date; exact: boolean } {
  if (p.examDate) return { date: new Date(`${p.examDate}T09:00:00+05:30`), exact: true };
  const mm = String(p.attemptMonth).padStart(2, "0");
  return { date: new Date(`${p.attemptYear}-${mm}-01T09:00:00+05:30`), exact: false };
}
