"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallState } from "./types";

// ============================================================
// CallOverlay — simulates the WebRTC / Cloudflare Calls flow:
// outgoing ringing -> connected (with live timer + optional local
// camera preview via getUserMedia) -> ended. Signaling runs through
// /api/call (CallSession state machine), so both partners see the
// same state by polling.
// ============================================================

interface CallOverlayProps {
  call: CallState;
  onAction: (callId: string, action: "answer" | "decline" | "end") => void;
}

export function CallOverlay({ call, onAction }: CallOverlayProps) {
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(call.modality === "voice");
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer counts from answer
  useEffect(() => {
    if (call.status !== "ACTIVE" || !call.answeredAt) return;
    const t = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(call.answeredAt!).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [call.status, call.answeredAt]);

  // Try to open local camera/mic preview for video calls
  useEffect(() => {
    let cancelled = false;
    async function openMedia() {
      if (call.status !== "ACTIVE" || call.modality !== "video") return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        // No camera permission in sandbox — call continues in simulated avatar mode
      }
    }
    openMedia();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [call.status, call.modality]);

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const incoming = call.status === "RINGING" && !call.isCaller;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05081a]/95 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Call in progress">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[130px]" />
        <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[110px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 px-6 py-10 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-violet-300/80">
          {call.status === "RINGING"
            ? incoming ? "Incoming call" : "Ringing"
            : call.status === "ACTIVE"
              ? call.modality === "video" ? "Video call" : "Voice call"
              : "Call ended"}
        </p>

        <div className="relative">
          <span
            className="flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold text-white shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${call.peerColor}, #312e81)` }}
          >
            {call.peerName.slice(0, 1).toUpperCase()}
          </span>
          {call.status === "RINGING" && (
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-violet-400/40" />
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">{call.peerName}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {call.status === "RINGING"
              ? "Dynamic Duo · DeepRest"
              : call.status === "ACTIVE" ? fmt(elapsed) : "Thanks for showing up for each other."}
          </p>
        </div>

        {/* Local video preview */}
        {call.status === "ACTIVE" && call.modality === "video" && (
          <div className="relative h-44 w-64 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-slate-200">You</span>
          </div>
        )}

        {/* Controls */}
        {call.status === "RINGING" && incoming ? (
          <div className="flex items-center gap-6">
            <Button
              onClick={() => onAction(call.id, "decline")}
              size="icon" aria-label="Decline call"
              className="h-14 w-14 rounded-full bg-gradient-to-br from-rose-600 to-red-500 text-white hover:from-rose-500 hover:to-red-400"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              onClick={() => onAction(call.id, "answer")}
              size="icon" aria-label="Answer call"
              className="h-16 w-16 animate-pulse rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white hover:from-emerald-400 hover:to-teal-300"
            >
              <Phone className="h-7 w-7" />
            </Button>
          </div>
        ) : call.status === "RINGING" ? (
          <Button
            onClick={() => onAction(call.id, "end")}
            variant="outline"
            className="gap-2 border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Ringing… tap to cancel
          </Button>
        ) : call.status === "ACTIVE" ? (
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setMuted(!muted)} size="icon" aria-label={muted ? "Unmute" : "Mute"}
              className={cn("h-12 w-12 rounded-full", muted ? "bg-white/90 text-slate-900" : "bg-white/10 text-white hover:bg-white/20")}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            {call.modality === "video" && (
              <Button
                onClick={() => setCamOff(!camOff)} size="icon" aria-label={camOff ? "Turn camera on" : "Turn camera off"}
                className={cn("h-12 w-12 rounded-full", camOff ? "bg-white/90 text-slate-900" : "bg-white/10 text-white hover:bg-white/20")}
              >
                {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            )}
            <Button
              onClick={() => onAction(call.id, "end")} size="icon" aria-label="End call"
              className="h-14 w-14 rounded-full bg-gradient-to-br from-rose-600 to-red-500 text-white hover:from-rose-500 hover:to-red-400"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">This overlay will close in a moment…</p>
        )}
      </div>
    </div>
  );
}
