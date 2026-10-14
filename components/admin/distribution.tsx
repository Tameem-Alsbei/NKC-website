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
  items: { label: string; value: number }[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <figure>
      <figcaption className="font-serif text-lg font-semibold text-pine-900">{title}</figcaption>
      {total === 0 ? (
        <p className="mt-3 text-sm text-ink-500">{emptyText}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li
              key={item.label}
              className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm"
              title={`${item.label}: ${item.value} (${Math.round((item.value / total) * 100)}%)`}
            >
              <span className="truncate text-ink-700">{item.label}</span>
              <span className="h-2.5 rounded-full bg-cream-100" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-pine-600"
                  style={{ width: `${(item.value / max) * 100}%`, minWidth: item.value > 0 ? "0.5rem" : 0 }}
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
