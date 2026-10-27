import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, notFound, serverError } from "@/lib/api-helpers";
import { serializePublicUser } from "@/lib/public-user";

/** GET /api/users/[id] — a member's profile: rank, XP, streak, points needed for the next rank */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const user = await db.user.findUnique({ where: { id } });
    if (!user) return notFound("Member not found.");

    return NextResponse.json({ user: { ...serializePublicUser(user), isMe: user.id === session.userId } });
  } catch (err) {
    console.error("[users:id:GET]", err);
    return serverError();
  }
}
