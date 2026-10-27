// ============================================================
// DeepRest Rank System — 10 levels of gamified rehabilitation
// ============================================================
// Scoring rules (mirrored in cloudflare/worker-cron.js for prod):
//  - Stay under the daily screen-time target  -> earn XP
//      base 50 XP + streak bonus (5 XP per consecutive day, capped at 35)
//  - Exceed the daily target                  -> lose 25 XP (floor 0), streak resets
// ============================================================

export interface Rank {
  level: number;
  name: string;
  minXp: number;
  icon: string; // key into RankIcon SVG registry
  color: string; // signature gradient start
  colorEnd: string; // signature gradient end
  tagline: string;
}

export const RANKS: Rank[] = [
  { level: 1,  name: "Restless",       minXp: 0,    icon: "restless",   color: "#64748b", colorEnd: "#94a3b8", tagline: "The journey begins in restlessness." },
  { level: 2,  name: "Awakened",       minXp: 100,  icon: "awakened",   color: "#0ea5e9", colorEnd: "#7dd3fc", tagline: "You noticed the noise. Now tune it out." },
  { level: 3,  name: "Seeker",         minXp: 300,  icon: "seeker",     color: "#06b6d4", colorEnd: "#67e8f9", tagline: "Searching for stillness beyond the screen." },
  { level: 4,  name: "Steward",        minXp: 600,  icon: "steward",    color: "#10b981", colorEnd: "#6ee7b7", tagline: "Guardian of your own attention." },
  { level: 5,  name: "Disciplined",    minXp: 1000, icon: "disciplined",color: "#22c55e", colorEnd: "#86efac", tagline: "Habits forged, not wished for." },
  { level: 6,  name: "Guardian",       minXp: 1500, icon: "guardian",   color: "#eab308", colorEnd: "#fde047", tagline: "You protect your peace fiercely." },
  { level: 7,  name: "Sentinel",       minXp: 2200, icon: "sentinel",   color: "#f59e0b", colorEnd: "#fcd34d", tagline: "Watchful. Steady. Unshakeable." },
  { level: 8,  name: "Overcomer",      minXp: 3000, icon: "overcomer",  color: "#f97316", colorEnd: "#fdba74", tagline: "The old urges no longer command you." },
  { level: 9,  name: "Luminary",       minXp: 4200, icon: "luminary",   color: "#a855f7", colorEnd: "#d8b4fe", tagline: "Your light guides others home." },
  { level: 10, name: "DeepRest Master", minXp: 6000, icon: "master",   color: "#8b5cf6", colorEnd: "#f0abfc", tagline: "Rest restored. Life reclaimed." },
];

export function getRankForXp(xp: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.minXp) current = r;
    else break;
  }
  return current;
}

export function getNextRank(xp: number): Rank | null {
  const current = getRankForXp(xp);
  return RANKS.find((r) => r.level === current.level + 1) ?? null;
}

/** Progress (0-100) from current rank toward the next rank's threshold. */
export function getRankProgress(xp: number): number {
  const current = getRankForXp(xp);
  const next = getNextRank(xp);
  if (!next) return 100; // max rank
  const span = next.minXp - current.minXp;
  const done = xp - current.minXp;
  return Math.max(0, Math.min(100, Math.round((done / span) * 100)));
}

export interface DailyEvaluationInput {
  minutesUsed: number;
  targetMinutes: number;
  currentXp: number;
  currentStreak: number;
}

export interface DailyEvaluationResult {
  metTarget: boolean;
  pointsDelta: number;
  newXp: number;
  newStreak: number;
  reason: string;
}

/**
 * Core daily scoring engine — called by the monitoring service
 * (Cloudflare Worker Cron Trigger in production, /api/cron/evaluate here).
 */
export function evaluateDaily(input: DailyEvaluationInput): DailyEvaluationResult {
  const { minutesUsed, targetMinutes, currentXp, currentStreak } = input;
  const metTarget = minutesUsed <= targetMinutes;

  let pointsDelta: number;
  let newStreak: number;
  let reason: string;

  if (metTarget) {
    const streakBonus = Math.min(currentStreak, 7) * 5; // up to +35 XP
    pointsDelta = 50 + streakBonus;
    newStreak = currentStreak + 1;
    reason =
      streakBonus > 0
        ? `Target met — +${pointsDelta} XP (50 base + ${streakBonus} streak bonus)`
        : `Target met — +${pointsDelta} XP`;
  } else {
    pointsDelta = -25;
    newStreak = 0;
    reason = `Target exceeded — -25 XP, streak reset`;
  }

  const newXp = Math.max(0, currentXp + pointsDelta);
  return { metTarget, pointsDelta, newXp, newStreak, reason };
}

/** Points preview used by the dashboard ("staying under target earns +X XP today"). */
export function previewTodayGain(currentStreak: number): number {
  return 50 + Math.min(currentStreak, 7) * 5;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
