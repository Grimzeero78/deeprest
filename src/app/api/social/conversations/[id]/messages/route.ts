import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, notFound, serverError } from "@/lib/api-helpers";

/** GET /api/social/conversations/[id]/messages — latest 300, ascending */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const membership = await db.conversationMember.findFirst({
      where: { conversationId: id, userId: session.userId },
    });
    if (!membership) return notFound("Conversation not found.");

    const rows = await db.directMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        sender: { select: { id: true, name: true, avatarColor: true, avatarImage: true, avatarEmoji: true } },
      },
    });

    const messages = rows.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      kind: m.kind,
      createdAt: m.createdAt,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderColor: m.sender.avatarColor,
      senderImage: m.sender.avatarImage,
      senderEmoji: m.sender.avatarEmoji,
      mine: m.senderId === session.userId,
    }));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[social:messages]", err);
    return serverError();
  }
}
