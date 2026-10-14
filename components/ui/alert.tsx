import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  info: "border-info-200 bg-info-50 text-info-800",
  success: "border-pine-200 bg-pine-50 text-pine-900",
  warning: "border-warning-200 bg-warning-50 text-warning-800",
  error: "border-danger-200 bg-danger-50 text-danger-800",
};

const icons: Record<Tone, ReactNode> = {
  info: <path d="M12 8h.01M11 12h1v5h1" />,
  success: <path d="m8 12.5 2.5 2.5L16 9.5" />,
  warning: <path d="M12 8v5m0 3h.01" />,
  error: <path d="M9.5 9.5l5 5m0-5-5 5" />,
};

/**
 * Inline message. Errors use role="alert" so screen readers announce them;
 * other tones use a polite status region.
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
  id,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed", tones[tone], className)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 size-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        {icons[tone]}
      </svg>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
    </div>
  );
}
