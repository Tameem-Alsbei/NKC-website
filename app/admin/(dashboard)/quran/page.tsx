import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BulkQuranForm } from "@/components/admin/assignment-forms";
import { EmptyState, PageHeader } from "@/components/admin/layout-parts";
import { YearSelect } from "@/components/admin/year-select";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { bulkSetQuranAssignment } from "@/lib/admin/assignment-actions";
import { getQuranLevels, getTeachers, resolveSchoolYear } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, fullName, labelFor } from "@/lib/format";
import { formatQuranLevel, GRADE_LABELS, QURAN_ABILITY_LABELS } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Quran" };

export default async function QuranPage({ searchParams }: PageProps<"/admin/quran">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = typeof params.year === "string" && /^\d+$/.test(params.year) ? Number(params.year) : null;
  const { years, year } = await resolveSchoolYear(requested);
  if (!year) return <EmptyState title="No school years yet" />;

  const supabase = await createSupabaseServerClient();
  const [levels, teachers, rowsRes] = await Promise.all([
    getQuranLevels(),
    getTeachers(),
    supabase
      .from("admin_registration_list")
      .select("student_id, student_first_name, student_last_name, date_of_birth, grade, reported_quran_ability, quran_level_id, teacher_id")
      .eq("school_year_id", year.id)
      .eq("is_active", true)
      .order("student_last_name"),
  ]);
  if (rowsRes.error) throw new Error("Could not load Quran assignments");

  const rows = rowsRes.data;
  const noLevel = rows.filter((row) => row.quran_level_id === null);
  const noTeacher = rows.filter((row) => row.quran_level_id !== null && row.teacher_id === null);
  const teacherOptions = teachers.map((t) => ({ id: t.id, name: t.name, levelIds: t.levelIds, isActive: t.isActive }));
  const levelOptions = levels.map((level) => ({ id: level.id, name: level.name }));
  const y = `year=${year.id}`;

  const describe = (row: (typeof rows)[number]) =>
    [
      `Age ${ageFromDateOfBirth(row.date_of_birth)}`,
      labelFor(GRADE_LABELS, row.grade),
      row.reported_quran_ability ? `Family says: ${labelFor(QURAN_ABILITY_LABELS, row.reported_quran_ability)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <PageHeader
        title="Quran"
        description={`${formatSchoolYear(year.label)} · ${rows.length} active students · ${noLevel.length} without a level · ${noTeacher.length} without a teacher`}
        actions={
          <>
            <Suspense>
              <YearSelect years={years} selectedId={year.id} />
            </Suspense>
            <ButtonLink href="/admin/quran/teachers" variant="secondary">
              Manage teachers
            </ButtonLink>
          </>
        }
      />

      <section aria-label="Quran levels and teachers" className="grid gap-5 lg:grid-cols-2">
        {levels.map((level) => {
          const inLevel = rows.filter((row) => row.quran_level_id === level.id);
          const levelTeachers = teachers.filter((t) => t.allLevelIds.includes(level.id));
          const withoutTeacher = inLevel.filter((row) => row.teacher_id === null).length;
          return (
            <Card key={level.id}>
              <CardHeader
                title={formatQuranLevel(level.id, level.name)}
                description={`${inLevel.length} student${inLevel.length === 1 ? "" : "s"}`}
                action={
                  <ButtonLink href={`/admin/students?${y}&quranLevel=${level.id}&sort=quran`} variant="ghost" size="sm">
                    View students
                  </ButtonLink>
                }
              />
              <ul className="divide-y divide-line">
                {levelTeachers.length === 0 && (
                  <li className="px-5 py-4 text-sm text-ink-500 sm:px-6">
                    No teachers assigned to this level yet.{" "}
                    <Link href="/admin/quran/teachers" className="font-bold text-brand-700 hover:underline">
                      Add a teacher
                    </Link>
                  </li>
                )}
                {levelTeachers.map((teacher) => {
                  const count = inLevel.filter((row) => row.teacher_id === teacher.id).length;
                  const teaches = teacher.isActive && teacher.levelIds.includes(level.id);
                  return (
                    <li key={teacher.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                      <Link href={`/admin/quran/teachers/${teacher.id}?${y}`} className="font-bold text-brand-700 hover:underline">
                        {teacher.name}
                      </Link>
                      <span className="flex items-center gap-3 text-sm">
                        {!teaches && <span className="text-ink-500">{teacher.isActive ? "No longer teaches this level" : "Inactive"}</span>}
                        <span className="font-bold tabular-nums text-ink-900">
                          {count} <span className="font-normal text-ink-500">student{count === 1 ? "" : "s"}</span>
                        </span>
                      </span>
                    </li>
                  );
                })}
                <li className="flex items-center justify-between gap-3 bg-mist-50 px-5 py-3 text-sm sm:px-6">
                  <span className="text-ink-600">No teacher yet</span>
                  {withoutTeacher > 0 ? (
                    <a href="#no-teacher" className="font-bold text-danger-700 hover:underline">
                      {withoutTeacher} student{withoutTeacher === 1 ? "" : "s"}
                    </a>
                  ) : (
                    <span className="font-bold text-ink-900">0</span>
                  )}
                </li>
              </ul>
            </Card>
          );
        })}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card id="unassigned" className="scroll-mt-6">
          <CardHeader title="Students without a Quran level" description="Use what the family told us as a starting point." />
          <div className="px-5 py-5 sm:px-6">
            {noLevel.length === 0 ? (
              <p className="text-sm text-ink-500">Every active student has a Quran level.</p>
            ) : (
              <BulkQuranForm
                action={bulkSetQuranAssignment.bind(null, year.id)}
                levels={levelOptions}
                teachers={teacherOptions}
                students={noLevel.map((row) => ({ value: row.student_id, name: fullName(row.student_first_name, row.student_last_name), detail: describe(row) }))}
              />
            )}
          </div>
        </Card>
        <Card id="no-teacher" className="scroll-mt-6">
          <CardHeader title="Students with a level but no teacher" />
          <div className="px-5 py-5 sm:px-6">
            {noTeacher.length === 0 ? (
              <p className="text-sm text-ink-500">Everyone with a Quran level has a teacher.</p>
            ) : (
              <BulkQuranForm
                action={bulkSetQuranAssignment.bind(null, year.id)}
                levels={levelOptions}
                teachers={teacherOptions}
                closesExisting
                students={noTeacher.map((row) => ({
                  value: row.student_id,
                  name: fullName(row.student_first_name, row.student_last_name),
                  detail: `${formatQuranLevel(row.quran_level_id as number, levels.find((l) => l.id === row.quran_level_id)?.name)} · ${describe(row)}`,
                }))}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
