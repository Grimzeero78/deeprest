"use client";

// Circular progress ring showing "Time Used" vs "Target" (the 6-Hour Target).

interface ProgressRingProps {
  usedMinutes: number;
  targetMinutes: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export function formatHm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ProgressRing({ usedMinutes, targetMinutes, size = 220, stroke = 14, label = "used" }: ProgressRingProps) {
  const pct = targetMinutes > 0 ? Math.min(usedMinutes / targetMinutes, 1.35) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const over = usedMinutes > targetMinutes;
  const dash = Math.min(pct, 1) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={over ? "#fb7185" : "url(#ringGrad)"} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1), stroke 400ms" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-3xl font-semibold tracking-tight ${over ? "text-rose-300" : "text-white"}`}>
          {formatHm(usedMinutes)}
        </span>
        <span className="text-xs uppercase tracking-widest text-slate-400">{label}</span>
        <span className="mt-1 text-sm text-slate-300">
          {over ? (
            <span className="text-rose-300">{formatHm(usedMinutes - targetMinutes)} over target</span>
          ) : (
            <>of {formatHm(targetMinutes)} target · {formatHm(targetMinutes - usedMinutes)} left</>
          )}
        </span>
      </div>
    </div>
  );
}
