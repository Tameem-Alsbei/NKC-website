/**
 * A single-series horizontal bar list. Every bar carries its label and value as
 * text (so the data never depends on color alone) and the underlying markup is
 * a real list that screen readers read as "label: value".
 */
export function DistributionList({
  title,
  items,
  emptyText = "No data yet.",
}: {
  title: string;
  items: { label: string; value: number; color?: string }[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <figure>
      <figcaption className="font-display text-lg font-semibold text-brand-900">{title}</figcaption>
      {total === 0 ? (
        <p className="mt-3 text-sm text-ink-500">{emptyText}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li
              key={item.label}
              className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm"
              title={`${item.label}: ${item.value} (${Math.round((item.value / total) * 100)}%)`}
            >
              <span className="flex min-w-0 items-center gap-2 text-ink-700">
                {item.color && <span aria-hidden="true" className="size-3 shrink-0 rounded-full ring-1 ring-black/15" style={{ backgroundColor: item.color }} />}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="h-2.5 rounded-full bg-mist-100" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ backgroundColor: item.color, width: `${(item.value / max) * 100}%`, minWidth: item.value > 0 ? "0.5rem" : 0 }}
                />
              </span>
              <span className="text-right font-semibold tabular-nums text-ink-900">
                <span className="sr-only">{item.label}: </span>
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
