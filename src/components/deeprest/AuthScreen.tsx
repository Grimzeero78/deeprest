"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, Loader2, MoonStar, ShieldCheck } from "lucide-react";
import { RankIcon } from "./RankIcons";

interface AuthScreenProps {
  onAuthed: () => void;
}

export function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hint, setHint] = useState("");
  const [loginHint, setLoginHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoginHint(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match. Please check both fields.");
      return;
    }

    setLoading(true);
    try {
      const payload =
        mode === "register"
          ? { name, password, confirmPassword, hint }
          : { name, password };
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        // Failed sign-in: surface the stored hint (if the user saved one).
        if (mode === "login" && data.hint) setLoginHint(data.hint);
        return;
      }
      onAuthed();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#070B1E] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* ambient gradients */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[500px] w-[500px] rounded-full bg-sky-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-fuchsia-600/10 blur-[140px]" />

      <div className="relative z-10 grid w-full max-w-4xl gap-8 lg:grid-cols-2 lg:gap-14 items-center">
        {/* Brand panel */}
        <div className="hidden lg:block">
          <div className="mb-6 flex items-center gap-3">
            <MoonStar className="h-8 w-8 text-violet-300" />
            <span className="text-2xl font-semibold tracking-tight">DeepRest</span>
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Take your life back,
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
              one restful day at a time.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-slate-400 leading-relaxed">
            A calm, gamified path out of screen addiction. Hit your 6-hour target, climb ten ranks,
            talk to AI companions who understand, and bring a friend along as your Dynamic Duo.
          </p>
          <div className="mt-8 flex items-start gap-10">
            <div className="flex flex-col items-center gap-2">
              <RankIcon icon="guardian" color="#eab308" colorEnd="#fde047" size={56} />
              <span className="text-xs text-slate-400">10 ranks to master</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <RankIcon icon="luminary" color="#a855f7" colorEnd="#d8b4fe" size={56} />
              <span className="text-xs text-slate-400">3 AI companions</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <RankIcon icon="master" color="#8b5cf6" colorEnd="#f0abfc" size={56} />
              <span className="text-xs text-slate-400">1 accountability duo</span>
            </div>
          </div>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            No email needed · JWT-secured · Chats encrypted at rest (AES-256-GCM)
          </div>
        </div>

        {/* Auth card */}
        <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-violet-950/40">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <MoonStar className="h-6 w-6 text-violet-300" />
              <span className="text-xl font-semibold">DeepRest</span>
            </div>
            <h2 className="text-xl font-semibold text-white">
              {mode === "login" ? "Welcome back" : "Begin your rest"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "login"
                ? "Sign in with your name and password — no email needed."
                : "Just a name and password — your rank journey starts at Restless."}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-slate-300">
                  {mode === "login" ? "Your name" : "Choose a name"}
                </Label>
                <Input
                  id="name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Alex" required minLength={2} maxLength={40}
                  autoComplete="username"
                  className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                  required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-400"
                />
              </div>

              {mode === "register" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-slate-300">Confirm password</Label>
                    <Input
                      id="confirmPassword" type="password" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Type the same password again"
                      required minLength={8} autoComplete="new-password"
                      className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-400"
                    />
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="text-xs text-amber-300">Passwords don&apos;t match yet.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hint" className="text-slate-300">
                      Password hint <span className="text-slate-500">(optional)</span>
                    </Label>
                    <Input
                      id="hint" value={hint} onChange={(e) => setHint(e.target.value)}
                      placeholder="e.g. my usual phrase + the year"
                      maxLength={120}
                      className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-400"
                    />
                    <p className="text-xs text-slate-500">
                      Shown to you only if a sign-in attempt fails. Never store the password itself here.
                    </p>
                  </div>
                </>
              )}

              {error && (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              {loginHint && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span>
                    Your hint: <span className="font-medium">{loginHint}</span>
                  </span>
                </div>
              )}

              <Button
                type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-400">
              {mode === "login" ? "New to DeepRest?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                  setLoginHint(null);
                }}
                className="font-medium text-violet-300 underline-offset-4 hover:underline"
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
