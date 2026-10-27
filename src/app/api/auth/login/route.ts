import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    const rl = LIMITS.auth(ip);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(String(body?.email || ""));
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) return badRequest("Email and password are required.");

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return badRequest("Incorrect email or password.");
    }

    const token = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor },
    });
  } catch (err) {
    console.error("[login]", err);
    return serverError();
  }
}
