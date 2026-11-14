/** Pure helpers for marking numerical answers (no server deps, unit-tested). */

export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/[₹,\s%]/g, "").replace(/^rs\.?/i, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function gradeNumeric(answer: string, correct: number, tolerancePercent: number | null): boolean {
  const n = parseNumber(answer);
  if (n === null) return false;
  const tol = Math.max(Math.abs(correct) * ((tolerancePercent ?? 1) / 100), 0.01);
  return Math.abs(n - correct) <= tol;
}
