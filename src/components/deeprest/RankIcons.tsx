"use client";

import { useId } from "react";

// ============================================================
// DeepRest Rank Icons — 10 handcrafted premium SVG badges.
// Each rank gets a unique glyph + signature gradient, escalating
// in visual complexity from Restless (Lv.1) to DeepRest Master (Lv.10).
// ============================================================

interface RankIconProps {
  icon: string;
  color: string;
  colorEnd: string;
  size?: number;
  className?: string;
}

function Hex({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      <path
        d="M32 3 L57 17.5 V46.5 L32 61 L7 46.5 V17.5 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      <path
        d="M32 7.5 L53 19.8 V44.2 L32 56.5 L11 44.2 V19.8 Z"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />
    </>
  );
}

export function RankIcon({ icon, color, colorEnd, size = 64, className }: RankIconProps) {
  const uid = useId().replace(/[:]/g, "");
  const g = `g-${uid}`;
  const glow = `glow-${uid}`;

  const common = { width: size, height: size, viewBox: "0 0 64 64", className };

  return (
    <svg {...common} aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={colorEnd} />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={colorEnd} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </radialGradient>
      </defs>

      {icon === "restless" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path
            d="M32 14 C44 14 50 22 50 30 C50 38 44 44 36 44 C30 44 26 40 26 35 C26 31 29 28 33 28 C36 28 38 30 38 33"
            fill="none" stroke={`url(#${g})`} strokeWidth="3" strokeLinecap="round"
          />
          <circle cx="32" cy="47" r="2.5" fill={colorEnd} />
        </>
      )}

      {icon === "awakened" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M14 36 C22 24 42 24 50 36 C42 46 22 46 14 36 Z" fill="none" stroke={`url(#${g})`} strokeWidth="2.5" />
          <circle cx="32" cy="36" r="6" fill={`url(#${g})`} />
          <circle cx="32" cy="36" r="2" fill="#0b1026" />
          <path d="M32 16 L32 24 M24 19 L27 25 M40 19 L37 25" stroke={colorEnd} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {icon === "seeker" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <circle cx="32" cy="34" r="14" fill="none" stroke={`url(#${g})`} strokeWidth="2.5" />
          <path d="M32 22 L35.5 30.5 L44 34 L35.5 37.5 L32 46 L28.5 37.5 L20 34 L28.5 30.5 Z" fill={`url(#${g})`} />
          <circle cx="32" cy="34" r="2.2" fill="#0b1026" />
        </>
      )}

      {icon === "steward" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M32 46 C32 36 32 30 32 26" stroke={`url(#${g})`} strokeWidth="3" strokeLinecap="round" />
          <path d="M32 34 C24 34 20 28 20 20 C28 20 32 25 32 34 Z" fill={`url(#${g})`} opacity="0.9" />
          <path d="M32 30 C40 30 44 24 44 16 C36 16 32 21 32 30 Z" fill={`url(#${g})`} />
          <path d="M20 48 C26 44 38 44 44 48" fill="none" stroke={colorEnd} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {icon === "disciplined" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M32 18 C36 24 37 30 32 36 C27 30 28 24 32 18 Z" fill={`url(#${g})`} />
          <path d="M18 34 C22 40 26 43 32 44 M46 34 C42 40 38 43 32 44" fill="none" stroke={`url(#${g})`} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M16 30 C18 37 20 40 22 42 M48 30 C46 37 44 40 42 42" fill="none" stroke={colorEnd} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <path d="M24 50 H40" stroke={colorEnd} strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {icon === "guardian" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M32 14 L46 19 V32 C46 41 40 48 32 51 C24 48 18 41 18 32 V19 Z" fill={`url(#${g})`} opacity="0.25" />
          <path d="M32 14 L46 19 V32 C46 41 40 48 32 51 C24 48 18 41 18 32 V19 Z" fill="none" stroke={`url(#${g})`} strokeWidth="2.5" />
          <path d="M32 22 L34.8 29.2 L42 32 L34.8 34.8 L32 42 L29.2 34.8 L22 32 L29.2 29.2 Z" fill={colorEnd} />
        </>
      )}

      {icon === "sentinel" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M26 50 L27 30 H37 L38 50 Z" fill={`url(#${g})`} opacity="0.9" />
          <path d="M24 30 L32 18 L40 30 Z" fill={`url(#${g})`} />
          <circle cx="32" cy="26" r="2.4" fill="#0b1026" />
          <path d="M32 14 L32 10" stroke={colorEnd} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M14 50 H50" stroke={colorEnd} strokeWidth="3" strokeLinecap="round" />
          <path d="M32 34 L32 44" stroke="#0b1026" strokeWidth="2" opacity="0.5" />
        </>
      )}

      {icon === "overcomer" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M12 48 L26 28 L34 38 L42 22 L52 48 Z" fill={`url(#${g})`} opacity="0.85" />
          <path d="M42 22 L44 14 L50 17 L44 21 Z" fill={colorEnd} />
          <path d="M42 22 L42 30" stroke={colorEnd} strokeWidth="2" />
          <circle cx="20" cy="20" r="4" fill="none" stroke={colorEnd} strokeWidth="2" />
        </>
      )}

      {icon === "luminary" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M32 18 C38 24 38 36 32 42 C26 36 26 24 32 18 Z" fill={`url(#${g})`} />
          <circle cx="32" cy="30" r="9" fill="none" stroke={colorEnd} strokeWidth="1.5" opacity="0.7" />
          <path d="M32 12 L33.5 16.5 M32 48 L33.5 52 M14 30 L18.5 31.5 M45.5 31.5 L50 30 M19 17 L22.5 20 M41.5 44 L45 47 M45 17 L41.5 20 M22.5 44 L19 47"
            stroke={colorEnd} strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="30" r="3" fill="#0b1026" opacity="0.6" />
        </>
      )}

      {icon === "master" && (
        <>
          <Hex fill={`url(#${glow})`} stroke={`url(#${g})`} />
          <path d="M20 24 L26 14 L32 20 L38 14 L44 24 L38 26 L32 22 L26 26 Z" fill={colorEnd} opacity="0.95" />
          <path d="M32 24 L42 32 L32 50 L22 32 Z" fill="none" stroke={`url(#${g})`} strokeWidth="2.5" />
          <path d="M32 24 L32 50 M22 32 L42 32 M26 26 L38 44 M38 26 L26 44" stroke={`url(#${g})`} strokeWidth="1.2" opacity="0.7" />
          <circle cx="32" cy="32" r="15" fill="none" stroke={colorEnd} strokeWidth="1" opacity="0.4" />
        </>
      )}

      {/* fallback: simple orb */}
      {!["restless","awakened","seeker","steward","disciplined","guardian","sentinel","overcomer","luminary","master"].includes(icon) && (
        <circle cx="32" cy="32" r="18" fill={`url(#${g})`} />
      )}
    </svg>
  );
}
