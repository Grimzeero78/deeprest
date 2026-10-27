import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, serverError } from "@/lib/api-helpers";
import { serializePublicUser } from "@/lib/public-user";

/** GET /api/leaderboard — top 25 by XP + the caller's own position */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const top = await db.user.findMany({
      orderBy: [{ totalPoints: "desc" }, { createdAt: "asc" }],
      take: 25,
    });

    const me = await db.user.findUnique({ where: { id: session.userId } });
    if (!me) return unauthorized();

    const myPosition = (await db.user.count({ where: { totalPoints: { gt: me.totalPoints } } })) + 1;

    return NextResponse.json({
      leaders: top.map((u, i) => ({
        position: i + 1,
        ...serializePublicUser(u),
        isMe: u.id === session.userId,
      })),
      me: { position: myPosition, ...serializePublicUser(me), isMe: true },
    });
  } catch (err) {
    console.error("[leaderboard:GET]", err);
    return serverError();
  }
}
