"use client";

import { cn } from "@/components/ui/cn";
import { REGISTRATION_STEPS } from "@/lib/registration/form-state";

/**
 * Step indicator. Steps the family has already reached can be revisited;
 * later steps stay disabled until the current one is valid.
 */
export function RegistrationProgress({
  current,
  furthest,
  onSelect,
}: {
  current: number;
  furthest: number;
  onSelect: (index: number) => void;
}) {
  const total = REGISTRATION_STEPS.length;
  const percent = Math.round(((current + 1) / total) * 100);

  return (
    <nav aria-label="Registration progress" className="no-print">
      {/* Compact indicator for small screens */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-pine-900">
            Step {current + 1} of {total}
          </span>
          <span className="text-ink-500">{REGISTRATION_STEPS[current].title}</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-cream-200"
          role="progressbar"
          aria-label="Registration progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current + 1}
          aria-valuetext={`Step ${current + 1} of ${total}: ${REGISTRATION_STEPS[current].title}`}
        >
          <div className="h-full rounded-full bg-pine-700 transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* Full step list for larger screens */}
      <ol className="hidden gap-1 md:grid md:grid-cols-7">
        {REGISTRATION_STEPS.map((step, index) => {
          const isCurrent = index === current;
          const isDone = index < current || (index <= furthest && index !== current);
          const reachable = index <= furthest && !isCurrent;
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col items-start gap-2 rounded-lg px-1.5 py-2 text-left transition-colors",
                  reachable && "hover:bg-cream-100",
                  !reachable && !isCurrent && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-full rounded-full",
                    isCurrent ? "bg-pine-700" : isDone ? "bg-pine-600/60" : "bg-cream-200",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-xs font-semibold leading-tight",
                    isCurrent ? "text-pine-900" : isDone ? "text-ink-700" : "text-ink-500",
                  )}
                >
                  <span className="sr-only">
                    Step {index + 1}
                    {isDone ? ", completed" : ""}:{" "}
                  </span>
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
