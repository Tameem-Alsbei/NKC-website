"use client";

import { cn } from "@/components/ui/cn";
import { REGISTRATION_STEPS } from "@/lib/registration/form-state";

/**
 * A small progress indicator. Sections the family has already reached can be
 * revisited; later ones stay disabled until the current section is valid.
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
  const position = `Step ${current + 1} of ${total}: ${REGISTRATION_STEPS[current].title}`;

  return (
    <nav aria-label="Registration progress" className="no-print">
      {/* Small screens: a segmented bar (the section heading below names the step) */}
      <div className="md:hidden">
        <div className="flex gap-1.5" role="progressbar" aria-label="Registration progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-valuetext={position}>
          {REGISTRATION_STEPS.map((step, index) => (
            <span
              key={step.id}
              aria-hidden="true"
              className={cn("h-2 flex-1 rounded-full", index <= current ? "bg-brand-600" : "bg-mist-200")}
            />
          ))}
        </div>
      </div>

      {/* Larger screens: every section, clickable once reached */}
      <ol className="hidden gap-2 md:grid md:grid-cols-5">
        {REGISTRATION_STEPS.map((step, index) => {
          const isCurrent = index === current;
          const isDone = index < current || (index <= furthest && !isCurrent);
          const reachable = index <= furthest && !isCurrent;
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col items-start gap-2 rounded-xl px-2 py-2 text-left transition-colors",
                  reachable && "hover:bg-brand-50",
                  !reachable && !isCurrent && "cursor-default",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-full rounded-full", isCurrent ? "bg-sun-500" : isDone ? "bg-brand-600" : "bg-mist-200")}
                />
                <span className={cn("text-sm font-bold leading-tight", isCurrent ? "text-brand-800" : isDone ? "text-ink-700" : "text-ink-500")}>
                  <span className="sr-only">
                    Step {index + 1} of {total}
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
