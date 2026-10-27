/* eslint-disable import/no-anonymous-default-export */
/**
 * ============================================================
 * DeepRest — Cloudflare Worker: Cron Trigger monitoring service
 * ============================================================
 * Runs hourly (recommended: 23:59 daily for scoring). For each
 * user it polls "Time Used" vs "Target" from D1, applies the
 * Rank System scoring rules, and updates XP / streaks.
 *
 * wrangler.toml:
 *   [triggers]
 *     crons = ["0 23 * * *"]        # daily scoring at 23:59 UTC
 *   [[d1_databases]]
 *     binding = "DB"
 *     database_name = "deeprest-db"
 *   [[kv_namespaces]]
 *     binding = "RATE_LIMIT"
 *
 * Scoring rules (identical to src/lib/ranks.ts in the demo app):
 *   - under target: +50 XP, +5 XP per streak day (cap +35)
 *   - over target : -25 XP (floor 0), streak resets to 0
 */

const RANKS = [
  { level: 1,  name: "Restless",        minXp: 0 },
  { level: 2,  name: "Awakened",        minXp: 100 },
  { level: 3,  name: "Seeker",          minXp: 300 },
  { level: 4,  name: "Steward",         minXp: 600 },
  { level: 5,  name: "Disciplined",     minXp: 1000 },
  { level: 6,  name: "Guardian",        minXp: 1500 },
  { level: 7,  name: "Sentinel",        minXp: 2200 },
  { level: 8,  name: "Overcomer",       minXp: 3000 },
  { level: 9,  name: "Luminary",        minXp: 4200 },
  { level: 10, name: "DeepRest Master", minXp: 6000 },
];

function rankForXp(xp) {
  let current = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) current = r; else break;
  return current;
}

function evaluateDaily(minutesUsed, targetMinutes, currentXp, currentStreak) {
  const metTarget = minutesUsed <= targetMinutes;
  if (metTarget) {
    const streakBonus = Math.min(currentStreak, 7) * 5;
    return {
      metTarget,
      pointsDelta: 50 + streakBonus,
      newXp: currentXp + 50 + streakBonus,
      newStreak: currentStreak + 1,
    };
  }
  return {
    metTarget,
    pointsDelta: -25,
    newXp: Math.max(0, currentXp - 25),
    newStreak: 0,
  };
}

function todayKey(tz = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()); // en-CA => YYYY-MM-DD
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runEvaluation(env));
  },

  // Also callable via HTTP for manual runs / debugging:
  // curl -H "Authorization: Bearer $CRON_SECRET" https://deeprest-worker.workers.dev/evaluate
  async fetch(request, env) {
    const url = new URL(request.url);
    const auth = request.headers.get("Authorization") || "";
    if (url.pathname !== "/evaluate" || auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response("Forbidden", { status: 403 });
    }
    const summary = await runEvaluation(env);
    return Response.json(summary);
  },
};

async function runEvaluation(env) {
  const today = todayKey();
  const results = [];

  // Users whose settings timezone has already rolled past midnight
  const { results: users } = await env.DB.prepare(
    `SELECT u.id, u.total_points, u.streak, u.last_eval_date, s.timezone, s.daily_target_min
       FROM users u
       JOIN user_settings s ON s.user_id = u.id
      WHERE u.last_eval_date IS NOT ?1`
  ).bind(today).all();

  for (const user of users) {
    const userToday = todayKey(user.timezone || "UTC");
    if (userToday !== today) continue; // not midnight yet in their timezone

    const log = await env.DB.prepare(
      `SELECT id, minutes_used, target_min, evaluated FROM screen_time_logs
        WHERE user_id = ?1 AND date = ?2`
    ).bind(user.id, userToday).first();

    if (!log || log.evaluated) continue;

    const result = evaluateDaily(
      log.minutes_used,
      log.target_min || user.daily_target_min,
      user.total_points,
      user.streak
    );

    const before = rankForXp(user.total_points).name;
    const after = rankForXp(result.newXp).name;

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE users SET total_points = ?1, streak = ?2, last_eval_date = ?3,
                          updated_at = datetime('now') WHERE id = ?4`
      ).bind(result.newXp, result.newStreak, userToday, user.id),
      env.DB.prepare(
        `UPDATE screen_time_logs SET points_earned = ?1, met_target = ?2, evaluated = 1
          WHERE id = ?3`
      ).bind(result.pointsDelta, result.metTarget ? 1 : 0, log.id),
    ]);

    results.push({ userId: user.id, ...result, rankUp: before !== after, after });

    // Rank-up side effect: notify the Dynamic Duo partner (celebration push)
    if (before !== after && result.pointsDelta > 0) {
      await notifyPartner(env, user.id, `${before} -> ${after}`);
    }
  }

  return { evaluatedAt: new Date().toISOString(), count: results.length, results };
}

async function notifyPartner(env, userId, text) {
  // Push/SMS/email fan-out via Queues or a service binding goes here.
  console.log(`rank-up: user=${userId} ${text}`);
}
