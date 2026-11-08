import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BulkColorGroupForm } from "@/components/admin/assignment-forms";
import { EmptyState, PageHeader } from "@/components/admin/layout-parts";
import { YearSelect } from "@/components/admin/year-select";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { inputClasses } from "@/components/ui/fields";
import { bulkSetColorGroup } from "@/lib/admin/assignment-actions";
import { describeCriteria, suggestColorGroup } from "@/lib/admin/color-groups";
import { getColorGroups, resolveSchoolYear } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, fullName, labelFor } from "@/lib/format";
import { GENDER_LABELS, GRADE_LABELS } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateColorGroupCriteria } from "./actions";
import { CriteriaForm } from "./criteria-form";

export const metadata: Metadata = { title: "Color groups" };

const num = (value: string | string[] | undefined) => (typeof value === "string" && /^\d{1,2}$/.test(value) ? Number(value) : null);

export default async function ColorGroupsPage({ searchParams }: PageProps<"/admin/color-groups">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = typeof params.year === "string" && /^\d+$/.test(params.year) ? Number(params.year) : null;
  const { years, year } = await resolveSchoolYear(requested);
  if (!year) return <EmptyState title="No school years yet" />;

  const minAge = num(params.minAge);
  const maxAge = num(params.maxAge);
  const gender = params.gender === "male" || params.gender === "female" || params.gender === "unknown" ? params.gender : null;

  const supabase = await createSupabaseServerClient();
  const [groups, rowsRes] = await Promise.all([
    getColorGroups(),
    supabase
      .from("admin_registration_list")
      .select("registration_id, student_id, student_first_name, student_last_name, date_of_birth, gender, grade, color_group_id")
      .eq("school_year_id", year.id)
      .eq("is_active", true)
      .order("date_of_birth", { ascending: false }),
  ]);
  if (rowsRes.error) throw new Error("Could not load students");

  const rows = rowsRes.data;
  const counts = new Map<number, number>();
  for (const row of rows) if (row.color_group_id) counts.set(row.color_group_id, (counts.get(row.color_group_id) ?? 0) + 1);

  const unassigned = rows
    .filter((row) => row.color_group_id === null)
    .map((row) => ({ ...row, age: ageFromDateOfBirth(row.date_of_birth) }))
    .filter((row) => (minAge === null || row.age >= minAge) && (maxAge === null || row.age <= maxAge))
    .filter((row) => (gender === null ? true : gender === "unknown" ? row.gender === null : row.gender === gender));
  const totalUnassigned = rows.filter((row) => row.color_group_id === null).length;
  const activeGroups = groups.filter((group) => group.is_active);
  const filtered = minAge !== null || maxAge !== null || gender !== null;

  return (
    <>
      <PageHeader
        title="Color groups"
        description={`${formatSchoolYear(year.label)} · ${rows.length} active students · ${totalUnassigned} not yet placed`}
        actions={
          <Suspense>
            <YearSelect years={years} selectedId={year.id} />
          </Suspense>
        }
      />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href={`/admin/color-groups/${group.id}?year=${year.id}`}
              className="block h-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] hover:border-brand-500"
            >
              <div className="px-5 py-3 font-display text-xl font-semibold" style={{ backgroundColor: group.color_hex, color: group.text_color_hex }}>
                {group.name}
              </div>
              <div className="px-5 py-4">
                <p className="font-display text-3xl font-semibold text-brand-800">{counts.get(group.id) ?? 0}</p>
                <p className="text-sm text-ink-500">students</p>
                <p className="mt-2 text-sm text-ink-600">{describeCriteria(group)}</p>
                {!group.is_active && <p className="mt-1 text-sm font-bold text-danger-700">Inactive</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Students without a color group" description="Suggestions use the guidance you set for each group. Nothing is assigned until you confirm." />
          <div className="px-5 py-5 sm:px-6">
            <form method="get" className="mb-5 flex flex-wrap items-end gap-3" aria-label="Filter unplaced students">
              <input type="hidden" name="year" value={year.id} />
              <div className="flex flex-col gap-1">
                <label htmlFor="cg-min" className="text-xs font-bold uppercase tracking-wide text-ink-500">Age from</label>
                <input id="cg-min" name="minAge" type="number" min={2} max={25} defaultValue={minAge ?? ""} className={inputClasses(false, "min-h-10 w-24 py-1.5 text-sm")} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cg-max" className="text-xs font-bold uppercase tracking-wide text-ink-500">Age to</label>
                <input id="cg-max" name="maxAge" type="number" min={2} max={25} defaultValue={maxAge ?? ""} className={inputClasses(false, "min-h-10 w-24 py-1.5 text-sm")} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cg-gender" className="text-xs font-bold uppercase tracking-wide text-ink-500">Boys / girls</label>
                <select id="cg-gender" name="gender" defaultValue={gender ?? ""} className={inputClasses(false, "min-h-10 w-auto py-1.5 text-sm")}>
                  <option value="">All</option>
                  <option value="male">Boys</option>
                  <option value="female">Girls</option>
                  <option value="unknown">Not recorded</option>
                </select>
              </div>
              <button type="submit" className={buttonClasses("secondary", "sm", "min-h-10")}>
                Filter
              </button>
              {filtered && (
                <ButtonLink href={`/admin/color-groups?year=${year.id}`} variant="ghost" size="sm" className="min-h-10">
                  Clear
                </ButtonLink>
              )}
            </form>

            {unassigned.length === 0 ? (
              <p className="text-sm text-ink-500">{filtered ? "No unplaced students match these filters." : "Every active student has a color group."}</p>
            ) : (
              <BulkColorGroupForm
                action={bulkSetColorGroup}
                groups={activeGroups.map((group) => ({ id: group.id, name: group.name }))}
                students={unassigned.map((row) => {
                  const suggestion = suggestColorGroup(groups, row.age, row.gender);
                  return {
                    value: row.registration_id,
                    name: fullName(row.student_first_name, row.student_last_name),
                    detail: [
                      `Age ${row.age}`,
                      row.gender ? GENDER_LABELS[row.gender] : "Boy/girl not recorded",
                      labelFor(GRADE_LABELS, row.grade),
                      suggestion ? `Suggested: ${suggestion.name}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  };
                })}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Placement guidance" description="Age and gender used to suggest a group. Change these any time." />
          <div className="divide-y divide-line">
            {groups.map((group) => (
              <details key={group.id} className="group px-5 py-4 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-3.5 rounded-full ring-1 ring-black/15" style={{ backgroundColor: group.color_hex }} />
                    {group.name}
                    <span className="font-normal text-ink-500">· {describeCriteria(group)}</span>
                  </span>
                  <span aria-hidden="true" className="text-brand-600 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="mt-4">
                  <CriteriaForm action={updateColorGroupCriteria.bind(null, group.id)} group={group} />
                </div>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
