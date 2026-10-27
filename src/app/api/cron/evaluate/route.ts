import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serverError, todayKey } from "@/lib/api-helpers";
import { evaluateDaily, getRankForXp } from "@/lib/ranks";

// ============================================================
// Monitoring service — the local equivalent of the production
// Cloudflare Worker Cron Trigger (see cloudflare/worker-cron.js).
//
// Demo semantics: the dashboard pings this endpoint every 45s, so a
// user's day is re-scored whenever its met/over status changes.
// Scoring is IDEMPOTENT: we reconstruct the pre-evaluation XP/streak
// by subtracting the points already applied for today (log.pointsEarned),
// then apply the fresh delta. In production the Cron Trigger runs once
// daily at 23:59 and this diffing behaves identically (single pass).
// ============================================================

/**
 * GET /api/cron/evaluate?key=...
 * For every user with activity today: compare "Time Used" vs "Target",
 * award/lose XP, update streaks, and detect rank changes.
 * Protected by a shared secret (CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET || "deeprest-dev-cron";
    if (req.nextUrl.searchParams.get("key") !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = todayKey();
    const users = await db.user.findMany({
      include: { screenLogs: { where: { date: today } }, settings: true },
    });

    const results: {
      userId: string;
      minutesUsed: number;
      targetMin: number;
      rankChanged: boolean;
      rankBefore: string;
      rankAfter: string;
      pointsDelta: number;
      newXp: number;
      newStreak: number;
      metTarget: boolean;
      reason: string;
    }[] = [];

    for (const user of users) {
      const log = user.screenLogs[0];
      // No synced usage data yet -> skip until the device agent (or simulation) reports
      if (!log || log.minutesUsed === 0) continue;

      const newMetTarget = log.minutesUsed <= log.targetMin;
      // Already scored for this exact state (same met/over status) -> nothing to do
      if (log.evaluated && log.metTarget === newMetTarget) continue;

      // Reconstruct pre-evaluation state (makes re-scoring idempotent)
      const baseXp = Math.max(0, user.totalPoints - (log.evaluated ? log.pointsEarned : 0));
      const baseStreak =
        log.evaluated && log.metTarget ? Math.max(0, user.streak - 1) : user.streak;

      const result = evaluateDaily({
        minutesUsed: log.minutesUsed,
        targetMinutes: log.targetMin,
        currentXp: baseXp,
        currentStreak: baseStreak,
      });

      const rankBefore = getRankForXp(user.totalPoints).name;
      const rankAfter = getRankForXp(result.newXp).name;

      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: { totalPoints: result.newXp, streak: result.newStreak, lastEvalDate: today },
        }),
        db.screenTimeLog.update({
          where: { id: log.id },
          data: { pointsEarned: result.pointsDelta, metTarget: newMetTarget, evaluated: true },
        }),
      ]);

      results.push({
        userId: user.id,
        minutesUsed: log.minutesUsed,
        targetMin: log.targetMin,
        ...result,
        rankChanged: rankBefore !== rankAfter,
        rankBefore,
        rankAfter,
      });
    }

    return NextResponse.json({ ok: true, evaluated: results.length, results });
  } catch (err) {
    console.error("[cron:evaluate]", err);
    return serverError();
  }
}
