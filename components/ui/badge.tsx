import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "green" | "gold" | "blue" | "red" | "muted";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-cream-100 text-ink-700 ring-line-strong",
  green: "bg-pine-50 text-pine-800 ring-pine-200",
  gold: "bg-warning-50 text-warning-800 ring-warning-200",
  blue: "bg-info-50 text-info-800 ring-info-200",
  red: "bg-danger-50 text-danger-800 ring-danger-200",
  muted: "bg-white text-ink-500 ring-line",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
