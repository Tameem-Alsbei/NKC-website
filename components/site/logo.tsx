import Link from "next/link";
import { school } from "@/lib/config/school";
import { cn } from "@/components/ui/cn";

/** Wordmark with the Arabic letter ع ("ayn", for عربي, Arabic) as the emblem. */
export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3 rounded-lg", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl font-arabic text-2xl leading-none shadow-sm ring-1",
          tone === "dark" ? "bg-pine-800 text-gold-300 ring-pine-900" : "bg-gold-300 text-pine-900 ring-gold-400",
        )}
      >
        <span className="-mt-1.5">ع</span>
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn("font-serif text-lg font-semibold", tone === "dark" ? "text-pine-900" : "text-cream-50")}>
          {school.name}
        </span>
        <span className={cn("text-xs font-medium tracking-wide", tone === "dark" ? "text-ink-500" : "text-cream-200")}>
          {school.tagline}
        </span>
      </span>
    </Link>
  );
}
