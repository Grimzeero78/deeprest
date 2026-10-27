"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Siren, Loader2, Squirrel, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SOSButtonProps {
  hasPartner: boolean;
  partnerName?: string;
  onSent?: () => void;
  size?: "default" | "lg";
}

// Two-step confirmed panic button. Server also enforces confirmation
// (confirmed: true) and rate-limits to 3 alerts / 5 min.
export function SOSButton({ hasPartner, partnerName, onSent, size = "default" }: SOSButtonProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  function start() {
    setStep(1);
    setMessage("");
    setOpen(true);
  }

  async function fire() {
    setSending(true);
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, message: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not send SOS", description: data.error, variant: "destructive" });
        return;
      }
      setOpen(false);
      toast({
        title: partnerName ? `${partnerName} has been alerted` : "SOS recorded",
        description: hasPartner
          ? "Delivered via push, SMS and email. Hold on — help is coming."
          : "You have no Dynamic Duo partner yet — connect with one so alerts reach a real person.",
        variant: hasPartner ? "default" : "destructive",
      });
      onSent?.();
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        onClick={start}
        size={size}
        className="gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-500 px-6 font-semibold text-white shadow-lg shadow-rose-950/40 hover:from-rose-500 hover:to-red-400 focus-visible:ring-rose-400"
        aria-label="Send SOS alert to your accountability partner"
      >
        <Siren className="h-5 w-5" />
        SOS — I need support
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setStep(1); }}>
        <DialogContent className="border-white/10 bg-[#0d1228] text-slate-100 sm:max-w-md">
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-300">
                  <Siren className="h-5 w-5" /> Send an SOS alert?
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {hasPartner
                    ? `${partnerName || "Your partner"} will be notified immediately by push, SMS and email.`
                    : "You have no Dynamic Duo partner yet. An SOS is far more powerful with a real person on the other end."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="sos-msg" className="text-slate-300">Add context (optional)</Label>
                <Textarea
                  id="sos-msg" value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Strong urge right now, been scrolling for 2 hours and can't stop."
                  maxLength={280}
                  className="min-h-20 border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus-visible:ring-rose-400"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-300 hover:bg-white/5">
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  className="bg-gradient-to-r from-rose-600 to-red-500 text-white hover:from-rose-500 hover:to-red-400"
                >
                  Continue <Send className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-rose-300">Tap again to confirm</DialogTitle>
                <DialogDescription className="text-slate-400">
                  This will {hasPartner ? "page your partner on all channels" : "record an alert (no partner connected)"}. Accidental presses waste real support — make sure you mean it.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                If you are in crisis or danger, please contact your local emergency number first.
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setStep(1)} className="text-slate-300 hover:bg-white/5">
                  Go back
                </Button>
                <Button
                  onClick={fire} disabled={sending}
                  className="bg-gradient-to-r from-rose-600 to-red-500 text-white hover:from-rose-500 hover:to-red-400"
                >
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Squirrel className="mr-2 h-4 w-4" />}
                  Yes — send SOS now
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
