import type { ComponentProps } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  as: Heading = "h2",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div>
        <Heading className="font-serif text-lg font-semibold text-pine-900">{title}</Heading>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
