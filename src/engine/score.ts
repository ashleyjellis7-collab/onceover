import type { Band, Severity } from "@/rules";

export const WEIGHTS: Record<Severity, number> = {
  critical: 25,
  major: 10,
  minor: 3,
};

/** Any critical issue caps the score here so a red gauge can't hide behind many passes. */
export const CRITICAL_CAP = 49;

export function bandFor(
  probability: number,
  thresholds: { issue: number; review: number },
): Band {
  if (probability >= thresholds.issue) return "issue";
  // Low confidence goes to Review; it is never rounded to Clear.
  if (probability >= thresholds.review) return "review";
  return "clear";
}

/** Score = max(0, 100 − Σ_issues w − ½ Σ_review w), capped at 49 on any critical issue. */
export function score(findings: { band: Band; severity: Severity }[]): number {
  let s = 100;
  let critical = false;
  for (const f of findings) {
    if (f.band === "issue") {
      s -= WEIGHTS[f.severity];
      if (f.severity === "critical") critical = true;
    } else if (f.band === "review") {
      s -= WEIGHTS[f.severity] / 2;
    }
  }
  s = Math.max(0, Math.round(s));
  return critical ? Math.min(s, CRITICAL_CAP) : s;
}
