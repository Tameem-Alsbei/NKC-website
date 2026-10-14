import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Pagination } from "@/components/admin/layout-parts";
import { NeedsReviewBadge, PaymentStatusBadge, RegistrationStatusBadge } from "@/components/admin/status-badges";
import { Badge } from "@/components/ui/badge";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { getGroupOptions, resolveSchoolYear } from "@/lib/admin/data";
import {
  applyStudentFilters,
  parseStudentFilters,
  SORT_COLUMNS,
  STUDENTS_PAGE_SIZE,
  studentFiltersToQuery,
  type StudentFilters,
} from "@/lib/admin/student-filters";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, formatDate, fullName, labelFor } from "@/lib/format";
import {
  ARABIC_LEVEL_LABELS,
  ARABIC_LEVELS,
  GRADE_LABELS,
  GRADES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
} from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Students" };

const LIST_COLUMNS =
  "registration_id, reference_code, status, payment_status, grade, is_returning, needs_review, registered_at, student_id, student_first_name, student_last_name, date_of_birth, arabic_level, group_id, group_name, guardian_first_name, guardian_last_name, guardian_email, guardian_phone";

function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel = "All",
}: {
  name: string;
  label: string;
  value: string | number | null;
  options: readonly { value: string | number; label: string }[];
  allLabel?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={`filter-${name}`} className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={value === null ? "" : String(value)}
        className={inputClasses(false, "min-h-10 py-1.5 text-sm")}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SortHeader({
  label,
  column,
  filters,
  className,
}: {
  label: string;
  column: StudentFilters["sort"];
  filters: StudentFilters & { year: number };
  className?: string;
}) {
  const active = filters.sort === column;
  const nextDir = active ? (filters.dir === "asc" ? "desc" : "asc") : column === "registered" ? "desc" : "asc";
  const href = `/admin/students${studentFiltersToQuery({ ...filters, sort: column, dir: nextDir, page: 1 })}`;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link href={href} className="inline-flex items-center gap-1 rounded hover:text-pine-900">
        {label}
        <span aria-hidden="true" className={active ? "text-pine-700" : "text-ink-500/50"}>
          {active ? (filters.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
        {!active && <span className="sr-only">(sort)</span>}
      </Link>
    </th>
  );
}

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  await requireAdmin();
  const filters = parseStudentFilters(await searchParams);
  const { years, year } = await resolveSchoolYear(filters.year);

  if (!year) {
    return (
      <>
        <PageHeader title="Students" />
        <EmptyState title="No school years yet" />
      </>
    );
  }

  const effective = { ...filters, year: year.id };
  const supabase = await createSupabaseServerClient();
  const from = (filters.page - 1) * STUDENTS_PAGE_SIZE;

  let query = applyStudentFilters(
    supabase.from("admin_registration_list").select(LIST_COLUMNS, { count: "exact" }),
    filters,
    year.id,
  );
  for (const column of SORT_COLUMNS[filters.sort]) {
    query = query.order(column, { ascending: filters.dir === "asc", nullsFirst: false });
  }
  query = query.order("registration_id", { ascending: true });

  const [{ data, count, error }, groups] = await Promise.all([
    query.range(from, from + STUDENTS_PAGE_SIZE - 1),
    getGroupOptions([year.id]),
  ]);
  if (error) throw new Error("Could not load students");

  const rows = data ?? [];
  const total = count ?? 0;
  const hasFilters = Boolean(
    filters.q || filters.status || filters.payment || filters.grade || filters.level || filters.returning || filters.group || filters.review,
  );
  const exportHref = `/api/admin/export${studentFiltersToQuery({ ...effective, page: 1 })}`;

  return (
    <>
      <PageHeader
        title="Students"
        description={`${formatSchoolYear(year.label)} school year · ${total} registration${total === 1 ? "" : "s"}${hasFilters ? " match your filters" : ""}`}
        actions={
          <a href={exportHref} className={buttonClasses("secondary", "md")} download>
            Export CSV
          </a>
        }
      />

      <form method="get" action="/admin/students" className="mb-6 rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)] sm:p-5" role="search" aria-label="Filter students">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
            <label htmlFor="filter-q" className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Search
            </label>
            <input
              id="filter-q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Student or parent name, email, reference"
              className={inputClasses(false, "min-h-10 py-1.5 text-sm")}
            />
          </div>
          <FilterSelect
            name="year"
            label="School year"
            value={year.id}
            allLabel="Current year"
            options={years.map((y) => ({ value: y.id, label: formatSchoolYear(y.label) }))}
          />
          <FilterSelect name="status" label="Registration" value={filters.status} options={REGISTRATION_STATUSES.map((s) => ({ value: s, label: REGISTRATION_STATUS_LABELS[s] }))} />
          <FilterSelect name="payment" label="Payment" value={filters.payment} options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))} />
          <FilterSelect name="grade" label="Grade" value={filters.grade} options={GRADES.map((g) => ({ value: g, label: GRADE_LABELS[g] }))} />
          <FilterSelect
            name="level"
            label="Arabic level"
            value={filters.level}
            options={[...ARABIC_LEVELS.map((l) => ({ value: l, label: ARABIC_LEVEL_LABELS[l] })), { value: "unknown", label: "Not set" }]}
          />
          <FilterSelect
            name="returning"
            label="New / returning"
            value={filters.returning}
            options={[
              { value: "new", label: "New" },
              { value: "returning", label: "Returning" },
            ]}
          />
          <FilterSelect
            name="group"
            label="Group"
            value={filters.group}
            options={[{ value: "none", label: "Not assigned" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          />
          <div className="flex items-end">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
              <input type="checkbox" name="review" value="1" defaultChecked={filters.review} className="size-4 accent-pine-700" />
              Needs review only
            </label>
          </div>
        </div>
        {filters.sort !== "registered" && <input type="hidden" name="sort" value={filters.sort} />}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={buttonClasses("primary", "sm")}>
            Apply filters
          </button>
          {hasFilters && (
            <ButtonLink href={`/admin/students?year=${year.id}`} variant="ghost" size="sm">
              Clear filters
            </ButtonLink>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={hasFilters ? "No students match these filters" : "No registrations yet"}>
          {hasFilters
            ? "Try removing a filter or searching for a different name."
            : "When families register online, their children will appear here."}
        </EmptyState>
      ) : (
        <>
          {/* Cards on small screens */}
          <ul className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <li key={row.registration_id}>
                <Link
                  href={`/admin/students/${row.student_id}`}
                  className="block rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-pine-600"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-pine-900">{fullName(row.student_first_name, row.student_last_name)}</p>
                      <p className="text-sm text-ink-500">
                        {labelFor(GRADE_LABELS, row.grade)} · Age {ageFromDateOfBirth(row.date_of_birth)} · {labelFor(ARABIC_LEVEL_LABELS, row.arabic_level)}
                      </p>
                    </div>
                    <Badge tone={row.is_returning ? "blue" : "neutral"}>{row.is_returning ? "Returning" : "New"}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <RegistrationStatusBadge status={row.status} />
                    <PaymentStatusBadge status={row.payment_status} />
                    {row.needs_review && <NeedsReviewBadge />}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-ink-500">Group</dt>
                      <dd className="text-ink-900">{row.group_name ?? "Not assigned"}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Guardian</dt>
                      <dd className="truncate text-ink-900">{fullName(row.guardian_first_name, row.guardian_last_name)}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {/* Table on large screens */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] lg:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Students registered for {formatSchoolYear(year.label)}</caption>
              <thead className="border-b border-line bg-cream-50 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <SortHeader label="Student" column="name" filters={effective} className="px-4 py-3" />
                  <SortHeader label="Grade" column="grade" filters={effective} className="px-4 py-3" />
                  <th scope="col" className="px-4 py-3">Arabic</th>
                  <SortHeader label="Status" column="status" filters={effective} className="px-4 py-3" />
                  <th scope="col" className="px-4 py-3">Payment</th>
                  <th scope="col" className="px-4 py-3">Group</th>
                  <th scope="col" className="px-4 py-3">Parent / guardian</th>
                  <SortHeader label="Registered" column="registered" filters={effective} className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.registration_id} className="align-top hover:bg-cream-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/students/${row.student_id}`} className="font-semibold text-pine-800 underline-offset-4 hover:underline">
                        {row.student_last_name}, {row.student_first_name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                        <span>
                          Born {formatDate(row.date_of_birth)} (age {ageFromDateOfBirth(row.date_of_birth)})
                        </span>
                        <Badge tone={row.is_returning ? "blue" : "neutral"}>{row.is_returning ? "Returning" : "New"}</Badge>
                        {row.needs_review && <NeedsReviewBadge />}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{labelFor(GRADE_LABELS, row.grade)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{labelFor(ARABIC_LEVEL_LABELS, row.arabic_level)}</td>
                    <td className="px-4 py-3"><RegistrationStatusBadge status={row.status} /></td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={row.payment_status} /></td>
                    <td className="px-4 py-3">{row.group_name ?? <span className="text-ink-500">Not assigned</span>}</td>
                    <td className="px-4 py-3">
                      <div className="text-ink-900">{fullName(row.guardian_first_name, row.guardian_last_name)}</div>
                      {row.guardian_email && (
                        <a href={`mailto:${row.guardian_email}`} className="block text-xs text-pine-700 hover:underline">
                          {row.guardian_email}
                        </a>
                      )}
                      {row.guardian_phone && <div className="text-xs text-ink-500">{row.guardian_phone}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatDate(row.registered_at.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={filters.page}
            pageSize={STUDENTS_PAGE_SIZE}
            total={total}
            hrefForPage={(page) => `/admin/students${studentFiltersToQuery({ ...effective, page })}`}
          />
        </>
      )}
    </>
  );
}
