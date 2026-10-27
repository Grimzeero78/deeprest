"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Flame, Sparkles, Timer, Trophy, ArrowUpRight, Loader2, MonitorSmartphone, Users, ChevronRight,
} from "lucide-react";
import { RankIcon } from "./RankIcons";
import { ProgressRing, formatHm } from "./ProgressRing";
import { SOSButton } from "./SOSButton";
import type { MeResponse, DuoResponse } from "./types";

interface DashboardProps {
  me: MeResponse;
  duo: DuoResponse | null;
  onRefresh: () => void;
  onGoDuo: () => void;
}

export function Dashboard({ me, duo, onRefresh, onGoDuo }: DashboardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState<number>(me.settings.dailyTargetMin);
  const [logOpen, setLogOpen] = useState(false);
  const [hDraft, setHDraft] = useState("0");
  const [mDraft, setMDraft] = useState("0");
  const [appsDraft, setAppsDraft] = useState([
    { name: "", minutes: "" },
    { name: "", minutes: "" },
    { name: "", minutes: "" },
  ]);
  const { toast } = useToast();

  const { today, rank, user } = me;
  const pct = Math.round((today.minutesUsed / Math.max(today.targetMin, 1)) * 100);

  async function screenAction(
    action: "log" | "set",
    payload?: { minutes?: number; topApps?: { name: string; minutes: number }[] }
  ): Promise<boolean> {
    setBusy(action);
    try {
      const res = await fetch("/api/screentime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not save", description: data.error, variant: "destructive" });
        return false;
      }
      toast({
        title: "Screen time saved",
        description: `Today: ${formatHm(data.minutesUsed)} of ${formatHm(me.settings.dailyTargetMin)} target.`,
      });
      onRefresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  function openLogDialog() {
    setHDraft(String(Math.floor(today.minutesUsed / 60)));
    setMDraft(String(today.minutesUsed % 60));
    setLogOpen(true);
  }

  async function saveLog() {
    const h = Math.max(0, parseInt(hDraft || "0", 10) || 0);
    const m = Math.max(0, parseInt(mDraft || "0", 10) || 0);
    const total = Math.min(h * 60 + m, 24 * 60);
    const topApps = appsDraft
      .map((a) => ({ name: a.name.trim(), minutes: parseInt(a.minutes || "0", 10) || 0 }))
      .filter((a) => a.name && a.minutes > 0);
    const ok = await screenAction("set", { minutes: total, topApps });
    if (ok) setLogOpen(false);
  }

  async function saveTarget() {
    setBusy("target");
    try {
      const res = await fetch("/api/screentime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "target", minutes: targetDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not update target", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Target updated", description: `New daily target: ${formatHm(data.targetMin)}.` });
      onRefresh();
    } finally {
      setBusy(null);
    }
  }

  const last7 = [...me.history].slice(0, 7).reverse();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero row: ring + rank */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        <Card className="border-white/10 bg-white/[0.04] lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <MonitorSmartphone className="h-4 w-4 text-cyan-300" />
              Today&apos;s 6-Hour Target
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 pb-6 sm:flex-row sm:items-center sm:justify-around">
            <ProgressRing usedMinutes={today.minutesUsed} targetMinutes={today.targetMin} />

            <div className="w-full max-w-xs space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Usage vs target</span>
                <Badge variant={today.metTarget ? "default" : "destructive"} className={today.metTarget ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"}>
                  {pct}%
                </Badge>
              </div>
              <Progress value={Math.min(pct, 100)} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-violet-400" />

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-slate-300">
                  <Flame className="h-4 w-4 text-orange-400" /> Streak
                </span>
                <span className="font-semibold text-white">{user.streak} day{user.streak === 1 ? "" : "s"}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-emerald-200">
                  <Sparkles className="h-4 w-4" /> Stay under target today
                </span>
                <span className="font-semibold text-emerald-300">+{rank.potentialTodayXp} XP</span>
              </div>

              {/* Real logging — the total comes from your phone's own Screen Time screen */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline" size="sm" disabled={busy !== null}
                  onClick={openLogDialog}
                  className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  <Timer className="mr-2 h-3.5 w-3.5" />
                  Log screen time
                </Button>
                <Button
                  variant="outline" size="sm" disabled={busy !== null}
                  onClick={() => screenAction("log", { minutes: -20 })}
                  className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  {busy === "log" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  -20m offline
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rank card */}
        <Card className="relative overflow-hidden border-white/10 bg-white/[0.04] lg:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <Trophy className="h-4 w-4 text-amber-300" /> Your Rank
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-6 text-center">
            <div className="relative">
              <RankIcon icon={rank.current.icon} color={rank.current.color} colorEnd={rank.current.colorEnd} size={110} className="drop-shadow-[0_0_18px_rgba(167,139,250,0.35)]" />
              <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#0d1228] text-xs text-violet-200 shadow-md border border-violet-400/30">
                Lv. {rank.current.level}
              </Badge>
            </div>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">{rank.current.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{rank.current.tagline}</p>

            <div className="mt-5 w-full">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                <span>{user.totalPoints} XP</span>
                <span>
                  {rank.next ? (
                    <>Next: {rank.next.name} · {rank.next.minXp} XP</>
                  ) : (
                    <>Max rank reached</>
                  )}
                </span>
              </div>
              <Progress value={rank.progressPercent} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-400 [&>div]:to-fuchsia-400" />
              <p className="mt-2 text-xs text-slate-500">
                {rank.next ? `${rank.next.minXp - user.totalPoints} XP to climb` : "You walk the peaceful summit."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {/* Top apps */}
        <Card className="border-white/10 bg-white/[0.04] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <ArrowUpRight className="h-4 w-4 text-rose-300" /> Top visited apps today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {today.topApps.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                Nothing logged yet. Tap <span className="text-slate-300">Log screen time</span> and enter today&apos;s total from your phone.
              </p>
            )}
            {today.topApps.slice(0, 5).map((app, i) => {
              const maxMin = today.topApps[0]?.minutes || 1;
              return (
                <div key={app.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-slate-300">{i + 1}</span>
                      {app.name}
                    </span>
                    <span className="text-slate-400">{formatHm(app.minutes)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-400/80 to-amber-300/80"
                      style={{ width: `${Math.round((app.minutes / maxMin) * 100)}%`, transition: "width 600ms" }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Dynamic duo teaser + SOS */}
        <Card className="border-white/10 bg-white/[0.04] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <Users className="h-4 w-4 text-sky-300" /> Dynamic Duo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {duo?.partner ? (
              <button onClick={onGoDuo} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-violet-400/30 hover:bg-white/[0.06]">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${duo.partner.avatarColor}, #312e81)` }}
                >
                  {duo.partner.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-white">{duo.partner.name}</span>
                  <span className="block text-xs text-slate-400">
                    {duo.partner.today.metTarget
                      ? "Under target today — green across the board"
                      : `Over target today (${formatHm(duo.partner.today.minutesUsed)})`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            ) : (
              <button onClick={onGoDuo} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 p-3 text-left transition hover:border-violet-400/40 hover:bg-white/[0.05]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 text-violet-200"><Users className="h-5 w-5" /></span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-white">Invite your accountability partner</span>
                  <span className="block text-xs text-slate-400">Shared dashboards, SOS alerts and instant calls</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            )}
            <Separator className="bg-white/10" />
            <div className="flex flex-col items-center gap-2">
              <SOSButton hasPartner={Boolean(duo?.partner)} partnerName={duo?.partner?.name} size="lg" />
              <p className="text-center text-xs text-slate-500">Alerts your partner via push, SMS & email — with confirmation to prevent accidents.</p>
            </div>
          </CardContent>
        </Card>

        {/* Target settings */}
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-slate-200">Daily target</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <span className="text-3xl font-semibold text-white">{formatHm(targetDraft)}</span>
              <p className="text-xs text-slate-500">default is the 6-hour target</p>
            </div>
            <Slider
              value={[targetDraft]} min={60} max={960} step={15}
              onValueChange={(v) => setTargetDraft(v[0])}
              className="[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-cyan-400 [&_[data-slot=slider-range]]:to-violet-400"
            />
            <Button onClick={saveTarget} disabled={busy !== null || targetDraft === me.settings.dailyTargetMin}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400">
              {busy === "target" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save target
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Week strip */}
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-slate-200">Last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 sm:gap-3">
            {last7.map((d) => {
              const h = Math.round((d.minutesUsed / Math.max(d.targetMin, 1)) * 100);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-24 w-full max-w-10 items-end overflow-hidden rounded-lg bg-white/5">
                    <div
                      className={`w-full rounded-lg ${d.metTarget ? "bg-gradient-to-t from-cyan-500/70 to-violet-400/70" : "bg-gradient-to-t from-rose-500/70 to-amber-400/70"}`}
                      style={{ height: `${Math.max(Math.min(h, 100), 4)}%`, transition: "height 600ms" }}
                      title={`${d.date}: ${formatHm(d.minutesUsed)} / ${formatHm(d.targetMin)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{d.date.slice(5)}</span>
                </div>
              );
            })}
            {last7.length === 0 && <p className="w-full py-4 text-center text-sm text-slate-500">Your week will fill up as you log each day.</p>}
          </div>
        </CardContent>
      </Card>
      {/* Log screen time dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="border-white/10 bg-[#0d1228] text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Timer className="h-4 w-4 text-cyan-300" /> Log today&apos;s screen time
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Open <span className="text-slate-200">Digital Wellbeing</span> (Android) or{" "}
              <span className="text-slate-200">Screen Time</span> (iPhone) and enter the total it shows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="log-hours" className="text-xs text-slate-400">Hours</Label>
                <Input
                  id="log-hours" type="number" min={0} max={24} value={hDraft}
                  onChange={(e) => setHDraft(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="log-minutes" className="text-xs text-slate-400">Minutes</Label>
                <Input
                  id="log-minutes" type="number" min={0} max={59} value={mDraft}
                  onChange={(e) => setMDraft(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Top apps today (optional)</Label>
              {appsDraft.map((app, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`App ${i + 1}, e.g. TikTok`} value={app.name}
                    onChange={(e) => setAppsDraft((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                    className="h-9 border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600"
                  />
                  <Input
                    placeholder="min" type="number" min={0} value={app.minutes}
                    onChange={(e) => setAppsDraft((rows) => rows.map((r, j) => (j === i ? { ...r, minutes: e.target.value } : r)))}
                    className="h-9 w-24 border-white/10 bg-white/5 text-sm text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost" onClick={() => setLogOpen(false)}
              className="text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={saveLog} disabled={busy !== null}
              className="bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-400 hover:to-violet-400"
            >
              {busy === "set" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save today
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
