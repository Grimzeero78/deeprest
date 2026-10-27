import { db } from "@/lib/db";

/**
 * D1-backed login throttling.
 *
 * WHY: the in-memory limiter (lib/rate-limit.ts) lives per Workers isolate.
 * Cloudflare round-robins requests across isolates, so a scripted attacker
 * simply spreads attempts and never sees a 429. Failed-login counters must
 * be shared state -> D1. Two keys per attempt: the account (stops password
 * spraying on one identity) and the source IP (stops one machine guessing).
 */

const WINDOW_MS = 15 * 60_000; // 15 minutes
const MAX_FAILS = 8; // 8 wrong passwords in the window -> locked out

export interface ThrottleStatus {
  throttled: boolean;
  retryAfterSec: number;
}

export async function authThrottleStatus(key: string): Promise<ThrottleStatus> {
  const row = await db.loginThrottle.findUnique({ where: { key } }).catch(() => null);
  if (!row) return { throttled: false, retryAfterSec: 0 };
  const ageMs = Date.now() - new Date(row.windowStart).getTime();
  if (ageMs > WINDOW_MS || row.fails <= 0) return { throttled: false, retryAfterSec: 0 };
  if (row.fails >= MAX_FAILS) {
    return { throttled: true, retryAfterSec: Math.ceil((WINDOW_MS - ageMs) / 1000) };
  }
  return { throttled: false, retryAfterSec: 0 };
}

export async function recordAuthFail(key: string): Promise<void> {
  const now = new Date();
  const row = await db.loginThrottle.findUnique({ where: { key } }).catch(() => null);
  const expired = !row || Date.now() - new Date(row.windowStart).getTime() > WINDOW_MS;
  if (expired) {
    await db.loginThrottle.upsert({
      where: { key },
      create: { key, fails: 1, windowStart: now },
      update: { fails: 1, windowStart: now },
    }).catch(() => {});
    return;
  }
  await db.loginThrottle.update({
    where: { key },
    data: { fails: { increment: 1 } },
  }).catch(() => {});
}

export async function clearAuthFails(keys: string[]): Promise<void> {
  await db.loginThrottle.deleteMany({ where: { key: { in: keys } } }).catch(() => {});
}

/** Convenience: the two throttle keys for a login attempt. */
export function authThrottleKeys(username: string, ip: string): [string, string] {
  return [`acct:${username}`, `ip:${ip}`];
}
