import { cn } from "@/components/ui/cn";

/** Enrollment versus capacity, shown as text plus a bar (the text carries the meaning). */
export function CapacityMeter({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const ratio = capacity > 0 ? Math.min(1, enrolled / capacity) : 0;
  const full = enrolled >= capacity;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink-900">
          {enrolled} / {capacity} students
        </span>
        <span className={full ? "font-semibold text-danger-700" : "text-ink-500"}>
          {full ? "Full" : `${capacity - enrolled} open`}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 rounded-full bg-cream-100"
        role="meter"
        aria-label="Enrollment"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={enrolled}
        aria-valuetext={`${enrolled} of ${capacity} seats filled`}
      >
        <div className={cn("h-full rounded-full", full ? "bg-danger-700" : "bg-pine-600")} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
