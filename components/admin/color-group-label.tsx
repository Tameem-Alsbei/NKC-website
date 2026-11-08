import { cn } from "@/components/ui/cn";

/**
 * A color group's name with a swatch of its stored color. The name is always
 * written in regular text color, so it stays readable for every group color
 * and the group is never identified by color alone.
 */
export function ColorGroupLabel({
  name,
  color,
  className,
  emptyLabel = "Not assigned",
}: {
  name: string | null | undefined;
  color: string | null | undefined;
  className?: string;
  emptyLabel?: string;
}) {
  if (!name) return <span className={cn("text-ink-500", className)}>{emptyLabel}</span>;
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 rounded-full ring-1 ring-black/15"
        style={{ backgroundColor: color ?? "transparent" }}
      />
      {name}
    </span>
  );
}
