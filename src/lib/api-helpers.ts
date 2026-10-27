import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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

/** Resolve the authenticated session or null. */
export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}

/** Local YYYY-MM-DD (server date) used as the daily partition key. */
export function todayKey(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString().slice(0, 10);
}
