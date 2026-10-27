// ============================================================
// DeepRest rate limiting — in-memory sliding window.
// Production equivalent: Cloudflare WAF rate-limiting rules +
// KV-backed counters on the Worker (see cloudflare/README.md).
// ============================================================

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// periodic cleanup so the map never grows unbounded
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt < now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key      unique key, e.g. `chat:${userId}` or `sos:${userId}`
 * @param limit    max requests in the window
 * @param windowMs window size in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

// Presets
export const LIMITS = {
  chat: (userId: string) => rateLimit(`chat:${userId}`, 20, 60_000), // 20 msgs/min per persona chat
  social: (userId: string) => rateLimit(`social:${userId}`, 40, 60_000), // 40 community msgs/min
  profile: (userId: string) => rateLimit(`profile:${userId}`, 10, 60_000), // profile/password edits
  sos: (userId: string) => rateLimit(`sos:${userId}`, 3, 5 * 60_000), // 3 SOS per 5 min
  auth: (ip: string) => rateLimit(`auth:${ip}`, 10, 60_000), // 10 login/register attempts/min
  call: (userId: string) => rateLimit(`call:${userId}`, 6, 60_000),
};
