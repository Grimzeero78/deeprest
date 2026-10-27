import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, serverError } from "@/lib/api-helpers";
import { serializePublicUser } from "@/lib/public-user";
import { sanitizeMessage } from "@/lib/sanitize";

/** GET /api/users?q=isaac — community directory (everyone, with ranks) */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const q = sanitizeMessage(req.nextUrl.searchParams.get("q") || "", 40);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50", 10) || 50, 100);

    const users = await db.user.findMany({
      where: q
        ? {
            OR: [{ name: { contains: q } }, { username: { contains: q } }],
          }
        : undefined,
      orderBy: { totalPoints: "desc" },
      take: limit,
    });

    return NextResponse.json({
      users: users.map((u) => ({
        ...serializePublicUser(u),
        isMe: u.id === session.userId,
      })),
    });
  } catch (err) {
    console.error("[users:GET]", err);
    return serverError();
  }
}
