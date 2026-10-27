import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";
import { sanitizeMessage, normalizeName } from "@/lib/sanitize";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { serializePublicUser } from "@/lib/public-user";

const AVATAR_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_CHARS = 150_000; // ~110 KB binary — clients compress well below this
const COLORS = ["#8b5cf6", "#f97316", "#10b981", "#06b6d4", "#f43f5e", "#eab308", "#a855f7", "#14b8a6"];

/** PATCH /api/profile — WhatsApp-style profile: photo, emoji, colour, About, display name */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const rl = LIMITS.profile(session.userId);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const data: Record<string, string | null> = {};

    if (body?.name !== undefined) {
      const name = normalizeName(sanitizeMessage(body.name, 40), 40);
      if (name.length < 2) return badRequest("Name must be at least 2 characters.");
      data.name = name;
    }

    if (body?.bio !== undefined) {
      const bio = sanitizeMessage(body.bio, 160);
      data.bio = bio || null;
    }

    if (body?.avatarColor !== undefined) {
      const color = typeof body.avatarColor === "string" ? body.avatarColor.toLowerCase() : "";
      if (!/^#[0-9a-f]{6}$/.test(color) || !COLORS.includes(color)) {
        return badRequest("Invalid colour.");
      }
      data.avatarColor = color;
    }

    if (body?.avatarEmoji !== undefined) {
      const emoji = typeof body.avatarEmoji === "string" ? [...body.avatarEmoji.trim()][0] : undefined;
      data.avatarEmoji = emoji || null;
    }

    if (body?.avatarImage !== undefined) {
      const img = typeof body.avatarImage === "string" ? body.avatarImage : "";
      if (img === "") {
        data.avatarImage = null; // photo removed
      } else if (!AVATAR_IMAGE_RE.test(img) || img.length > MAX_AVATAR_CHARS) {
        return badRequest("Photo must be a small PNG/JPEG/WebP image (under ~100 KB).");
      } else {
        data.avatarImage = img;
      }
    }

    if (Object.keys(data).length === 0) return badRequest("Nothing to update.");

    const updated = await db.user.update({ where: { id: session.userId }, data });
    return NextResponse.json({ user: serializePublicUser(updated) });
  } catch (err) {
    console.error("[profile:PATCH]", err);
    return serverError();
  }
}

/** POST /api/profile/password — { currentPassword, newPassword } */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const rl = LIMITS.profile(session.userId);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return badRequest("Current and new password are both required.");
    }
    if (newPassword.length < 8 || newPassword.length > 200) {
      return badRequest("New password must be 8–200 characters.");
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });
    if (!user) return unauthorized();

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return badRequest("Your current password is not correct.");

    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profile:password]", err);
    return serverError();
  }
}
