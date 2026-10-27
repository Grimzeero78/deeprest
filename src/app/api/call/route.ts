import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { LIMITS } from "@/lib/rate-limit";

async function getPartnerId(userId: string): Promise<string | null> {
  const p = await db.duoPartnership.findFirst({
    where: { status: "ACTIVE", OR: [{ initiatorId: userId }, { partnerId: userId }] },
  });
  if (!p) return null;
  return p.initiatorId === userId ? p.partnerId : p.initiatorId;
}

/**
 * GET /api/call — poll current call state for this user.
 * Returns the most recent non-ended call where I'm caller or callee,
 * plus peer identity for the call UI.
 */
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const call = await db.callSession.findFirst({
      where: {
        status: { in: ["RINGING", "ACTIVE"] },
        OR: [{ callerId: session.userId }, { calleeId: session.userId }],
      },
      orderBy: { startedAt: "desc" },
    });
    if (!call) return NextResponse.json({ call: null });

    const peerId = call.callerId === session.userId ? call.calleeId : call.callerId;
    const peer = await db.user.findUnique({ where: { id: peerId } });

    return NextResponse.json({
      call: {
        id: call.id,
        status: call.status,
        modality: call.modality,
        isCaller: call.callerId === session.userId,
        peerName: peer?.name || "Partner",
        peerColor: peer?.avatarColor || "#8b5cf6",
        startedAt: call.startedAt,
        answeredAt: call.answeredAt,
      },
    });
  } catch (err) {
    console.error("[call:GET]", err);
    return serverError();
  }
}

/** POST /api/call { modality: "voice" | "video" } — ring the Dynamic Duo partner */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const rl = LIMITS.call(session.userId);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const partnerId = await getPartnerId(session.userId);
    if (!partnerId) return badRequest("You need a Dynamic Duo partner before calling.");

    const body = await req.json().catch(() => null);
    const modality = body?.modality === "video" ? "video" : "voice";

    // Auto-expire stale ringing calls (caller hung up or never answered)
    await db.callSession.updateMany({
      where: {
        status: "RINGING",
        startedAt: { lt: new Date(Date.now() - 60_000) },
      },
      data: { status: "MISSED", endedAt: new Date() },
    });

    // Only one live call at a time
    const live = await db.callSession.findFirst({
      where: { status: { in: ["RINGING", "ACTIVE"] }, OR: [{ callerId: session.userId }, { calleeId: session.userId }] },
    });
    if (live) return badRequest("You already have a call in progress.");

    const call = await db.callSession.create({
      data: { callerId: session.userId, calleeId: partnerId, modality },
    });

    return NextResponse.json({ ok: true, callId: call.id, status: call.status });
  } catch (err) {
    console.error("[call:POST]", err);
    return serverError();
  }
}

/** PATCH /api/call { callId, action: answer | decline | end } */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const body = await req.json().catch(() => null);
    const callId = String(body?.callId || "");
    const action = String(body?.action || "");
    if (!callId) return badRequest("callId is required.");

    const call = await db.callSession.findUnique({ where: { id: callId } });
    if (!call) return badRequest("Call not found.");
    if (call.callerId !== session.userId && call.calleeId !== session.userId) {
      return unauthorized();
    }

    if (action === "answer" && call.status === "RINGING" && call.calleeId === session.userId) {
      const updated = await db.callSession.update({
        where: { id: callId },
        data: { status: "ACTIVE", answeredAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: updated.status });
    }

    if (action === "decline" && call.status === "RINGING" && call.calleeId === session.userId) {
      await db.callSession.update({
        where: { id: callId },
        data: { status: "DECLINED", endedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: "DECLINED" });
    }

    if (action === "end" && (call.status === "RINGING" || call.status === "ACTIVE")) {
      await db.callSession.update({
        where: { id: callId },
        data: { status: "ENDED", endedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: "ENDED" });
    }

    return badRequest("Invalid action for current call state.");
  } catch (err) {
    console.error("[call:PATCH]", err);
    return serverError();
  }
}
