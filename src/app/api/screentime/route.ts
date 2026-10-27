import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, todayKey } from "@/lib/api-helpers";
import { sanitizeMessage } from "@/lib/sanitize";

// Simulated app catalog — in production this arrives from the device agent / Screen Time API sync.
const APP_POOL = [
  { name: "TikTok",     weight: 3, min: 40, max: 180 },
  { name: "YouTube",    weight: 3, min: 30, max: 150 },
  { name: "Instagram",  weight: 2, min: 20, max: 120 },
  { name: "X (Twitter)",weight: 2, min: 15, max: 90 },
  { name: "WhatsApp",   weight: 2, min: 10, max: 60 },
  { name: "Chrome",     weight: 2, min: 15, max: 80 },
  { name: "Netflix",    weight: 1, min: 30, max: 120 },
  { name: "Spotify",    weight: 1, min: 10, max: 60 },
  { name: "Games",      weight: 1, min: 15, max: 90 },
  { name: "Messages",   weight: 1, min: 5,  max: 30 },
];

function pickWeighted() {
  const total = APP_POOL.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const app of APP_POOL) {
    r -= app.weight;
    if (r <= 0) return app;
  }
  return APP_POOL[0];
}

/** Generate a believable "day of usage" ending near `minutesUsed`. */
function buildTopApps(minutesUsed: number) {
  const apps = [];
  let remaining = Math.max(20, minutesUsed);
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 apps
  const used = new Set<string>();
  for (let i = 0; i < count && remaining > 5; i++) {
    const app = pickWeighted();
    if (used.has(app.name)) continue;
    used.add(app.name);
    const share = i === 0 ? 0.3 + Math.random() * 0.25 : 0.1 + Math.random() * 0.2;
    const mins = Math.max(5, Math.min(Math.round(remaining * share), app.max));
    apps.push({ name: app.name, minutes: mins });
    remaining -= mins;
  }
  if (remaining > 5) {
    apps.push({ name: "Other", minutes: Math.round(remaining) });
  }
  return apps.sort((a, b) => b.minutes - a.minutes);
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
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

    if (action === "log") {
      // Manual log / device-sync delta (simulated device agent in this demo)
      const delta = Number(body?.minutes);
      if (!Number.isFinite(delta) || delta === 0) return badRequest("Invalid minutes value.");
      const minutesUsed = Math.max(0, Math.min(24 * 60, log.minutesUsed + Math.round(delta)));
      const updated = await db.screenTimeLog.update({
        where: { id: log.id },
        data: { minutesUsed, topApps: JSON.stringify(buildTopApps(minutesUsed)) },
      });
      return NextResponse.json({
        ok: true,
        minutesUsed: updated.minutesUsed,
        topApps: JSON.parse(updated.topApps),
      });
    }

    if (action === "sync") {
      // Simulate the day's device usage so the demo has realistic data
      const targetMin = log.targetMin;
      // 55% chance of a "good day" (under target), else over — near the boundary for drama
      const over = Math.random() > 0.55;
      const minutesUsed = over
        ? targetMin + 10 + Math.floor(Math.random() * 110)
        : Math.max(15, targetMin - Math.floor(20 + Math.random() * 180));
      const updated = await db.screenTimeLog.update({
        where: { id: log.id },
        data: { minutesUsed, topApps: JSON.stringify(buildTopApps(minutesUsed)) },
      });
      return NextResponse.json({
        ok: true,
        minutesUsed: updated.minutesUsed,
        topApps: JSON.parse(updated.topApps),
      });
    }

    if (action === "note") {
      // free-text note is sanitized & length-capped (XSS defense-in-depth)
      const note = sanitizeMessage(body?.note, 280);
      return NextResponse.json({ ok: true, note });
    }

    return badRequest("Unknown action.");
  } catch (err) {
    console.error("[screentime]", err);
    return serverError();
  }
}
