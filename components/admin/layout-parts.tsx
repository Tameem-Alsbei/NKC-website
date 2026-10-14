import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && (
          <Link
            href={breadcrumb.href}
            className="mb-2 inline-flex items-center gap-1 rounded text-sm font-semibold text-pine-700 hover:underline"
          >
            <span aria-hidden="true">←</span> {breadcrumb.label}
          </Link>
        )}
        <h1 className="font-serif text-2xl font-semibold text-pine-900 sm:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-ink-600">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-white/60 px-6 py-12 text-center">
      <p className="font-serif text-lg font-semibold text-pine-900">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkClass = "rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-semibold text-pine-800 hover:bg-pine-50";
  const disabledClass = "rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-500/60";

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkClass} href={hrefForPage(page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Previous
          </span>
        )}
        <span className="px-2 text-sm text-ink-600">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link className={linkClass} href={hrefForPage(page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <>
      <p className="text-sm font-medium text-ink-500">{label}</p>
      <p className={cn("mt-1 font-serif text-3xl font-semibold", tone === "attention" ? "text-danger-700" : "text-pine-900")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </>
  );
  const classes = "block rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]";
  return href ? (
    <Link href={href} className={cn(classes, "transition-colors hover:border-pine-600")}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** Simple definition list row used on detail pages. */
export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words text-ink-900">{children}</dd>
    </div>
  );
}
