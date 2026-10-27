"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Send, Loader2, UsersRound, MessageSquarePlus, ArrowLeft, LogOut,
  Crown, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { RankIcon } from "./RankIcons";
import { MemberProfileDialog } from "./MemberProfileDialog";
import type { MeResponse, ConversationListItem, CommunityMessage, PublicUser } from "./types";

const GROUP_EMOJIS = ["🌙", "🔥", "💪", "🛡️", "🙏", "✝️", "🌅", "🌿", "🏔️", "⭐", "🦁", "🕊️"];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface Props {
  me: MeResponse;
  onUnreadTotal?: (total: number) => void;
}

export function CommunityView({ me, onUnreadTotal }: Props) {
  const [convos, setConvos] = useState<ConversationListItem[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [filter, setFilter] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [msgsLoaded, setMsgsLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [dirOpen, setDirOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);

  const [dirQuery, setDirQuery] = useState("");
  const [dirUsers, setDirUsers] = useState<PublicUser[]>([]);
  const [dirLoading, setDirLoading] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [groupEmoji, setGroupEmoji] = useState("🌙");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const activeConvo = convos.find((c) => c.id === activeId) || null;

  // ---------- conversation list (poll 10s) ----------
  const loadConvos = useCallback(async () => {
    try {
      const res = await fetch("/api/social/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConvos(data.conversations || []);
      const total = (data.conversations || []).reduce((n: number, c: ConversationListItem) => n + (c.unreadCount || 0), 0);
      onUnreadTotal?.(total);
    } finally {
      setListLoaded(true);
    }
  }, [onUnreadTotal]);

  useEffect(() => {
    loadConvos();
    const t = setInterval(loadConvos, 10_000);
    return () => clearInterval(t);
  }, [loadConvos]);

  // ---------- messages (poll 4s while a chat is open) ----------
  const loadMessages = useCallback(async (convoId: string, markRead: boolean) => {
    const res = await fetch(`/api/social/conversations/${convoId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
    setMsgsLoaded(true);
    if (markRead) {
      await fetch(`/api/social/conversations/${convoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setMsgsLoaded(false);
    setMessages([]);
    loadMessages(activeId, true);
    const t = setInterval(() => loadMessages(activeId, true), 4_000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, msgsLoaded]);

  // ---------- directory (debounced search, shared by DM + group dialogs) ----------
  useEffect(() => {
    if (!dirOpen && !groupOpen) return;
    const t = setTimeout(async () => {
      setDirLoading(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(dirQuery)}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setDirUsers((data.users || []).filter((u: PublicUser) => u.id !== me.user.id));
        }
      } finally {
        setDirLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [dirQuery, dirOpen, groupOpen, me.user.id]);

  // ---------- actions ----------
  async function openDm(userId: string) {
    const res = await fetch("/api/social/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "dm", userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Could not open chat", description: data.error, variant: "destructive" });
      return;
    }
    setDirOpen(false);
    setProfileUser(null);
    setActiveId(data.conversationId);
    loadConvos();
  }

  async function createGroup() {
    if (groupName.trim().length < 2 || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/social/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "group", name: groupName, emoji: groupEmoji, memberIds: groupMembers }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not create group", description: data.error, variant: "destructive" });
        return;
      }
      setGroupOpen(false);
      setGroupName("");
      setGroupMembers([]);
      setActiveId(data.conversationId);
      loadConvos();
      toast({ title: "Group created", description: "Say something to get the conversation going." });
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setInput("");
    setSending(true);
    const optimistic: CommunityMessage = {
      id: `tmp-${Date.now()}`,
      body: text,
      kind: "text",
      createdAt: new Date().toISOString(),
      senderId: me.user.id,
      senderName: me.user.name,
      senderColor: me.user.avatarColor,
      senderImage: me.user.avatarImage,
      senderEmoji: me.user.avatarEmoji,
      mine: true,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch(`/api/social/conversations/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Message failed", description: data.error, variant: "destructive" });
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        return;
      }
      setMessages((m) => m.map((x) => (x.id === optimistic.id ? { ...data.message, mine: true } : x)));
      loadConvos();
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function leaveGroup() {
    if (!activeConvo || leaving) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/social/conversations/${activeConvo.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Could not leave group", description: data.error, variant: "destructive" });
        return;
      }
      setInfoOpen(false);
      setActiveId(null);
      loadConvos();
      toast({ title: `You left ${activeConvo.name}` });
    } finally {
      setLeaving(false);
    }
  }

  const filtered = convos.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  // ---------- render ----------
  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] lg:grid-cols-[350px_1fr] lg:h-[calc(100dvh-11rem)]">
      {/* ----- chat list ----- */}
      <aside className={cn("flex min-h-0 flex-col border-white/10 lg:border-r", activeId && "hidden lg:flex")}>
        <div className="space-y-3 border-b border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Chats</h2>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => { setDirQuery(""); setDirOpen(true); }}
                className="h-8 border-white/15 bg-white/5 text-xs text-slate-200 hover:bg-white/10 hover:text-white">
                <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" /> New chat
              </Button>
              <Button size="sm" onClick={() => { setDirQuery(""); setGroupMembers([]); setGroupEmoji("🌙"); setGroupOpen(true); }}
                className="h-8 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-xs text-white hover:from-violet-400 hover:to-fuchsia-400">
                <UsersRound className="mr-1.5 h-3.5 w-3.5" /> New group
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search chats"
              className="h-9 border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-slate-500" />
          </div>
        </div>

        <div className="deeprest-scroll min-h-0 flex-1 overflow-y-auto">
          {!listLoaded && (
            <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
          )}
          {listLoaded && filtered.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
                <MessageCircle className="h-7 w-7" />
              </span>
              <p className="text-sm font-medium text-slate-200">No chats yet</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Tap <span className="text-slate-300">New chat</span> to message someone privately, or <span className="text-slate-300">New group</span> to gather your accountability crew.
              </p>
            </div>
          )}
          {filtered.map((c) => {
            const active = c.id === activeId;
            const preview = c.lastMessage
              ? c.lastMessage.kind === "system"
                ? c.lastMessage.body
                : c.kind === "group"
                  ? `${c.lastMessage.senderId === me.user.id ? "You" : c.lastMessage.senderName.split(" ")[0]}: ${c.lastMessage.body}`
                  : c.lastMessage.senderId === me.user.id ? `You: ${c.lastMessage.body}` : c.lastMessage.body
              : "Say hi 👋";
            return (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-left transition",
                  active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                )}>
                {c.kind === "dm" && c.peer ? (
                  <Avatar name={c.peer.name} color={c.peer.avatarColor} image={c.peer.avatarImage} emoji={c.peer.avatarEmoji} size={46} />
                ) : (
                  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/80 to-fuchsia-600/80 text-xl">{c.emoji || "🌙"}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">{c.name}</span>
                    {c.lastMessage && <span className="shrink-0 text-[10px] text-slate-500">{fmtTime(c.lastMessage.createdAt)}</span>}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={cn("truncate text-xs", c.lastMessage?.kind === "system" ? "italic text-slate-500" : "text-slate-400")}>{preview}</span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">{c.unreadCount}</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ----- chat pane ----- */}
      <section className={cn("flex min-h-0 flex-col", !activeId && "hidden lg:flex")}>
        {!activeConvo ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><MessageCircle className="h-8 w-8" /></span>
            <p className="text-sm text-slate-400">Pick a chat, or start a new one.</p>
          </div>
        ) : (
          <>
            {/* chat header */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.02] px-3 py-2.5">
              <Button variant="ghost" size="icon" onClick={() => setActiveId(null)} aria-label="Back to chats"
                className="h-9 w-9 shrink-0 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden">
                <ArrowLeft className="h-4.5 w-4.5" />
              </Button>
              {activeConvo.kind === "dm" && activeConvo.peer ? (
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setProfileUser({ ...activeConvo.peer, isMe: false } as PublicUser)}>
                  <Avatar name={activeConvo.peer.name} color={activeConvo.peer.avatarColor} image={activeConvo.peer.avatarImage} emoji={activeConvo.peer.avatarEmoji} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{activeConvo.peer.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <RankIcon icon={activeConvo.peer.rank.current.icon} color={activeConvo.peer.rank.current.color} colorEnd={activeConvo.peer.rank.current.colorEnd} size={14} />
                      Lv.{activeConvo.peer.rank.current.level} {activeConvo.peer.rank.current.name}
                    </span>
                  </span>
                </button>
              ) : (
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setInfoOpen(true)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/80 to-fuchsia-600/80 text-lg">{activeConvo.emoji || "🌙"}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{activeConvo.name}</span>
                    <span className="block text-xs text-slate-400">{activeConvo.memberCount} member{activeConvo.memberCount === 1 ? "" : "s"} · tap for info</span>
                  </span>
                </button>
              )}
            </div>

            {/* messages */}
            <div ref={scrollRef} className="deeprest-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-4">
              {!msgsLoaded && (
                <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
              )}
              {msgsLoaded && messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-medium text-slate-300">No messages yet</p>
                  <p className="text-xs text-slate-500">Send the first message — keep each other accountable.</p>
                </div>
              )}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const showDay = !prev || new Date(m.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
                if (m.kind === "system") {
                  return (
                    <div key={m.id}>
                      {showDay && <DaySeparator iso={m.createdAt} />}
                      <p className="my-1 text-center text-[11px] italic text-slate-500">{m.body}</p>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] sm:max-w-[70%]", !m.mine && "flex items-end gap-2")}>
                      {!m.mine && (
                        <button onClick={() => openSenderProfile(m)} aria-label={`View ${m.senderName}`}>
                          <Avatar name={m.senderName} color={m.senderColor} image={m.senderImage} emoji={m.senderEmoji} size={26} />
                        </button>
                      )}
                      <div className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-md",
                        m.mine
                          ? "rounded-br-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-violet-950/30"
                          : "rounded-bl-md border border-white/10 bg-white/[0.06] text-slate-100"
                      )}>
                        {!m.mine && activeConvo.kind === "group" && (
                          <button onClick={() => openSenderProfile(m)} className="mb-0.5 block text-xs font-semibold text-violet-300 hover:underline">
                            {m.senderName}
                          </button>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cn("mt-1 text-right text-[10px]", m.mine ? "text-white/70" : "text-slate-500")}>{fmtTime(m.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* composer */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message ${activeConvo.kind === "group" ? activeConvo.name : activeConvo.name.split(" ")[0]}…`}
                  rows={1}
                  className="max-h-32 min-h-11 flex-1 resize-none border-white/10 bg-white/5 py-3 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-400"
                  maxLength={2000}
                />
                <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon" aria-label="Send"
                  className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ----- directory dialog (start DM) ----- */}
      <Dialog open={dirOpen} onOpenChange={setDirOpen}>
        <DialogContent className="max-h-[80vh] border-white/10 bg-[#0d1228] text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white"><MessageSquarePlus className="h-4 w-4 text-violet-300" /> Start a chat</DialogTitle>
            <DialogDescription className="text-slate-400">Pick someone from the DeepRest community.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input autoFocus value={dirQuery} onChange={(e) => setDirQuery(e.target.value)} placeholder="Search by name"
              className="h-9 border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-slate-500" />
          </div>
          <div className="deeprest-scroll max-h-80 space-y-1 overflow-y-auto">
            {dirLoading && <div className="flex h-16 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>}
            {!dirLoading && dirUsers.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No members found{dirQuery ? ` for “${dirQuery}”` : " yet"}.</p>
            )}
            {dirUsers.map((u) => (
              <button key={u.id} onClick={() => openDm(u.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-white/10 hover:bg-white/[0.06]">
                <Avatar name={u.name} color={u.avatarColor} image={u.avatarImage} emoji={u.avatarEmoji} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{u.name} {u.isMe && <span className="text-xs text-slate-500">(you)</span>}</span>
                  <span className="block truncate text-xs text-slate-400">@{u.username}{u.bio ? ` · ${u.bio}` : ""}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <RankIcon icon={u.rank.current.icon} color={u.rank.current.color} colorEnd={u.rank.current.colorEnd} size={16} />
                  <span className="text-[10px] text-slate-300">Lv.{u.rank.current.level}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ----- create group dialog ----- */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#0d1228] text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white"><UsersRound className="h-4 w-4 text-violet-300" /> Create a group</DialogTitle>
            <DialogDescription className="text-slate-400">Name it, pick an icon, choose members.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/80 to-fuchsia-600/80 text-2xl">{groupEmoji}</span>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name, e.g. Screen-Free Squad"
                maxLength={60} className="border-white/10 bg-white/5 text-white placeholder:text-slate-500" />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-slate-400">Group icon</p>
              <div className="flex flex-wrap gap-1.5">
                {GROUP_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setGroupEmoji(e)} aria-pressed={groupEmoji === e}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-lg transition",
                      groupEmoji === e ? "bg-violet-500/30 ring-1 ring-violet-400" : "bg-white/5 hover:bg-white/10")}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs text-slate-400">Members ({groupMembers.length} selected)</p>
              <Input value={dirQuery} onChange={(e) => setDirQuery(e.target.value)} placeholder="Search members"
                className="mb-2 h-9 border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500" />
              <div className="deeprest-scroll max-h-52 space-y-1 overflow-y-auto">
                {dirLoading && <div className="flex h-12 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>}
                {!dirLoading && dirUsers.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No other members found.</p>}
                {dirUsers.map((u) => {
                  const checked = groupMembers.includes(u.id);
                  return (
                    <button key={u.id}
                      onClick={() => setGroupMembers((ids) => checked ? ids.filter((x) => x !== u.id) : [...ids, u.id])}
                      className={cn("flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition",
                        checked ? "border-violet-400/40 bg-violet-500/10" : "border-transparent hover:border-white/10 hover:bg-white/[0.05]")}>
                      <Avatar name={u.name} color={u.avatarColor} image={u.avatarImage} emoji={u.avatarEmoji} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{u.name}</span>
                        <span className="block truncate text-xs text-slate-400">Lv.{u.rank.current.level} {u.rank.current.name}</span>
                      </span>
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                        checked ? "border-violet-400 bg-violet-500 text-white" : "border-white/20")}>
                        {checked ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setGroupOpen(false)} className="text-slate-300 hover:bg-white/10 hover:text-white">Cancel</Button>
            <Button onClick={createGroup} disabled={creating || groupName.trim().length < 2}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- group info dialog ----- */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#0d1228] text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/80 to-fuchsia-600/80 text-lg">{activeConvo?.emoji || "🌙"}</span>
              {activeConvo?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">{activeConvo?.memberCount} member{activeConvo?.memberCount === 1 ? "" : "s"}</DialogDescription>
          </DialogHeader>
          <div className="deeprest-scroll max-h-72 space-y-1 overflow-y-auto">
            {(activeConvo?.members || []).map((m) => (
              <button key={m.id} onClick={() => { setProfileUser(m); setInfoOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-white/10 hover:bg-white/[0.06]">
                <Avatar name={m.name} color={m.avatarColor} image={m.avatarImage} emoji={m.avatarEmoji} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                    {m.name} {m.isMe && <span className="text-xs text-slate-500">(you)</span>}
                    {m.isCreator && <Crown className="h-3 w-3 text-amber-300" />}
                  </span>
                  <span className="block truncate text-xs text-slate-400">Lv.{m.rank.current.level} {m.rank.current.name} · {m.totalPoints} XP</span>
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={leaveGroup} disabled={leaving}
              className="border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200">
              {leaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />} Leave group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- member profile ----- */}
      <MemberProfileDialog user={profileUser} open={profileUser !== null} onOpenChange={(v) => !v && setProfileUser(null)} onMessage={openDm} />
    </div>
  );

  function openSenderProfile(m: CommunityMessage) {
    const fromList = activeConvo?.kind === "group"
      ? activeConvo.members?.find((x) => x.id === m.senderId)
      : null;
    if (fromList) {
      setProfileUser(fromList);
    } else if (activeConvo?.peer && activeConvo.peer.id === m.senderId) {
      setProfileUser({ ...activeConvo.peer, isMe: false } as PublicUser);
    } else if (m.senderId === me.user.id) {
      // own profile — open via profile view instead
      setProfileUser(null);
    } else {
      // fall back to a minimal profile from the message itself
      setProfileUser({
        id: m.senderId, name: m.senderName, username: "", avatarColor: m.senderColor,
        avatarImage: m.senderImage, avatarEmoji: m.senderEmoji, bio: null,
        totalPoints: 0, streak: 0,
        memberSince: new Date().toISOString(),
        rank: { current: { level: 1, name: "…", minXp: 0, icon: "restless", color: "#64748b", colorEnd: "#94a3b8", tagline: "" }, next: null, progressPercent: 0, xpToNext: 0 },
      });
    }
  }
}

function DaySeparator({ iso }: { iso: string }) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const label = d.toDateString() === now.toDateString()
    ? "Today"
    : d.toDateString() === yesterday.toDateString()
      ? "Yesterday"
      : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return (
    <div className="my-2 flex items-center gap-3">
      <span className="h-px flex-1 bg-white/10" />
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
