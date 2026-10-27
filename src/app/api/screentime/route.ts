import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, todayKey } from "@/lib/api-helpers";
import { sanitizeMessage } from "@/lib/sanitize";

interface TopAppEntry {
  name: string;
  minutes: number;
}

/** Validate + sanitize user-entered top apps (max 5, deduped). */
function sanitizeTopApps(raw: unknown): TopAppEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TopAppEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = sanitizeMessage((item as { name?: unknown }).name, 30);
    const minutes = Math.round(Number((item as { minutes?: unknown }).minutes));
    if (!name || !Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, minutes });
    if (out.length >= 5) break;
  }
  return out;
}

function parseTopApps(json: string | null | undefined): TopAppEntry[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? (parsed as TopAppEntry[]) : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    if (!session) return unauthorized();

    const body = await req.json().catch(() => null);
    const action = String(body?.action || "");
    const today = todayKey();

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: { settings: true },
    });
    if (!user) return unauthorized();

    let log = await db.screenTimeLog.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });
    if (!log) {
      log = await db.screenTimeLog.create({
        data: { userId: user.id, date: today, targetMin: user.settings?.dailyTargetMin ?? 360 },
      });
    }

    if (action === "target") {
      const minutes = Number(body?.minutes);
      if (!Number.isFinite(minutes) || minutes < 60 || minutes > 16 * 60) {
        return badRequest("Target must be between 1 and 16 hours.");
      }
      await db.userSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, dailyTargetMin: Math.round(minutes) },
        update: { dailyTargetMin: Math.round(minutes) },
      });
      await db.screenTimeLog.update({
        where: { id: log.id },
        data: { targetMin: Math.round(minutes) },
      });
      return NextResponse.json({ ok: true, targetMin: Math.round(minutes) });
    }

    if (action === "set") {
      // DEVICE-ONLY: screen time can never be typed in by hand. The Android
      // app reads UsageStatsManager and syncs with its Bearer token — the web
      // session (cookie) has no way to claim usage numbers. What the phone
      // measured is the only truth the dashboard shows.
      if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
        return badRequest(
          "Screen time can only be synced from the DeepRest Android app with Usage access granted."
        );
      }
      const minutes = Math.round(Number(body?.minutes));
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
        return badRequest("Minutes must be between 0 and 1440.");
      }
      const appsProvided = body?.topApps !== undefined;
      const topApps = sanitizeTopApps(body?.topApps);
      const updated = await db.screenTimeLog.update({
        where: { id: log.id },
        data: {
          minutesUsed: minutes,
          ...(appsProvided ? { topApps: JSON.stringify(topApps) } : {}),
        },
      });
      return NextResponse.json({
        ok: true,
        minutesUsed: updated.minutesUsed,
        topApps: parseTopApps(updated.topApps),
      });
    }

    return badRequest("Unknown action.");
  } catch (err) {
    console.error("[screentime]", err);
    return serverError();
  }
}
