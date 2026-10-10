import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Lets the owner skip the anonymous daily limit. Visit /api/bypass?token=<token>
// once per browser; it sets a cookie holding a hash of the token.
export const BYPASS_COOKIE = "onceover_bypass";

/** BYPASS_TOKEN if set, otherwise CRON_SECRET, so no new variable is needed. */
export function bypassToken() {
  return (process.env.BYPASS_TOKEN || process.env.CRON_SECRET || "").trim() || null;
}

export function hashToken(token: string) {
  return createHash("sha256").update(`bypass:${token}`).digest("hex");
}

export function tokenMatches(given: string) {
  const token = bypassToken();
  if (!token) return false;
  const a = Buffer.from(hashToken(given.trim()));
  const b = Buffer.from(hashToken(token));
  return timingSafeEqual(a, b);
}

export async function hasBypass() {
  const token = bypassToken();
  if (!token) return false;
  const value = (await cookies()).get(BYPASS_COOKIE)?.value;
  return value === hashToken(token);
}
