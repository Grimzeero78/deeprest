"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, MessagesSquare, Users, MoonStar, LogOut, Siren, Phone, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthScreen } from "@/components/deeprest/AuthScreen";
import { Dashboard } from "@/components/deeprest/Dashboard";
import { ChatView } from "@/components/deeprest/ChatView";
import { DuoView } from "@/components/deeprest/DuoView";
import { CallOverlay } from "@/components/deeprest/CallOverlay";
import { RankIcon } from "@/components/deeprest/RankIcons";
import type { MeResponse, DuoResponse, SosResponse, CallState, ViewId } from "@/components/deeprest/types";

const CRON_KEY = "deeprest-dev-cron"; // matches CRON_SECRET default in /api/cron/evaluate

export default function DeepRestPage() {
  const [phase, setPhase] = useState<"loading" | "auth" | "app">("loading");
  const [view, setView] = useState<ViewId>("dashboard");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [duo, setDuo] = useState<DuoResponse | null>(null);
  const [sos, setSos] = useState<SosResponse | null>(null);
  const [call, setCall] = useState<CallState | null>(null);
  const [incomingSos, setIncomingSos] = useState<SosResponse["received"][number] | null>(null);

  const prevXp = useRef<number | null>(null);
  const { toast } = useToast();

  // ---------- data loaders ----------
  const fetchMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.status === 401) {
      setPhase("auth");
      return null;
    }
    const data: MeResponse = await res.json();
    setMe(data);

    // Rank change detection (cron evaluation flows through here)
    if (prevXp.current !== null && data.user.totalPoints !== prevXp.current) {
      const delta = data.user.totalPoints - prevXp.current;
      if (delta > 0) {
        toast({
          title: `+${delta} XP — target met`,
          description: `${data.rank.current.name} (Lv.${data.rank.current.level}) · ${data.user.totalPoints} XP total`,
        });
      } else {
        toast({
          title: `${delta} XP — target exceeded`,
          description: "Tomorrow is a fresh start. Your streak resets, but your rank journey continues.",
          variant: "destructive",
        });
      }
    }
    prevXp.current = data.user.totalPoints;
    return data;
  }, [toast]);

  const fetchDuo = useCallback(async () => {
    const res = await fetch("/api/duo");
    if (res.ok) setDuo(await res.json());
  }, []);

  const fetchSos = useCallback(async () => {
    const res = await fetch("/api/sos");
    if (res.ok) {
      const data: SosResponse = await res.json();
      setSos(data);
      if (data.received.length > 0) setIncomingSos((cur) => cur ?? data.received[0]);
    }
  }, []);

  const fetchCall = useCallback(async () => {
    const res = await fetch("/api/call");
    if (res.ok) {
      const data = await res.json();
      setCall(data.call);
    }
  }, []);

  // ---------- boot ----------
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const data = await fetchMe();
        if (cancelled) return;
        if (data) {
          setPhase("app");
          fetchDuo();
          fetchSos();
          fetchCall();
        } else {
          setPhase("auth");
        }
      } catch {
        if (!cancelled) setPhase("auth");
      }
    };
    const t = setTimeout(boot, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fetchMe, fetchDuo, fetchSos, fetchCall]);

  // ---------- polling (realtime-lite) ----------
  useEffect(() => {
    if (phase !== "app") return;

    const meTimer = setInterval(async () => {
      // Cron Trigger equivalent: score today's usage, then refresh state
      await fetch(`/api/cron/evaluate?key=${CRON_KEY}`).catch(() => {});
      fetchMe();
    }, 45_000);

    const duoTimer = setInterval(fetchDuo, 10_000);
    const sosTimer = setInterval(fetchSos, 6_000);
    const callTimer = setInterval(fetchCall, 3_000);

    return () => {
      clearInterval(meTimer);
      clearInterval(duoTimer);
      clearInterval(sosTimer);
      clearInterval(callTimer);
    };
  }, [phase, fetchMe, fetchDuo, fetchSos, fetchCall]);

  // close overlay after call ends
  useEffect(() => {
    if (call && (call.status === "ENDED" || call.status === "DECLINED" || call.status === "MISSED")) {
      const t = setTimeout(() => setCall(null), 1600);
      return () => clearTimeout(t);
    }
  }, [call]);

  // ---------- actions ----------
  function refreshAll() {
    fetchMe();
    fetchDuo();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setDuo(null);
    setSos(null);
    setCall(null);
    prevXp.current = null;
    setPhase("auth");
  }

  async function startCall(modality: "voice" | "video") {
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modality }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Call failed", description: data.error, variant: "destructive" });
      return;
    }
    fetchCall();
  }

  async function callAction(callId: string, action: "answer" | "decline" | "end") {
    await fetch("/api/call", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId, action }),
    });
    fetchCall();
  }

  async function acknowledgeSos(id: string) {
    await fetch("/api/sos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "acknowledge" }),
    });
    setIncomingSos(null);
    fetchSos();
  }

  // ---------- render ----------
  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070B1E]">
        <div className="flex flex-col items-center gap-4">
          <MoonStar className="h-10 w-10 animate-pulse text-violet-300" />
          <span className="text-sm text-slate-400">Preparing your quiet place…</span>
        </div>
      </div>
    );
  }

  if (phase === "auth" || !me) {
    return (
      <AuthScreen
        onAuthed={() => {
          setPhase("loading");
          fetchMe().then((data) => {
            if (data) {
              setPhase("app");
              fetchDuo();
              fetchSos();
              fetchCall();
            }
          });
        }}
      />
    );
  }

  const NAV: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "companions", label: "Companions", icon: MessagesSquare },
    { id: "duo", label: "Dynamic Duo", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#070B1E] text-slate-100 flex flex-col">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/4 h-[420px] w-[420px] rounded-full bg-violet-700/15 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-sky-700/10 blur-[120px]" />
        <div className="absolute left-0 top-1/2 h-[300px] w-[300px] rounded-full bg-fuchsia-700/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070B1E]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <MoonStar className="h-6 w-6 text-violet-300" />
            <span className="text-lg font-semibold tracking-tight text-white">DeepRest</span>
          </div>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                aria-current={view === n.id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  view === n.id
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* mini rank badge */}
            <button
              onClick={() => setView("dashboard")}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 transition hover:border-violet-400/30 sm:flex"
            >
              <RankIcon icon={me.rank.current.icon} color={me.rank.current.color} colorEnd={me.rank.current.colorEnd} size={30} />
              <span className="text-xs">
                <span className="block font-semibold leading-tight text-white">{me.rank.current.name}</span>
                <span className="block leading-tight text-slate-400">{me.user.totalPoints} XP</span>
              </span>
            </button>
            <Button
              variant="ghost" size="icon" onClick={logout} aria-label="Sign out"
              className="text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:pb-10">
        {view === "dashboard" && (
          <Dashboard me={me} duo={duo} onRefresh={refreshAll} onGoDuo={() => setView("duo")} />
        )}
        {view === "companions" && <ChatView />}
        {view === "duo" && (
          <DuoView duo={duo} sos={sos} onRefresh={refreshAll} onCall={startCall} />
        )}
      </main>

      {/* Footer (sticks to bottom via flex column + mt-auto) */}
      <footer className="relative z-10 mt-auto border-t border-white/5 py-4">
        <p className="text-center text-xs text-slate-600">
          DeepRest — rest is a skill. Monitor runs on a Cron Trigger · chats encrypted at rest · you are not alone.
        </p>
      </footer>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0f24]/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary mobile"
      >
        <div className="grid grid-cols-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              aria-current={view === n.id ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition",
                view === n.id ? "text-violet-300" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Incoming SOS dialog */}
      <Dialog open={incomingSos !== null} onOpenChange={(v) => !v && setIncomingSos(null)}>
        <DialogContent className="border-rose-400/30 bg-[#160d1c] text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-300">
              <Siren className="h-5 w-5 animate-pulse" /> Your partner needs you
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {duo?.partner?.name || "Your partner"} sent an SOS alert.
            </DialogDescription>
          </DialogHeader>
          {incomingSos && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm leading-relaxed text-rose-100">
              &ldquo;{incomingSos.message}&rdquo;
            </div>
          )}
          <p className="text-xs text-slate-400">
            Call them now, or acknowledge so they know someone is here.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline" onClick={() => incomingSos && acknowledgeSos(incomingSos.id)}
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
            >
              <CheckCheck className="mr-2 h-4 w-4" /> I&apos;m here
            </Button>
            <Button
              onClick={() => {
                if (incomingSos) acknowledgeSos(incomingSos.id);
                startCall("voice");
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400"
            >
              <Phone className="mr-2 h-4 w-4" /> Call now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call overlay */}
      {call && <CallOverlay call={call} onAction={callAction} />}
    </div>
  );
}
