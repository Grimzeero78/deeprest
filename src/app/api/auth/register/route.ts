import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, hashPassword } from "@/lib/auth";
import { badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";
import { sanitizeMessage, normalizeEmail } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    const rl = LIMITS.auth(ip);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const email = normalizeEmail(String(body?.email || ""));
    const password = typeof body?.password === "string" ? body.password : "";
    const name = sanitizeMessage(body?.name, 40) || "Friend";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest("Please enter a valid email address.");
    }
    if (password.length < 8) {
      return badRequest("Password must be at least 8 characters.");
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return badRequest("An account with this email already exists. Try signing in.");
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        settings: { create: {} },
      },
    });

    const token = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor },
    });
  } catch (err) {
    console.error("[register]", err);
    return serverError();
  }
}
