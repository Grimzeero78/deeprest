import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, serverError, todayKey } from "@/lib/api-helpers";
import { getRankForXp, getNextRank, getRankProgress, previewTodayGain } from "@/lib/ranks";

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        settings: true,
        screenLogs: { orderBy: { date: "desc" }, take: 7 },
      },
    });
    if (!user) return unauthorized();

    const today = todayKey();
    let todayLog = user.screenLogs.find((l) => l.date === today) || null;

    // Auto-create today's row so the dashboard always has a target to show.
    // (In production the Cloudflare Cron Trigger seeds/updates this row.)
    if (!todayLog) {
      todayLog = await db.screenTimeLog.create({
        data: {
          userId: user.id,
          date: today,
          targetMin: user.settings?.dailyTargetMin ?? 360,
          minutesUsed: 0,
          topApps: "[]",
        },
      });
    }

    const rank = getRankForXp(user.totalPoints);
    const nextRank = getNextRank(user.totalPoints);
    const progress = getRankProgress(user.totalPoints);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatarColor: user.avatarColor,
        totalPoints: user.totalPoints,
        streak: user.streak,
      },
      settings: { dailyTargetMin: user.settings?.dailyTargetMin ?? 360 },
      today: {
        date: todayLog.date,
        minutesUsed: todayLog.minutesUsed,
        targetMin: todayLog.targetMin,
        metTarget: todayLog.minutesUsed <= todayLog.targetMin,
        topApps: JSON.parse(todayLog.topApps || "[]"),
      },
      rank: {
        current: rank,
        next: nextRank,
        progressPercent: progress,
        potentialTodayXp: previewTodayGain(user.streak),
      },
      history: user.screenLogs.map((l) => ({
        date: l.date,
        minutesUsed: l.minutesUsed,
        targetMin: l.targetMin,
        metTarget: l.minutesUsed <= l.targetMin,
      })),
    });
  } catch (err) {
    console.error("[me]", err);
    return serverError();
  }
}
