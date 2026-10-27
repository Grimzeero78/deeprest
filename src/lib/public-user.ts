// ============================================================
// DeepRest — public user shape shared by directory, profile,
// leaderboard and community endpoints. Rank info travels with
// every user object so any list can render badges + progress.
// ============================================================

import { getRankForXp, getNextRank, getRankProgress } from "@/lib/ranks";

export interface PublicUserRow {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarImage: string | null;
  avatarEmoji: string | null;
  bio: string | null;
  totalPoints: number;
  streak: number;
  createdAt: Date;
}

export function serializePublicUser(u: PublicUserRow) {
  const current = getRankForXp(u.totalPoints);
  const next = getNextRank(u.totalPoints);
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    avatarColor: u.avatarColor,
    avatarImage: u.avatarImage,
    avatarEmoji: u.avatarEmoji,
    bio: u.bio,
    totalPoints: u.totalPoints,
    streak: u.streak,
    memberSince: u.createdAt,
    rank: {
      current,
      next,
      progressPercent: getRankProgress(u.totalPoints),
      xpToNext: next ? Math.max(0, next.minXp - u.totalPoints) : 0,
    },
  };
}
