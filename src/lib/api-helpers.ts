import { NextResponse } from "next/server";
import { getSession, verifySessionToken } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: `Rate limit reached. Try again in ${retryAfterSec}s.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export function serverError(message = "Something went wrong. Please try again.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Resolve the authenticated session or null.
 * Web clients: httpOnly session cookie. Mobile (Expo) clients: the same JWT
 * sent as `Authorization: Bearer <token>` — cookies are unreliable in React
 * Native, so the header path is checked first and the cookie is the fallback.
 */
export async function requireSession(req?: Request): Promise<SessionPayload | null> {
  if (req) {
    const auth = req.headers.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7).trim();
      if (token) {
        const session = await verifySessionToken(token);
        if (session) return session;
      }
    }
  }
  return getSession();
}

/** Local YYYY-MM-DD (server date) used as the daily partition key. */
export function todayKey(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString().slice(0, 10);
}
