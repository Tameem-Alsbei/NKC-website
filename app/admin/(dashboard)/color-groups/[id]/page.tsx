import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BulkColorGroupForm } from "@/components/admin/assignment-forms";
import { InlineActionButton } from "@/components/admin/inline-action-button";
import { EmptyState, PageHeader } from "@/components/admin/layout-parts";
import { YearSelect } from "@/components/admin/year-select";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { bulkSetColorGroup } from "@/lib/admin/assignment-actions";
import { describeCriteria } from "@/lib/admin/color-groups";
import { getColorGroups, resolveSchoolYear } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, fullName, labelFor } from "@/lib/format";
import { formatQuranLevel, GENDER_LABELS, GRADE_LABELS } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { removeFromColorGroup } from "../actions";

export const metadata: Metadata = { title: "Color group roster" };

export default async function ColorGroupRosterPage({ params, searchParams }: PageProps<"/admin/color-groups/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const query = await searchParams;
  const requested = typeof query.year === "string" && /^\d+$/.test(query.year) ? Number(query.year) : null;

  const [groups, { years, year }] = await Promise.all([getColorGroups(), resolveSchoolYear(requested)]);
  const group = groups.find((g) => g.id === Number(id));
  if (!group) notFound();
  if (!year) return <EmptyState title="No school years yet" />;

  const supabase = await createSupabaseServerClient();
  const { data: roster, error } = await supabase
    .from("admin_registration_list")
    .select("registration_id, student_id, student_first_name, student_last_name, date_of_birth, gender, grade, quran_level_id, quran_level_name, teacher_name, guardian_first_name, guardian_last_name, guardian_phone")
    .eq("school_year_id", year.id)
    .eq("color_group_id", group.id)
    .order("student_last_name");
  if (error) throw new Error("Could not load roster");

  const otherGroups = groups.filter((g) => g.is_active && g.id !== group.id).map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <PageHeader
        breadcrumb={{ href: `/admin/color-groups?year=${year.id}`, label: "All color groups" }}
        title={`${group.name} group`}
        description={`${formatSchoolYear(year.label)} · ${roster.length} student${roster.length === 1 ? "" : "s"} · ${describeCriteria(group)}`}
        actions={
          <>
            <Suspense>
              <YearSelect years={years} selectedId={year.id} />
            </Suspense>
            <a href={`/api/admin/export?year=${year.id}&colorGroup=${group.id}&sort=name`} className={buttonClasses("secondary", "md")} download>
              Export roster
            </a>
          </>
        }
      />
      <div className="mb-6 h-2 rounded-full" style={{ backgroundColor: group.color_hex }} aria-hidden="true" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Roster" />
          {roster.length === 0 ? (
            <p className="px-6 py-6 text-sm text-ink-500">No students in this group for {formatSchoolYear(year.label)} yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {roster.map((student) => (
                <li key={student.registration_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <Link href={`/admin/students/${student.student_id}`} className="font-bold text-brand-700 hover:underline">
                      {fullName(student.student_first_name, student.student_last_name)}
                    </Link>
                    <p className="text-xs text-ink-500">
                      Age {ageFromDateOfBirth(student.date_of_birth)} · {labelFor(GENDER_LABELS, student.gender)} · {labelFor(GRADE_LABELS, student.grade)} ·{" "}
                      {student.quran_level_id ? `${formatQuranLevel(student.quran_level_id, student.quran_level_name)}${student.teacher_name ? `, ${student.teacher_name}` : ""}` : "No Quran level"}
                    </p>
                    <p className="text-xs text-ink-500">
                      {fullName(student.guardian_first_name, student.guardian_last_name)} {student.guardian_phone ?? ""}
                    </p>
                  </div>
                  <InlineActionButton
                    action={removeFromColorGroup.bind(null, student.registration_id)}
                    label="Remove"
                    pendingLabel="Removing…"
                    tone="danger"
                    confirmMessage={`Remove ${student.student_first_name} from the ${group.name} group?`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Move students" description="Move selected students to another color group." />
          <div className="px-5 py-5 sm:px-6">
            {roster.length === 0 || otherGroups.length === 0 ? (
              <p className="text-sm text-ink-500">Nothing to move.</p>
            ) : (
              <BulkColorGroupForm
                action={bulkSetColorGroup}
                groups={otherGroups}
                students={roster.map((student) => ({
                  value: student.registration_id,
                  name: fullName(student.student_first_name, student.student_last_name),
                  detail: `Age ${ageFromDateOfBirth(student.date_of_birth)} · ${labelFor(GENDER_LABELS, student.gender)}`,
                }))}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
