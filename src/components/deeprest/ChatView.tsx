"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Church, Compass, Brain, Send, Loader2, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMsg } from "./types";

type PersonaId = "SHEPHERD" | "GUIDE" | "COUNSELOR";

interface PersonaMeta {
  id: PersonaId;
  name: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string; // avatar gradient
  ring: string; // selected ring color
  blurb: string;
  disclaimer?: string;
  starters: string[];
}

const PERSONA_META: PersonaMeta[] = [
  {
    id: "SHEPHERD",
    name: "The Shepherd",
    title: "Faith & Scripture",
    icon: Church,
    gradient: "from-amber-400 to-orange-500",
    ring: "ring-amber-400/60",
    blurb: "Compassionate but firm in faith. Quotes the Bible and points you back to God.",
    starters: [
      "I keep failing even though I pray. What does God say about starting again?",
      "Give me a verse to hold onto when the urge to scroll hits at night.",
      "How do I honor God with my rest today?",
    ],
  },
  {
    id: "GUIDE",
    name: "The Guide",
    title: "Practical & secular",
    icon: Compass,
    gradient: "from-cyan-400 to-sky-500",
    ring: "ring-cyan-400/60",
    blurb: "General advice, hobbies and smart distractions that pull you off the screen.",
    starters: [
      "I have 2 free hours tonight — what should I do offline?",
      "Help me design a phone-free morning routine.",
      "I'm bored and about to open TikTok. Distract me with something better.",
    ],
  },
  {
    id: "COUNSELOR",
    name: "The Counselor",
    title: "CBT techniques",
    icon: Brain,
    gradient: "from-violet-400 to-fuchsia-500",
    ring: "ring-violet-400/60",
    blurb: "Probing questions, thought restructuring and coping mechanisms.",
    disclaimer:
      "The Counselor is an AI trained on CBT-inspired techniques. It is not a licensed doctor or therapist, and this is not medical advice. For clinical care, please consult a professional.",
    starters: [
      "Help me trace what triggered my last scrolling spiral.",
      "I always tell myself 'just five more minutes'. Break that thought down with me.",
      "Build a coping plan with me for late-night urges.",
    ],
  },
];

export function ChatView() {
  const [persona, setPersona] = useState<PersonaId>("GUIDE");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const meta = PERSONA_META.find((p) => p.id === persona)!;

  // Load history when persona changes
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetch(`/api/chat?persona=${persona}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        if (!cancelled) {
          setMessages(data.messages || []);
          setLoaded(true);
        }
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => { cancelled = true; };
  }, [persona]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, message: content }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Message failed", description: data.error, variant: "destructive" });
        setSending(false);
        return;
      }
      setMessages((m) => [...m, data.message]);
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Persona selector */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PERSONA_META.map((p) => {
          const Icon = p.icon;
          const selected = p.id === persona;
          return (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              aria-pressed={selected}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                selected
                  ? "border-white/20 bg-white/[0.07] ring-2 " + p.ring
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
              )}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", p.gradient)}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{p.name}</span>
                <span className="block truncate text-xs text-slate-400">{p.title}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Chat card */}
      <Card className="flex h-[62vh] min-h-96 flex-col border-white/10 bg-white/[0.04]">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white", meta.gradient)}>
            <meta.icon className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{meta.name}</p>
            <p className="text-xs text-slate-400">{meta.blurb}</p>
          </div>
          <Badge variant="outline" className="border-emerald-400/30 bg-emerald-500/10 text-[10px] text-emerald-300">
            <Sparkles className="mr-1 h-3 w-3" /> AES-256 encrypted at rest
          </Badge>
        </div>

        {meta.disclaimer && (
          <div className="flex items-start gap-2 border-b border-white/10 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200/90">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {meta.disclaimer}
          </div>
        )}

        <div ref={scrollRef} className="deeprest-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!loaded && (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {loaded && messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-xl", meta.gradient)}>
                <meta.icon className="h-7 w-7" />
              </span>
              <p className="max-w-md text-sm leading-relaxed text-slate-300">{getGreeting(meta.id)}</p>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {meta.starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-slate-300 transition hover:border-violet-400/40 hover:bg-white/10 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
                  m.role === "user"
                    ? "rounded-br-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-950/30"
                    : "rounded-bl-md border border-white/10 bg-white/[0.05] text-slate-200"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${meta.name}…`}
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none border-white/10 bg-white/5 py-3 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-400"
              maxLength={2000}
            />
            <Button
              onClick={() => send()} disabled={sending || !input.trim()}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function getGreeting(id: PersonaId): string {
  switch (id) {
    case "SHEPHERD":
      return "Peace be with you. I am The Shepherd. \"Come to me, all you who are weary and burdened, and I will give you rest.\" — Matthew 11:28. How is your heart today?";
    case "GUIDE":
      return "Hey, I'm The Guide — your everyday coach. I'm here with practical ideas, hobbies, and small wins that make screen-free time actually enjoyable. What's one thing you'd love to do tonight without a screen?";
    case "COUNSELOR":
      return "Hello, I'm The Counselor. I use cognitive-behavioral techniques to help you understand the thoughts and triggers behind your screen habits. Note that I'm an AI, not a licensed doctor. To start: what happened just before your last long scrolling session?";
  }
}
