import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, hashPassword } from "@/lib/auth";
import { badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";
import { sanitizeMessage, normalizeName, toUsername } from "@/lib/sanitize";
import { isBreachedPassword } from "@/lib/pwned-check";

// Registration uses NO email — only a name, a password, a confirmation
// of that password, and an optional hint to help remember it later.
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    const rl = LIMITS.auth(ip);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const name = normalizeName(String(body?.name || ""));
    const password = typeof body?.password === "string" ? body.password : "";
    const confirmPassword =
      typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
    // Hint is optional, sanitized like any other stored string.
    const hint = sanitizeMessage(body?.hint, 120);

    if (!name || name.length < 2) {
      return badRequest("Please enter your name (at least 2 characters).");
    }
    if (password.length < 8) {
      return badRequest("Password must be at least 8 characters.");
    }
    if (!confirmPassword) {
      return badRequest("Please confirm your password.");
    }
    if (password !== confirmPassword) {
      return badRequest("Passwords do not match. Please check both fields.");
    }

    const username = toUsername(name);
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return badRequest("This name is already taken. Try signing in instead.");
    }

    // Breach check (same public lists Chrome uses) — block known-breached
    // passwords at the door so nobody starts DeepRest with an unsafe one.
    const breached = await isBreachedPassword(password);
    if (breached) {
      return badRequest(
        "That password has appeared in public data breaches, so it isn't safe to use. Please pick a new, unique password you don't use anywhere else."
      );
    }

    const user = await db.user.create({
      data: {
        username,
        name,
        passwordHash: await hashPassword(password),
        passwordHint: hint || null,
        settings: { create: {} },
      },
    });

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name,
    });
    await setSessionCookie(token);

    // `token` lets native mobile clients (no cookie jar) use Bearer auth.
    return NextResponse.json({
      user: { id: user.id, name: user.name, username: user.username, avatarColor: user.avatarColor },
      token,
    });
  } catch (err) {
    console.error("[register]", err);
    return serverError();
  }
}
