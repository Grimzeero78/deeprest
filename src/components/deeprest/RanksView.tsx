"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Flame, Loader2, Medal, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { RankIcon } from "./RankIcons";
import { MemberProfileDialog } from "./MemberProfileDialog";
import { RANKS } from "@/lib/ranks";
import type { MeResponse, PublicUser } from "./types";

interface LeaderRow {
  position: number;
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarImage: string | null;
  avatarEmoji: string | null;
  bio: string | null;
  totalPoints: number;
  streak: number;
  rank: { current: { level: number; name: string; icon: string; color: string; colorEnd: string; tagline: string }; next: unknown; progressPercent: number; xpToNext: number };
  isMe?: boolean;
}

export function RanksView({ me }: { me: MeResponse }) {
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [meRow, setMeRow] = useState<LeaderRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/leaderboard");
    if (res.ok) {
      const data = await res.json();
      setLeaders(data.leaders || []);
      setMeRow(data.me || null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const iv = setInterval(load, 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [load]);

  const myLadder = RANKS.map((r) => ({
    ...r,
    reached: me.user.totalPoints >= r.minXp,
    isCurrent: r.level === me.rank.current.level,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* my position banner */}
      <Card className="relative overflow-hidden border-white/10 bg-white/[0.04]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
        <CardContent className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:justify-around">
          <div className="flex items-center gap-4">
            <RankIcon icon={me.rank.current.icon} color={me.rank.current.color} colorEnd={me.rank.current.colorEnd} size={78} />
            <div>
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Medal className="h-3.5 w-3.5 text-amber-300" />
                Your position
              </p>
              <p className="text-2xl font-bold text-white">#{meRow?.position ?? "—"} <span className="text-sm font-normal text-slate-400">in the community</span></p>
              <p className="mt-0.5 text-sm text-violet-300">Lv.{me.rank.current.level} {me.rank.current.name} · {me.user.totalPoints} XP</p>
            </div>
          </div>
          <div className="w-full max-w-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{me.rank.next ? `Next: ${me.rank.next.name}` : "Max rank reached"}</span>
              {me.rank.next && <span>{me.rank.next.minXp - me.user.totalPoints} XP needed</span>}
            </div>
            <Progress value={me.rank.progressPercent} className="h-2.5 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-400 [&>div]:to-fuchsia-400" />
            <p className="text-right text-xs text-slate-500">
              {me.rank.next ? `${me.rank.next.minXp} XP unlocks it` : "You walk the peaceful summit."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {/* leaderboard */}
        <Card className="border-white/10 bg-white/[0.04] lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <Trophy className="h-4 w-4 text-amber-300" /> Community leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {!loaded && (
              <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
            )}
            {loaded && leaders.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No members ranked yet.</p>
            )}
            {leaders.map((l) => (
              <button key={l.id} onClick={() => setProfileUser(l as unknown as PublicUser)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  l.isMe ? "border-violet-400/40 bg-violet-500/10" : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                )}>
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  l.position === 1 ? "bg-amber-400 text-amber-950"
                  : l.position === 2 ? "bg-slate-300 text-slate-800"
                  : l.position === 3 ? "bg-amber-700 text-amber-100"
                  : "bg-white/10 text-slate-300"
                )}>{l.position}</span>
                <Avatar name={l.name} color={l.avatarColor} image={l.avatarImage} emoji={l.avatarEmoji} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {l.name} {l.isMe && <span className="text-xs text-violet-300">(you)</span>}
                  </span>
                  <span className="block truncate text-xs text-slate-400">Lv.{l.rank.current.level} {l.rank.current.name}</span>
                </span>
                <span className="hidden items-center gap-1 text-xs text-orange-300 sm:flex"><Flame className="h-3 w-3" /> {l.streak}</span>
                <span className="w-16 shrink-0 text-right text-sm font-semibold text-violet-300">{l.totalPoints} <span className="text-[10px] font-normal text-slate-500">XP</span></span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* rank ladder */}
        <Card className="border-white/10 bg-white/[0.04] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <ArrowUpRight className="h-4 w-4 text-violet-300" /> The 10-rank ladder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {myLadder.map((r) => (
              <div key={r.level}
                className={cn("flex items-center gap-3 rounded-xl border px-3 py-2",
                  r.isCurrent ? "border-violet-400/40 bg-violet-500/10"
                  : r.reached ? "border-white/10 bg-white/[0.03]"
                  : "border-white/5 opacity-55")}>
                <RankIcon icon={r.icon} color={r.color} colorEnd={r.colorEnd} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">Lv.{r.level} {r.name}</p>
                  <p className="text-[11px] text-slate-400">{r.minXp} XP · {r.tagline}</p>
                </div>
                {r.isCurrent ? (
                  <Badge className="border-violet-400/30 bg-violet-500/20 text-[10px] text-violet-200 hover:bg-violet-500/20">You</Badge>
                ) : r.reached ? (
                  <Badge variant="outline" className="border-emerald-400/30 bg-emerald-500/10 text-[10px] text-emerald-300">✓</Badge>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <MemberProfileDialog user={profileUser} open={profileUser !== null} onOpenChange={(v) => !v && setProfileUser(null)} />
    </div>
  );
}
