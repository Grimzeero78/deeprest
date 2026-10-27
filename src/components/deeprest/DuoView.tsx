"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Copy, CheckCheck, Phone, Video, Loader2, Link2, HeartHandshake, Siren, Scissors, CheckCircle2, Clock,
} from "lucide-react";
import { ProgressRing, formatHm } from "./ProgressRing";
import { SOSButton } from "./SOSButton";
import type { DuoResponse, SosResponse } from "./types";

interface DuoViewProps {
  duo: DuoResponse | null;
  sos: SosResponse | null;
  onRefresh: () => void;
  onCall: (modality: "voice" | "video") => void;
}

export function DuoView({ duo, sos, onRefresh, onCall }: DuoViewProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function action(body: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      const res = await fetch("/api/duo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
        return null;
      }
      onRefresh();
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function createInvite() {
    const data = await action({ action: "invite" }, "invite");
    if (data?.inviteCode) setInviteCode(data.inviteCode);
  }

  async function acceptInvite() {
    if (!joinCode.trim()) return;
    const data = await action({ action: "accept", code: joinCode.trim() }, "accept");
    if (data?.ok) {
      toast({ title: "Dynamic Duo formed!", description: "You can now see each other's progress and answer SOS calls." });
      setJoinCode("");
    }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // ---------- No partnership: invite / join ----------
  if (!duo?.partner) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg font-medium text-white">
              <HeartHandshake className="h-5 w-5 text-violet-300" /> The Dynamic Duo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-slate-400">
            <p>
              Recovery sticks when someone walks beside you. Pair with a friend to share daily
              progress, receive their SOS alerts the moment they struggle, and jump on a voice or
              video call with one tap. Both of you see the same dashboard — no hiding, no shame,
              just honest support.
            </p>
            <Separator className="bg-white/10" />
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Invite */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-2 flex items-center gap-2 font-medium text-white">
                  <Link2 className="h-4 w-4 text-cyan-300" /> Invite a friend
                </h3>
                <p className="mb-3 text-xs text-slate-400">Generate a code and share it with the person who keeps you honest.</p>
                {inviteCode ? (
                  <button
                    onClick={() => copyCode(inviteCode)}
                    className="flex w-full items-center justify-between rounded-lg border border-violet-400/30 bg-violet-500/10 px-4 py-3 font-mono text-lg tracking-widest text-violet-200 transition hover:bg-violet-500/20"
                  >
                    {inviteCode}
                    {copied ? <CheckCheck className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                  </button>
                ) : (
                  <Button onClick={createInvite} disabled={busy !== null}
                    className="w-full bg-gradient-to-r from-cyan-500 to-sky-500 text-white hover:from-cyan-400 hover:to-sky-400">
                    {busy === "invite" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                    Generate invite code
                  </Button>
                )}
              </div>
              {/* Join */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-2 flex items-center gap-2 font-medium text-white">
                  <Users className="h-4 w-4 text-violet-300" /> Join a friend
                </h3>
                <p className="mb-3 text-xs text-slate-400">Got a code from your friend? Enter it to form your duo.</p>
                <div className="flex gap-2">
                  <Input
                    value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="DR-XXXXXX" maxLength={12}
                    className="border-white/10 bg-white/5 font-mono tracking-widest text-white placeholder:text-slate-600 focus-visible:ring-violet-400"
                  />
                  <Button onClick={acceptInvite} disabled={busy !== null || !joinCode.trim()}
                    className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400">
                    {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Active partnership: shared dashboard ----------
  const partner = duo.partner;
  const pPct = Math.round((partner.today.minutesUsed / Math.max(partner.today.targetMin, 1)) * 100);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Partner panel */}
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base font-medium text-slate-200">
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-sky-300" /> Your partner</span>
              <Badge variant="outline" className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg"
                style={{ background: `linear-gradient(135deg, ${partner.avatarColor}, #312e81)` }}
              >
                {partner.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="text-lg font-semibold text-white">{partner.name}</p>
                <p className="text-xs text-slate-400">
                  Streak: {partner.streak} day{partner.streak === 1 ? "" : "s"} · {partner.totalPoints} XP
                </p>
              </div>
              <Badge className={partner.today.metTarget
                ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                : "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"}>
                {partner.today.metTarget ? "Under target" : `Over by ${formatHm(partner.today.minutesUsed - partner.today.targetMin)}`}
              </Badge>
            </div>

            {/* Partner's target status — the shared accountability view */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-300">Did they meet today&apos;s target?</span>
                <span className="font-semibold text-white">{pPct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${partner.today.metTarget ? "bg-gradient-to-r from-emerald-400 to-cyan-400" : "bg-gradient-to-r from-rose-500 to-amber-400"}`}
                  style={{ width: `${Math.min(pPct, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatHm(partner.today.minutesUsed)} used of {formatHm(partner.today.targetMin)} target
              </p>
            </div>

            {/* Partner top apps */}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-300">Their top apps today</p>
              {partner.today.topApps.length === 0 ? (
                <p className="text-xs text-slate-500">No usage synced yet today.</p>
              ) : (
                <div className="space-y-1.5">
                  {partner.today.topApps.slice(0, 4).map((a) => (
                    <div key={a.name} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm">
                      <span className="text-slate-200">{a.name}</span>
                      <span className="text-slate-400">{formatHm(a.minutes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Call buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onCall("voice")}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400">
                <Phone className="mr-2 h-4 w-4" /> Voice call
              </Button>
              <Button onClick={() => onCall("video")}
                className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-400 hover:to-cyan-400">
                <Video className="mr-2 h-4 w-4" /> Video call
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => action({ action: "unbind" }, "unbind")}
              className="w-full text-slate-500 hover:bg-white/5 hover:text-rose-300">
              <Scissors className="mr-2 h-3.5 w-3.5" /> Unbind duo
            </Button>
          </CardContent>
        </Card>

        {/* My status + SOS */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-slate-200">What they see about you</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-around gap-4">
              <ProgressRing
                usedMinutes={duo.me?.today.minutesUsed ?? 0}
                targetMinutes={duo.me?.today.targetMin ?? 360}
                size={140} stroke={10} label="your usage"
              />
              <p className="max-w-40 text-xs leading-relaxed text-slate-400">
                Your partner sees whether you met the target and your top apps — the same honest
                mirror you see of them.
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
                <Siren className="h-4 w-4 text-rose-300" /> Panic button
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <SOSButton hasPartner partnerName={partner.name} size="lg" onSent={onRefresh} />
              {sos && sos.sent.length > 0 && (
                <div className="w-full space-y-1.5 pt-1">
                  {sos.sent.slice(0, 3).map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs">
                      <span className="truncate text-slate-300">{a.message}</span>
                      <span className="ml-2 flex shrink-0 items-center gap-1 text-slate-500">
                        {a.status === "ACKNOWLEDGED" ? (
                          <><CheckCheck className="h-3.5 w-3.5 text-emerald-300" /> seen</>
                        ) : (
                          <><Clock className="h-3.5 w-3.5" /> sent</>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
