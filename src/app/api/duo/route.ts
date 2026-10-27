import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, todayKey } from "@/lib/api-helpers";
import { sanitizeMessage } from "@/lib/sanitize";
import { randomBytes } from "crypto";
import { ensureDm } from "@/lib/social";

async function getActivePartnership(userId: string) {
  return db.duoPartnership.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ initiatorId: userId }, { partnerId: userId }],
    },
    include: {
      initiator: { include: { settings: true } },
      partner: { include: { settings: true } },
    },
  });
}

/** GET /api/duo — partnership state + partner's shared dashboard data */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const partnership = await getActivePartnership(session.userId);
    if (!partnership) {
      const pending = await db.duoPartnership.findFirst({
        where: { status: "PENDING", OR: [{ initiatorId: session.userId }, { partnerId: session.userId }] },
      });
      return NextResponse.json({
        partnership: null,
        pendingInvite: pending
          ? {
              id: pending.id,
              inviteCode: pending.inviteCode,
              isInitiator: pending.initiatorId === session.userId,
            }
          : null,
      });
    }

    const partner =
      partnership.initiatorId === session.userId ? partnership.partner : partnership.initiator;
    const me =
      partnership.initiatorId === session.userId ? partnership.initiator : partnership.partner;
    if (!partner || !me) return NextResponse.json({ partnership: null, pendingInvite: null });

    const today = todayKey();
    const partnerToday = await db.screenTimeLog.findUnique({
      where: { userId_date: { userId: partner.id, date: today } },
    });
    const myToday = await db.screenTimeLog.findUnique({
      where: { userId_date: { userId: me.id, date: today } },
    });

    return NextResponse.json({
      partnership: { id: partnership.id, since: partnership.createdAt },
      partner: {
        id: partner.id,
        name: partner.name,
        avatarColor: partner.avatarColor,
        streak: partner.streak,
        totalPoints: partner.totalPoints,
        today: partnerToday
          ? {
              minutesUsed: partnerToday.minutesUsed,
              targetMin: partnerToday.targetMin,
              metTarget: partnerToday.minutesUsed <= partnerToday.targetMin,
              topApps: JSON.parse(partnerToday.topApps || "[]"),
            }
          : { minutesUsed: 0, targetMin: partner.settings?.dailyTargetMin ?? 360, metTarget: true, topApps: [] },
      },
      me: {
        today: myToday
          ? { minutesUsed: myToday.minutesUsed, targetMin: myToday.targetMin }
          : { minutesUsed: 0, targetMin: me.settings?.dailyTargetMin ?? 360 },
      },
    });
  } catch (err) {
    console.error("[duo:GET]", err);
    return serverError();
  }
}

/** POST /api/duo { action: invite | accept | unbind } */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const body = await req.json().catch(() => null);
    const action = String(body?.action || "");

    if (action === "invite") {
      // one pending invite per user
      await db.duoPartnership.deleteMany({
        where: { status: "PENDING", initiatorId: session.userId },
      });
      const code = `DR-${randomBytes(3).toString("hex").toUpperCase()}`;
      const partnership = await db.duoPartnership.create({
        data: { initiatorId: session.userId, inviteCode: code },
      });
      return NextResponse.json({ ok: true, inviteCode: partnership.inviteCode });
    }

    if (action === "accept") {
      const code = sanitizeMessage(body?.code, 20).toUpperCase();
      if (!code) return badRequest("Please enter an invite code.");
      const invite = await db.duoPartnership.findUnique({ where: { inviteCode: code } });
      if (!invite || invite.status !== "PENDING") {
        return badRequest("That invite code is invalid or already used.");
      }
      if (invite.initiatorId === session.userId) {
        return badRequest("You cannot accept your own invite.");
      }
      const active = await getActivePartnership(session.userId);
      if (active) return badRequest("You are already in a Dynamic Duo.");

      await db.duoPartnership.update({
        where: { id: invite.id },
        data: { partnerId: session.userId, status: "ACTIVE" },
      });

      // Give the new duo their private chat immediately — the SOS "I'm here"
      // flow and daily check-ins both live in this thread.
      try {
        const conversationId = await ensureDm(invite.initiatorId, session.userId);
        await db.directMessage.create({
          data: {
            conversationId,
            senderId: session.userId,
            kind: "system",
            body: "You two are now each other's Dynamic Duo — this is your private chat.",
          },
        });
        await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      } catch (dmErr) {
        console.error("[duo:POST:accept] dm bootstrap", dmErr);
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "unbind") {
      await db.duoPartnership.deleteMany({
        where: {
          status: "ACTIVE",
          OR: [{ initiatorId: session.userId }, { partnerId: session.userId }],
        },
      });
      return NextResponse.json({ ok: true });
    }

    return badRequest("Unknown action.");
  } catch (err) {
    console.error("[duo:POST]", err);
    return serverError();
  }
}
