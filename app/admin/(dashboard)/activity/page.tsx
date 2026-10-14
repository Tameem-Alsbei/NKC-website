import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Pagination } from "@/components/admin/layout-parts";
import { describeAuditEntry } from "@/lib/admin/audit";
import { getAdminNames } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 50;

function recordLink(table: string, recordId: string): string | null {
  if (table === "students" || table === "student_health_notes") return `/admin/students/${recordId}`;
  if (table === "groups") return `/admin/groups/${recordId}`;
  if (table === "households") return `/admin/families/${recordId}`;
  return null;
}

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin();
  const params = await searchParams;
  const page = typeof params.page === "string" && /^\d{1,6}$/.test(params.page) ? Math.max(1, Number(params.page)) : 1;
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const [{ data, count, error }, names] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id, actor_id, action, table_name, record_id, changed_fields, old_values, new_values, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
    getAdminNames(),
  ]);
  if (error) throw new Error("Could not load activity");

  return (
    <>
      <PageHeader title="Activity log" description="Every change made by administrators, newest first." />
      {data.length === 0 ? (
        <EmptyState title="No administrative changes yet" />
      ) : (
        <>
          <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
            {data.map((entry) => {
              const href = recordLink(entry.table_name, entry.record_id);
              return (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-ink-900">
                      {describeAuditEntry(entry)}
                      {href && (
                        <>
                          {" "}
                          <Link href={href} className="font-semibold text-pine-700 hover:underline">
                            View
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-ink-500">by {entry.actor_id ? (names.get(entry.actor_id) ?? "Former administrator") : "System"}</p>
                  </div>
                  <time dateTime={entry.created_at} className="whitespace-nowrap text-xs text-ink-500">
                    {formatDateTime(entry.created_at)}
                  </time>
                </li>
              );
            })}
          </ol>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefForPage={(p) => (p > 1 ? `/admin/activity?page=${p}` : "/admin/activity")} />
        </>
      )}
    </>
  );
}
