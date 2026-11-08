import type { Metadata } from "next";
import Link from "next/link";
import { ColorGroupLabel } from "@/components/admin/color-group-label";
import { EmptyState, PageHeader, Pagination } from "@/components/admin/layout-parts";
import { NeedsReviewBadge, PaymentStatusBadge, RegistrationStatusBadge } from "@/components/admin/status-badges";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { getColorGroups, getQuranLevels, getTeachers, resolveSchoolYear } from "@/lib/admin/data";
import {
  applyStudentFilters,
  defaultSortDirection,
  orderForSort,
  parseStudentFilters,
  STUDENTS_PAGE_SIZE,
  studentFiltersToQuery,
  type StudentFilters,
} from "@/lib/admin/student-filters";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, formatDate, fullName, labelFor } from "@/lib/format";
import {
  formatQuranLevel,
  GENDER_LABELS,
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
  "registration_id, status, payment_status, grade, is_returning, needs_review, registered_at, student_id, student_first_name, student_last_name, date_of_birth, gender, color_group_name, color_group_color, quran_level_id, quran_level_name, teacher_name, guardian_first_name, guardian_last_name, guardian_email, guardian_phone";

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
      <label htmlFor={`filter-${name}`} className="text-xs font-bold uppercase tracking-wide text-ink-500">
        {label}
      </label>
      <select id={`filter-${name}`} name={name} defaultValue={value === null ? "" : String(value)} className={inputClasses(false, "min-h-10 py-1.5 text-sm")}>
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

function SortHeader({ label, column, filters, className }: { label: string; column: StudentFilters["sort"]; filters: StudentFilters; className?: string }) {
  const active = filters.sort === column;
  const nextDir = active ? (filters.dir === "asc" ? "desc" : "asc") : defaultSortDirection(column);
  const href = `/admin/students${studentFiltersToQuery({ ...filters, sort: column, dir: nextDir, page: 1 })}`;
  return (
    <th scope="col" className={className} aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={href} className="inline-flex items-center gap-1 rounded hover:text-brand-800">
        {label}
        <span aria-hidden="true" className={active ? "text-brand-600" : "text-ink-500/50"}>
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

  const effective: StudentFilters = { ...filters, year: year.id };
  const supabase = await createSupabaseServerClient();
  const from = (filters.page - 1) * STUDENTS_PAGE_SIZE;

  let query = applyStudentFilters(supabase.from("admin_registration_list").select(LIST_COLUMNS, { count: "exact" }), filters, year.id);
  for (const { column, ascending } of orderForSort(filters)) query = query.order(column, { ascending, nullsFirst: false });
  query = query.order("registration_id", { ascending: true });

  const [{ data, count, error }, colorGroups, levels, teachers] = await Promise.all([
    query.range(from, from + STUDENTS_PAGE_SIZE - 1),
    getColorGroups(),
    getQuranLevels(),
    getTeachers(),
  ]);
  if (error) throw new Error("Could not load students");

  const rows = data ?? [];
  const total = count ?? 0;
  const hasFilters = Boolean(
    filters.q || filters.status || filters.payment || filters.grade || filters.gender || filters.returning || filters.colorGroup || filters.quranLevel || filters.teacher || filters.assignment || filters.review,
  );
  const exportHref = `/api/admin/export${studentFiltersToQuery({ ...effective, page: 1 })}`;

  return (
    <>
      <PageHeader
        title="Students"
        description={`${formatSchoolYear(year.label)} · ${total} registration${total === 1 ? "" : "s"}${hasFilters ? " match your filters" : ""}`}
        actions={
          <a href={exportHref} className={buttonClasses("secondary", "md")} download>
            Export CSV
          </a>
        }
      />

      <form method="get" action="/admin/students" className="mb-6 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] sm:p-5" role="search" aria-label="Filter students">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="filter-q" className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Search
            </label>
            <input id="filter-q" name="q" type="search" defaultValue={filters.q} placeholder="Student or parent name, email, reference" className={inputClasses(false, "min-h-10 py-1.5 text-sm")} />
          </div>
          <FilterSelect name="year" label="School year" value={year.id} allLabel="Current year" options={years.map((y) => ({ value: y.id, label: formatSchoolYear(y.label) }))} />
          <FilterSelect
            name="colorGroup"
            label="Color group"
            value={filters.colorGroup}
            options={[{ value: "none", label: "Not assigned" }, ...colorGroups.map((g) => ({ value: g.id, label: g.name }))]}
          />
          <FilterSelect
            name="quranLevel"
            label="Quran level"
            value={filters.quranLevel}
            options={[{ value: "none", label: "Not assigned" }, ...levels.map((l) => ({ value: l.id, label: formatQuranLevel(l.id, l.name) }))]}
          />
          <FilterSelect
            name="teacher"
            label="Quran teacher"
            value={filters.teacher}
            options={[{ value: "none", label: "No teacher" }, ...teachers.map((t) => ({ value: t.id, label: t.isActive ? t.name : `${t.name} (inactive)` }))]}
          />
          <FilterSelect
            name="assignment"
            label="Placement"
            value={filters.assignment}
            options={[
              { value: "unassigned", label: "Missing a placement" },
              { value: "assigned", label: "Fully placed" },
            ]}
          />
          <FilterSelect name="status" label="Registration" value={filters.status} options={REGISTRATION_STATUSES.map((s) => ({ value: s, label: REGISTRATION_STATUS_LABELS[s] }))} />
          <FilterSelect name="payment" label="Payment" value={filters.payment} options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))} />
          <FilterSelect
            name="returning"
            label="New / returning"
            value={filters.returning}
            options={[
              { value: "new", label: "New" },
              { value: "returning", label: "Returning" },
            ]}
          />
          <FilterSelect name="grade" label="School grade" value={filters.grade} options={GRADES.map((g) => ({ value: g, label: GRADE_LABELS[g] }))} />
          <FilterSelect
            name="gender"
            label="Boy / girl"
            value={filters.gender}
            options={[
              { value: "male", label: GENDER_LABELS.male },
              { value: "female", label: GENDER_LABELS.female },
              { value: "unknown", label: "Not recorded" },
            ]}
          />
          <div className="flex items-end">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
              <input type="checkbox" name="review" value="1" defaultChecked={filters.review} className="size-4 accent-brand-700" />
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
          {hasFilters ? "Try removing a filter or searching for a different name." : "When families register online, their children will appear here."}
        </EmptyState>
      ) : (
        <>
          {/* Cards on small screens */}
          <ul className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <li key={row.registration_id}>
                <Link href={`/admin/students/${row.student_id}`} className="block rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-brand-500">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-brand-800">{fullName(row.student_first_name, row.student_last_name)}</p>
                      <p className="text-sm text-ink-500">
                        Age {ageFromDateOfBirth(row.date_of_birth)} · {labelFor(GENDER_LABELS, row.gender)} · {labelFor(GRADE_LABELS, row.grade)} ·{" "}
                        {row.is_returning ? "Returning" : "New"}
                      </p>
                    </div>
                    {row.needs_review && <NeedsReviewBadge />}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-ink-500">Color group</dt>
                      <dd>
                        <ColorGroupLabel name={row.color_group_name} color={row.color_group_color} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Quran</dt>
                      <dd className="text-ink-900">
                        {row.quran_level_id ? formatQuranLevel(row.quran_level_id, row.quran_level_name) : <span className="text-ink-500">Not assigned</span>}
                        {row.quran_level_id && <span className="block text-ink-600">{row.teacher_name ?? "No teacher yet"}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Parent / guardian</dt>
                      <dd className="truncate text-ink-900">{fullName(row.guardian_first_name, row.guardian_last_name)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Registered</dt>
                      <dd className="text-ink-900">{formatDate(row.registered_at.slice(0, 10))}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <RegistrationStatusBadge status={row.status} />
                    <PaymentStatusBadge status={row.payment_status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Table on large screens */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] xl:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Students registered for {formatSchoolYear(year.label)}</caption>
              <thead className="border-b border-line bg-mist-50 text-xs font-bold uppercase tracking-wide text-ink-500">
                <tr>
                  <SortHeader label="Student" column="name" filters={effective} className="px-3 py-3" />
                  <SortHeader label="Age" column="age" filters={effective} className="px-3 py-3" />
                  <SortHeader label="Grade" column="grade" filters={effective} className="px-3 py-3" />
                  <th scope="col" className="px-3 py-3">Color group</th>
                  <SortHeader label="Quran" column="quran" filters={effective} className="px-3 py-3" />
                  <SortHeader label="Status" column="status" filters={effective} className="px-3 py-3" />
                  <th scope="col" className="px-3 py-3">Payment</th>
                  <th scope="col" className="px-3 py-3">Parent / guardian</th>
                  <SortHeader label="Registered" column="registered" filters={effective} className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.registration_id} className="align-top hover:bg-mist-50">
                    <td className="px-3 py-3">
                      <Link href={`/admin/students/${row.student_id}`} className="font-bold text-brand-700 underline-offset-4 hover:underline">
                        {row.student_last_name}, {row.student_first_name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                        <span>
                          {labelFor(GENDER_LABELS, row.gender)} · {row.is_returning ? "Returning" : "New"}
                        </span>
                        {row.needs_review && <NeedsReviewBadge />}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{ageFromDateOfBirth(row.date_of_birth)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{labelFor(GRADE_LABELS, row.grade)}</td>
                    <td className="px-3 py-3">
                      <ColorGroupLabel name={row.color_group_name} color={row.color_group_color} />
                    </td>
                    <td className="px-3 py-3">
                      {row.quran_level_id ? (
                        <>
                          <span className="whitespace-nowrap">{formatQuranLevel(row.quran_level_id, row.quran_level_name)}</span>
                          <span className="block text-xs text-ink-500">{row.teacher_name ?? "No teacher yet"}</span>
                        </>
                      ) : (
                        <span className="text-ink-500">Not assigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <RegistrationStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3">
                      <PaymentStatusBadge status={row.payment_status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-ink-900">{fullName(row.guardian_first_name, row.guardian_last_name)}</div>
                      {row.guardian_email && (
                        <a href={`mailto:${row.guardian_email}`} className="block text-xs text-brand-700 hover:underline">
                          {row.guardian_email}
                        </a>
                      )}
                      {row.guardian_phone && <div className="text-xs text-ink-500">{row.guardian_phone}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-600">{formatDate(row.registered_at.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={filters.page} pageSize={STUDENTS_PAGE_SIZE} total={total} hrefForPage={(page) => `/admin/students${studentFiltersToQuery({ ...effective, page })}`} />
        </>
      )}
    </>
  );
}
