import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Pagination } from "@/components/admin/layout-parts";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { escapeLikePattern } from "@/lib/admin/student-filters";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Families" };

const PAGE_SIZE = 25;

export default async function FamiliesPage({ searchParams }: PageProps<"/admin/families">) {
  await requireAdmin();
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const page = typeof params.page === "string" && /^\d{1,6}$/.test(params.page) ? Math.max(1, Number(params.page)) : 1;
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("admin_family_list")
    .select("id, display_name, children_count, guardian_names, guardian_emails, guardian_phones, children_names, created_at", { count: "exact" });
  if (q) query = query.ilike("search_text", `%${escapeLikePattern(q)}%`);
  const { data, count, error } = await query.order("display_name").order("id").range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error("Could not load families");

  const total = count ?? 0;
  const href = (p: number) => `/admin/families?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <PageHeader title="Families" description={`${total} ${total === 1 ? "family" : "families"}${q ? " match your search" : ""}`} />

      <form method="get" role="search" aria-label="Search families" className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <label htmlFor="family-q" className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Search
          </label>
          <input id="family-q" name="q" type="search" defaultValue={q} placeholder="Guardian or child name, email" className={inputClasses(false, "min-h-10 py-1.5 text-sm")} />
        </div>
        <button type="submit" className={buttonClasses("primary", "sm", "min-h-10")}>
          Search
        </button>
        {q && (
          <ButtonLink href="/admin/families" variant="ghost" size="sm" className="min-h-10">
            Clear
          </ButtonLink>
        )}
      </form>

      {data.length === 0 ? (
        <EmptyState title={q ? "No families match your search" : "No families yet"}>
          {q ? "Try a different name or email address." : "Families are created automatically when parents register."}
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((family) => (
              <li key={family.id}>
                <Link href={`/admin/families/${family.id}`} className="block h-full rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] hover:border-pine-600">
                  <p className="font-serif text-lg font-semibold text-pine-900">{family.display_name}</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Guardians</dt>
                      <dd className="text-ink-900">{family.guardian_names ?? "—"}</dd>
                      {family.guardian_emails && <dd className="truncate text-ink-500">{family.guardian_emails}</dd>}
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                        Children ({family.children_count})
                      </dt>
                      <dd className="text-ink-900">{family.children_names ?? "—"}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-ink-500">Since {formatDate(family.created_at.slice(0, 10))}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefForPage={href} />
        </>
      )}
    </>
  );
}
