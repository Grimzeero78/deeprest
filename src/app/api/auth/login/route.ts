import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";
import { toUsername } from "@/lib/sanitize";

// Sign-in uses NO email — only the name chosen at registration plus the
// password. If the attempt fails, the stored password hint (if any) is
// returned to help the user remember it.
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    const rl = LIMITS.auth(ip);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const name = String(body?.name || "");
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name || !password) return badRequest("Name and password are required.");

    const username = toUsername(name);
    const user = await db.user.findUnique({ where: { username } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      // Attach the hint only when the account exists — never leak whether
      // the name itself is registered to unauthenticated probing beyond this.
      return NextResponse.json(
        {
          error: "Incorrect name or password.",
          hint: user?.passwordHint || null,
        },
        { status: 400 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, name: user.name, username: user.username, avatarColor: user.avatarColor },
    });
  } catch (err) {
    console.error("[login]", err);
    return serverError();
  }
}
