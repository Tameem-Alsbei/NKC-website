import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuranAssignmentForm } from "@/components/admin/assignment-forms";
import { EmptyState, PageHeader } from "@/components/admin/layout-parts";
import { YearSelect } from "@/components/admin/year-select";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { setQuranAssignment } from "@/lib/admin/assignment-actions";
import { getQuranLevels, getTeachers, resolveSchoolYear } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, fullName, labelFor } from "@/lib/format";
import { formatQuranLevel, GENDER_LABELS, GRADE_LABELS } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateTeacher } from "../../actions";
import { TeacherForm } from "../../teacher-form";

export const metadata: Metadata = { title: "Quran teacher" };

export default async function TeacherPage({ params, searchParams }: PageProps<"/admin/quran/teachers/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const query = await searchParams;
  const requested = typeof query.year === "string" && /^\d+$/.test(query.year) ? Number(query.year) : null;

  const [levels, teachers, { years, year }] = await Promise.all([getQuranLevels(), getTeachers(), resolveSchoolYear(requested)]);
  const teacher = teachers.find((t) => t.id === Number(id));
  if (!teacher) notFound();
  if (!year) return <EmptyState title="No school years yet" />;

  const supabase = await createSupabaseServerClient();
  const { data: roster, error } = await supabase
    .from("admin_registration_list")
    .select("student_id, student_first_name, student_last_name, date_of_birth, gender, grade, quran_level_id, quran_level_name, teacher_id, teacher_name")
    .eq("school_year_id", year.id)
    .eq("teacher_id", teacher.id)
    .order("student_last_name");
  if (error) throw new Error("Could not load roster");

  const teacherOptions = teachers.map((t) => ({ id: t.id, name: t.name, levelIds: t.levelIds, isActive: t.isActive }));
  const rosterLevels = levels.filter((level) => teacher.allLevelIds.includes(level.id) || roster.some((row) => row.quran_level_id === level.id));

  return (
    <>
      <PageHeader
        breadcrumb={{ href: `/admin/quran?year=${year.id}`, label: "Quran" }}
        title={teacher.name}
        description={`${teacher.isActive ? "Active" : "Inactive"} · ${roster.length} student${roster.length === 1 ? "" : "s"} in ${formatSchoolYear(year.label)}`}
        actions={
          <>
            <Suspense>
              <YearSelect years={years} selectedId={year.id} />
            </Suspense>
            <a href={`/api/admin/export?year=${year.id}&teacher=${teacher.id}&sort=quran`} className={buttonClasses("secondary", "md")} download>
              Export roster
            </a>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {rosterLevels.length === 0 && <EmptyState title="No levels yet">Choose the levels this teacher teaches in the form.</EmptyState>}
          {rosterLevels.map((level) => {
            const students = roster.filter((row) => row.quran_level_id === level.id);
            return (
              <Card key={level.id}>
                <CardHeader
                  title={formatQuranLevel(level.id, level.name)}
                  description={`${students.length} student${students.length === 1 ? "" : "s"}${teacher.levelIds.includes(level.id) ? "" : " · no longer teaches this level"}`}
                />
                {students.length === 0 ? (
                  <p className="px-6 py-5 text-sm text-ink-500">
                    No students yet. Assign students from the{" "}
                    <Link href={`/admin/quran?year=${year.id}#unassigned`} className="font-bold text-brand-700 hover:underline">
                      Quran page
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {students.map((student) => (
                      <li key={student.student_id} className="space-y-2 px-5 py-4 sm:px-6">
                        <div>
                          <Link href={`/admin/students/${student.student_id}`} className="font-bold text-brand-700 hover:underline">
                            {fullName(student.student_first_name, student.student_last_name)}
                          </Link>
                          <span className="ml-2 text-xs text-ink-500">
                            Age {ageFromDateOfBirth(student.date_of_birth)} · {labelFor(GENDER_LABELS, student.gender)} · {labelFor(GRADE_LABELS, student.grade)}
                          </span>
                        </div>
                        <QuranAssignmentForm
                          compact
                          action={setQuranAssignment.bind(null, student.student_id, year.id)}
                          levels={levels}
                          teachers={teacherOptions}
                          current={{ levelId: level.id, teacherId: teacher.id, teacherName: teacher.name }}
                          idPrefix={`move-${student.student_id}`}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
        <Card>
          <CardHeader title="Teacher details" />
          <div className="px-5 py-5 sm:px-6">
            <TeacherForm action={updateTeacher.bind(null, teacher.id)} levels={levels} teacher={teacher} />
          </div>
        </Card>
      </div>
    </>
  );
}
