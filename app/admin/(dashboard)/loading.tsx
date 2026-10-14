export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6 motion-reduce:animate-none">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 rounded-lg bg-cream-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white ring-1 ring-line" />
        ))}
      </div>
      <div className="h-80 rounded-2xl bg-white ring-1 ring-line" />
    </div>
  );
}
