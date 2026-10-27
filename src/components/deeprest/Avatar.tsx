"use client";

import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  color?: string;
  image?: string | null;
  emoji?: string | null;
  size?: number; // px
  className?: string;
  ring?: boolean;
}

/**
 * WhatsApp-style avatar: profile photo if set, otherwise the chosen emoji,
 * otherwise the person's initial on their signature colour.
 */
export function Avatar({ name, color = "#8b5cf6", image, emoji, size = 40, className, ring }: AvatarProps) {
  const style = {
    width: size,
    height: size,
    background: image ? undefined : `linear-gradient(135deg, ${color}, ${shade(color, -38)})`,
    fontSize: emoji ? Math.round(size * 0.52) : Math.round(size * 0.42),
  };

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold text-white",
        ring && "ring-2 ring-violet-400/40 ring-offset-2 ring-offset-[#070B1E]",
        className
      )}
      style={style}
      aria-hidden={false}
      role="img"
      aria-label={`${name}'s avatar`}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : emoji ? (
        <span className="leading-none">{emoji}</span>
      ) : (
        <span className="leading-none">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

/** Darken/lighten a hex colour by a percentage (-100..100). */
function shade(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
