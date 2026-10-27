import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, notFound, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";
import { sanitizeMessage } from "@/lib/sanitize";
import { serializePublicUser } from "@/lib/public-user";

const MEMBER_SELECT = {
  id: true,
  name: true,
  username: true,
  avatarColor: true,
  avatarImage: true,
  avatarEmoji: true,
  bio: true,
  totalPoints: true,
  streak: true,
  createdAt: true,
} as const;

/** Shared: load the conversation + confirm the caller is a member. */
async function requireMember(
  req: NextRequest,
  convoId: string
): Promise<
  | { error: NextResponse; session?: undefined; membership?: undefined }
  | {
      error?: undefined;
      session: { userId: string; name: string };
      membership: { id: string; lastReadAt: Date | null; conversation: { id: string; kind: string; name: string | null; emoji: string | null; createdBy: string | null; createdAt: Date } };
    }
> {
  const session = await requireSession(req);
  if (!session) return { error: unauthorized() };

  const membership = await db.conversationMember.findFirst({
    where: { conversationId: convoId, userId: session.userId },
    include: { conversation: true },
  });
  if (!membership) return { error: notFound("Conversation not found.") };

  return { session, membership };
}

/** GET /api/social/conversations/[id] — details + members (with ranks) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireMember(req, id);
    if (ctx.error || !ctx.session || !ctx.membership) return ctx.error!;
    const { membership } = ctx;

    const members = await db.conversationMember.findMany({
      where: { conversationId: id },
      include: { user: { select: MEMBER_SELECT } },
    });

    const convo = membership.conversation;
    return NextResponse.json({
      id: convo.id,
      kind: convo.kind,
      name: convo.kind === "group" ? convo.name || "Group" : null,
      emoji: convo.emoji,
      createdBy: convo.createdBy,
      createdAt: convo.createdAt,
      myLastReadAt: membership.lastReadAt,
      members: members.map((m) => ({
        ...serializePublicUser(m.user),
        isCreator: convo.createdBy === m.userId,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (err) {
    console.error("[social:convo:GET]", err);
    return serverError();
  }
}

/** POST /api/social/conversations/[id] { body } — send a message */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireMember(req, id);
    if (ctx.error || !ctx.session || !ctx.membership) return ctx.error!;
    const { session, membership } = ctx;

    const rl = LIMITS.social(session.userId);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const payload = await req.json().catch(() => null);
    const text = sanitizeMessage(payload?.body, 2000);
    if (!text) return badRequest("Message cannot be empty.");

    const [saved] = await db.$transaction([
      db.directMessage.create({
        data: { conversationId: id, senderId: session.userId, body: text, kind: "text" },
      }),
      db.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
      db.conversationMember.update({
        where: { id: membership.id },
        data: { lastReadAt: new Date() },
      }),
    ]);

    return NextResponse.json(
      {
        message: {
          id: saved.id,
          body: saved.body,
          kind: saved.kind,
          createdAt: saved.createdAt,
          senderId: session.userId,
          senderName: session.name,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[social:convo:POST]", err);
    return serverError();
  }
}

/** PATCH /api/social/conversations/[id] { action:"read" } — mark the chat as read */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireMember(req, id);
    if (ctx.error || !ctx.session || !ctx.membership) return ctx.error!;

    await db.conversationMember.update({
      where: { id: ctx.membership.id },
      data: { lastReadAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[social:convo:PATCH]", err);
    return serverError();
  }
}

/** DELETE /api/social/conversations/[id] — leave a group (last member removes it entirely) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireMember(req, id);
    if (ctx.error || !ctx.session || !ctx.membership) return ctx.error!;
    const { session, membership } = ctx;

    if (membership.conversation.kind !== "group") {
      return badRequest("Direct chats cannot be left. They stay in your list.");
    }

    await db.directMessage.create({
      data: {
        conversationId: id,
        senderId: session.userId,
        kind: "system",
        body: `${session.name} left the group`,
      },
    });
    await db.conversationMember.delete({ where: { id: membership.id } });

    const remaining = await db.conversationMember.count({ where: { conversationId: id } });
    if (remaining === 0) {
      await db.conversation.delete({ where: { id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[social:convo:DELETE]", err);
    return serverError();
  }
}
