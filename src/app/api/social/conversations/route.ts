import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";
import { sanitizeMessage, normalizeName } from "@/lib/sanitize";
import { serializePublicUser } from "@/lib/public-user";
import { ensureDm } from "@/lib/social";

const PEER_SELECT = {
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

/** GET /api/social/conversations -> my chat list (DMs + groups) with unread counts */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const memberships = await db.conversationMember.findMany({
      where: { userId: session.userId },
      include: {
        conversation: {
          include: {
            members: { include: { user: { select: PEER_SELECT } } },
          },
        },
      },
    });

    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const convo = m.conversation;
        const others = convo.members.filter((cm) => cm.userId !== session.userId);

        const [lastMessage, unreadCount] = await Promise.all([
          db.directMessage.findFirst({
            where: { conversationId: convo.id },
            orderBy: { createdAt: "desc" },
            include: { sender: { select: { id: true, name: true } } },
          }),
          db.directMessage.count({
            where: {
              conversationId: convo.id,
              senderId: { not: session.userId },
              createdAt: { gt: m.lastReadAt || new Date(0) },
            },
          }),
        ]);

        const base = {
          id: convo.id,
          kind: convo.kind,
          updatedAt: convo.updatedAt,
          unreadCount,
          memberCount: convo.members.length,
          lastMessage: lastMessage
            ? {
                body: lastMessage.body,
                kind: lastMessage.kind,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                senderName: lastMessage.sender.name,
              }
            : null,
        };

        if (convo.kind === "dm") {
          const peerMember = others[0];
          const peer = peerMember?.user;
          if (!peer) return null; // dangling DM — partner deleted
          return {
            ...base,
            name: peer.name,
            emoji: null,
            peerLastReadAt: peerMember.lastReadAt,
            peer: {
              id: peer.id,
              name: peer.name,
              avatarColor: peer.avatarColor,
              avatarImage: peer.avatarImage,
              avatarEmoji: peer.avatarEmoji,
              bio: peer.bio,
              rank: serializePublicUser(peer).rank,
            },
          };
        }

        return {
          ...base,
          name: convo.name || "Group",
          emoji: convo.emoji,
          createdBy: convo.createdBy,
          members: convo.members.map((cm) => ({
            ...serializePublicUser(cm.user),
            isCreator: convo.createdBy === cm.userId,
          })),
        };
      })
    );

    const list = conversations
      .filter(Boolean)
      .sort((a, b) => new Date(b!.updatedAt).getTime() - new Date(a!.updatedAt).getTime());

    return NextResponse.json({ conversations: list });
  } catch (err) {
    console.error("[social:conversations:GET]", err);
    return serverError();
  }
}

/** POST /api/social/conversations — { kind:"dm", userId } | { kind:"group", name, emoji, memberIds } */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const rl = LIMITS.social(session.userId);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const kind = body?.kind === "group" ? "group" : body?.kind === "dm" ? "dm" : null;
    if (!kind) return badRequest("kind must be 'dm' or 'group'.");

    // ---------- one-on-one DM (get-or-create) ----------
    if (kind === "dm") {
      const userId = typeof body?.userId === "string" ? body.userId : "";
      if (!userId) return badRequest("userId is required.");
      if (userId === session.userId) return badRequest("You cannot DM yourself.");

      const other = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!other) return badRequest("That person could not be found.");

      // Race-proof get-or-create: the pair's DM id is deterministic, so a
      // double-tap can never spawn two parallel threads (see lib/social.ts).
      const conversationId = await ensureDm(session.userId, userId);
      return NextResponse.json({ conversationId, existed: true });
    }

    // ---------- group ----------
    const name = normalizeName(sanitizeMessage(body?.name, 60), 60);
    if (name.length < 2) return badRequest("Group name must be at least 2 characters.");
    const emoji = typeof body?.emoji === "string" && body.emoji.trim() ? [...body.emoji.trim()][0] : "🌙";

    const rawIds: unknown[] = Array.isArray(body?.memberIds) ? body.memberIds : [];
    const memberIds = [...new Set(rawIds.filter((v): v is string => typeof v === "string"))]
      .filter((id) => id !== session.userId)
      .slice(0, 30);

    if (memberIds.length > 0) {
      const found = await db.user.findMany({ where: { id: { in: memberIds } }, select: { id: true } });
      if (found.length !== memberIds.length) return badRequest("One or more members could not be found.");
    }

    const convo = await db.conversation.create({
      data: { kind: "group", name, emoji, createdBy: session.userId },
    });
    await db.conversationMember.createMany({
      data: [
        { conversationId: convo.id, userId: session.userId },
        ...memberIds.map((userId) => ({ conversationId: convo.id, userId })),
      ],
    });
    await db.directMessage.create({
      data: {
        conversationId: convo.id,
        senderId: session.userId,
        kind: "system",
        body: `${session.name} created the group “${name}”`,
      },
    });

    return NextResponse.json({ conversationId: convo.id, existed: false }, { status: 201 });
  } catch (err) {
    console.error("[social:conversations:POST]", err);
    return serverError();
  }
}
