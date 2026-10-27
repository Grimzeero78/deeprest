import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { sanitizeMessage } from "@/lib/sanitize";
import { LIMITS } from "@/lib/rate-limit";

async function getPartnerId(userId: string): Promise<string | null> {
  const p = await db.duoPartnership.findFirst({
    where: { status: "ACTIVE", OR: [{ initiatorId: userId }, { partnerId: userId }] },
  });
  if (!p) return null;
  return p.initiatorId === userId ? p.partnerId : p.initiatorId;
}

/** GET /api/sos — alerts I sent + alerts my partner sent (both views) */
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const partnerId = await getPartnerId(session.userId);

    const [sent, received] = await Promise.all([
      db.sOSAlert.findMany({
        where: { senderId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      partnerId
        ? db.sOSAlert.findMany({
            where: { senderId: partnerId, status: "SENT" },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      sent: sent.map((a) => ({ id: a.id, message: a.message, status: a.status, createdAt: a.createdAt })),
      received: received.map((a) => ({ id: a.id, message: a.message, createdAt: a.createdAt })),
    });
  } catch (err) {
    console.error("[sos:GET]", err);
    return serverError();
  }
}

/** POST /api/sos { confirmed: true, message } — fires the panic alert */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    // Anti-spam: 3 alerts per 5 minutes (Cloudflare WAF rule in production)
    const rl = LIMITS.sos(session.userId);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    // Confirmation step is enforced server-side, not just in the UI
    if (body?.confirmed !== true) {
      return badRequest("SOS requires explicit confirmation.");
    }
    const message = sanitizeMessage(body?.message, 280) || "needs your support right now.";

    const partnerId = await getPartnerId(session.userId);

    const alert = await db.sOSAlert.create({
      data: { senderId: session.userId, message },
    });

    // Production: SMS (Twilio) + Email (Resend) + Web Push via Worker queues.
    // Demo: channels are marked "delivered" and surfaced to the partner via polling.
    const channels = partnerId
      ? [
          { channel: "push", delivered: true },
          { channel: "sms", delivered: true },
          { channel: "email", delivered: true },
        ]
      : [{ channel: "none", delivered: false }];

    return NextResponse.json({
      ok: true,
      alertId: alert.id,
      partnerNotified: Boolean(partnerId),
      channels,
    });
  } catch (err) {
    console.error("[sos:POST]", err);
    return serverError();
  }
}

/** PATCH /api/sos { id, action: "acknowledge" } — partner taps "I'm here" */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const body = await req.json().catch(() => null);
    const id = String(body?.id || "");
    if (!id) return badRequest("Alert id is required.");

    const partnerId = await getPartnerId(session.userId);
    const alert = await db.sOSAlert.findUnique({ where: { id } });
    if (!alert || alert.senderId !== partnerId) {
      return badRequest("Alert not found.");
    }

    await db.sOSAlert.update({ where: { id }, data: { status: "ACKNOWLEDGED" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sos:PATCH]", err);
    return serverError();
  }
}
