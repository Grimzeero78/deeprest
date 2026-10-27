"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Loader2, Trophy, Flame, KeyRound, Smile, Trash2, ShieldCheck, Info, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { RankIcon } from "./RankIcons";
import type { MeResponse } from "./types";

const COLORS = ["#8b5cf6", "#f97316", "#10b981", "#06b6d4", "#f43f5e", "#eab308", "#a855f7", "#14b8a6"];
const EMOJIS = ["😀", "😎", "🦁", "🌟", "🌙", "🔥", "🛡️", "🙏", "🌿", "🚀", "⚡", "🕊️"];

interface Props {
  me: MeResponse;
  onRefresh: () => void;
}

export function ProfileView({ me, onRefresh }: Props) {
  const { user, rank } = me;
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "");
  const [avatarImage, setAvatarImage] = useState<string | null>(user.avatarImage);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(user.avatarEmoji);
  const [color, setColor] = useState(user.avatarColor);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const dirty =
    name !== user.name || bio !== (user.bio || "") || avatarImage !== user.avatarImage ||
    avatarEmoji !== user.avatarEmoji || color !== user.avatarColor;

  async function pickPhoto(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const size = 220;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = url;
    }).catch(() => null);
    if (!dataUrl) {
      toast({ title: "Could not read that image", description: "Try a JPG or PNG.", variant: "destructive" });
      return;
    }
    setAvatarImage(dataUrl);
    setAvatarEmoji(null);
  }

  async function saveProfile() {
    if (savingProfile || !dirty) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, avatarColor: color, avatarImage, avatarEmoji }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not save profile", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Profile updated", description: "Your new look is live across the community." });
      onRefresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (savingPw) return;
    if (newPw.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not change password", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Password changed", description: "Use the new one next time you sign in." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwOpen(false);
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
      {/* left: identity editor */}
      <Card className="border-white/10 bg-white/[0.04] lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
            <Smile className="h-4 w-4 text-violet-300" /> Your profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* avatar row */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar name={name || user.name} color={color} image={avatarImage} emoji={avatarEmoji} size={96} ring />
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Upload profile photo"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg transition hover:from-violet-400 hover:to-fuchsia-400"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); e.target.value = ""; }}
              />
            </div>
            <div className="w-full flex-1 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-name" className="text-xs text-slate-400">Display name</Label>
                <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
                  className="border-white/10 bg-white/5 text-white" />
                <p className="text-[11px] text-slate-500">You sign in as <span className="text-slate-300">{user.username}</span> — that never changes.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-bio" className="text-xs text-slate-400">About</Label>
                <Input id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160}
                  placeholder="e.g. Offline after 8pm. One day at a time."
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-600" />
              </div>
            </div>
          </div>

          {/* emoji + color pickers */}
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs text-slate-400">Or use an emoji avatar</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button key={e} aria-pressed={avatarEmoji === e && !avatarImage}
                    onClick={() => { setAvatarEmoji(e); setAvatarImage(null); }}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-lg transition",
                      avatarEmoji === e && !avatarImage ? "bg-violet-500/30 ring-1 ring-violet-400" : "bg-white/5 hover:bg-white/10")}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-slate-400">Signature colour</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} aria-pressed={color === c} onClick={() => setColor(c)}
                    className={cn("h-8 w-8 rounded-full transition",
                      color === c ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0d1228]" : "hover:scale-110")}
                    style={{ background: `linear-gradient(135deg, ${c}, ${c}99)` }} />
                ))}
              </div>
            </div>
            {avatarImage && (
              <Button variant="outline" size="sm" onClick={() => setAvatarImage(null)}
                className="border-white/15 bg-white/5 text-xs text-slate-300 hover:bg-white/10">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove photo
              </Button>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={!dirty || savingProfile}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400">
              {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* right: rank + security */}
      <div className="space-y-4 sm:space-y-6 lg:col-span-2">
        <Card className="relative overflow-hidden border-white/10 bg-white/[0.04]">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <Trophy className="h-4 w-4 text-amber-300" /> Rank progress
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-5 text-center">
            <RankIcon icon={rank.current.icon} color={rank.current.color} colorEnd={rank.current.colorEnd} size={88} />
            <h3 className="mt-3 text-lg font-semibold text-white">Lv.{rank.current.level} {rank.current.name}</h3>
            <p className="text-sm text-slate-400">{rank.current.tagline}</p>
            <div className="mt-4 w-full">
              <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                <span>{user.totalPoints} XP</span>
                {rank.next && <span>{rank.next.minXp - user.totalPoints} XP to {rank.next.name}</span>}
              </div>
              <Progress value={rank.progressPercent} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-400 [&>div]:to-fuchsia-400" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
              <Badge variant="outline" className="border-orange-400/30 bg-orange-500/10 text-orange-300">
                <Flame className="mr-1 h-3 w-3" /> {user.streak} day streak
              </Badge>
              {user.memberSince && (
                <span className="text-slate-500">
                  joined {new Date(user.memberSince).toLocaleDateString([], { month: "short", year: "numeric" })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-300" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-400">
              If Chrome flagged your password as appearing in a data breach, that check comes from public breach
              lists — the fix is choosing a new, unique password. Pick one you don&apos;t use anywhere else.
            </p>
            {!pwOpen ? (
              <Button onClick={() => setPwOpen(true)} variant="outline"
                className="w-full border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">
                <KeyRound className="mr-2 h-4 w-4" /> Change password
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pf-pw-cur" className="text-xs text-slate-400">Current password</Label>
                  <Input id="pf-pw-cur" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="border-white/10 bg-white/5 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pf-pw-new" className="text-xs text-slate-400">New password (8+ characters)</Label>
                  <Input id="pf-pw-new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="border-white/10 bg-white/5 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pf-pw-con" className="text-xs text-slate-400">Confirm new password</Label>
                  <Input id="pf-pw-con" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="border-white/10 bg-white/5 text-white" />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setPwOpen(false)} className="flex-1 text-slate-300 hover:bg-white/10">Cancel</Button>
                  <Button onClick={changePassword} disabled={savingPw || !currentPw || !newPw}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400">
                    {savingPw ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-slate-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
              Chats are AES-256 encrypted at rest and your password is stored as a salted PBKDF2 hash — nobody (including us) can read it.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
