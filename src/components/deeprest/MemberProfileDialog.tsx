"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Trophy, Clock3, ArrowUpRight } from "lucide-react";
import { Avatar } from "./Avatar";
import { RankIcon } from "./RankIcons";
import { RANKS } from "@/lib/ranks";
import type { PublicUser } from "./types";

interface Props {
  user: PublicUser | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMessage?: (userId: string) => void;
}

/** WhatsApp-style tap-on-avatar profile: rank, XP, ladder position, points to next rank. */
export function MemberProfileDialog({ user, open, onOpenChange, onMessage }: Props) {
  const ladder = useMemo(() => {
    if (!user) return [];
    return RANKS.map((r) => ({
      ...r,
      reached: user.totalPoints >= r.minXp,
      isCurrent: r.level === user.rank.current.level,
    }));
  }, [user]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#0d1228] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Member profile</DialogTitle>
          <DialogDescription className="sr-only">Rank and progress details</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={user.name} color={user.avatarColor} image={user.avatarImage} emoji={user.avatarEmoji} size={88} ring />
          <h3 className="mt-1 text-xl font-semibold text-white">{user.name}</h3>
          <p className="text-xs text-slate-400">@{user.username}</p>
          {user.bio && <p className="mt-1 max-w-xs text-sm text-slate-300">{user.bio}</p>}
          {onMessage && !user.isMe && (
            <button
              onClick={() => {
                onMessage(user.id);
                onOpenChange(false);
              }}
              className="mt-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-1.5 text-xs font-medium text-white transition hover:from-violet-400 hover:to-fuchsia-400"
            >
              Message {user.name.split(" ")[0]}
            </button>
          )}
        </div>

        {/* rank hero */}
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <RankIcon icon={user.rank.current.icon} color={user.rank.current.color} colorEnd={user.rank.current.colorEnd} size={64} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              {user.rank.current.name} <span className="text-slate-400">· Lv.{user.rank.current.level}</span>
            </p>
            <p className="truncate text-xs text-slate-400">{user.rank.current.tagline}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
              <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" /> {user.streak} day streak</span>
              <span className="font-semibold text-violet-300">{user.totalPoints} XP</span>
            </div>
          </div>
        </div>

        {/* progress to next */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Progress to next rank</span>
            {user.rank.next ? (
              <span className="flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> {user.rank.next.name} needs {user.rank.next.minXp} XP
              </span>
            ) : (
              <span>Max rank reached</span>
            )}
          </div>
          <Progress value={user.rank.progressPercent} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-400 [&>div]:to-fuchsia-400" />
          <p className="text-right text-xs text-violet-300">
            {user.rank.next ? `${user.rank.xpToNext ?? Math.max(0, user.rank.next.minXp - user.totalPoints)} XP to go` : "You walk the peaceful summit."}
          </p>
        </div>

        {/* the 10-rank ladder */}
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Clock3 className="h-3.5 w-3.5" /> The 10-rank ladder
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1 deeprest-scroll">
            {ladder.map((r) => (
              <div
                key={r.level}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  r.isCurrent ? "border-violet-400/40 bg-violet-500/10" : r.reached ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-transparent opacity-50"
                }`}
              >
                <RankIcon icon={r.icon} color={r.color} colorEnd={r.colorEnd} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    Lv.{r.level} {r.name}
                  </p>
                  <p className="text-[11px] text-slate-400">{r.minXp} XP required</p>
                </div>
                {r.isCurrent ? (
                  <Badge className="border-violet-400/30 bg-violet-500/20 text-[10px] text-violet-200 hover:bg-violet-500/20">You</Badge>
                ) : r.reached ? (
                  <Badge variant="outline" className="border-emerald-400/30 bg-emerald-500/10 text-[10px] text-emerald-300">Reached</Badge>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
