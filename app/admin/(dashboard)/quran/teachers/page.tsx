import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/layout-parts";
import { Card, CardHeader } from "@/components/ui/card";
import { getQuranLevels, getTeachers, resolveSchoolYear } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { formatQuranLevel } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTeacher } from "../actions";
import { TeacherForm } from "../teacher-form";

export const metadata: Metadata = { title: "Quran teachers" };

export default async function TeachersPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [levels, teachers, { year }] = await Promise.all([getQuranLevels(), getTeachers(), resolveSchoolYear(null)]);

  const counts = new Map<number, number>();
  if (year) {
    const { data } = await supabase
      .from("admin_registration_list")
      .select("teacher_id")
      .eq("school_year_id", year.id)
      .eq("is_active", true)
      .not("teacher_id", "is", null);
    for (const row of data ?? []) if (row.teacher_id) counts.set(row.teacher_id, (counts.get(row.teacher_id) ?? 0) + 1);
  }
  const levelName = (levelId: number) => formatQuranLevel(levelId, levels.find((l) => l.id === levelId)?.name);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/quran", label: "Quran" }}
        title="Quran teachers"
        description="Teachers are never deleted. Mark a teacher inactive to keep their history."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          {teachers.length === 0 ? (
            <EmptyState title="No teachers yet">Add your first Quran teacher using the form.</EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
              {teachers.map((teacher) => (
                <li key={teacher.id}>
                  <Link href={`/admin/quran/teachers/${teacher.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-mist-50">
                    <span>
                      <span className="block font-bold text-brand-700">
                        {teacher.name}
                        {!teacher.isActive && <span className="ml-2 text-sm font-semibold text-ink-500">Inactive</span>}
                      </span>
                      <span className="block text-sm text-ink-600">
                        {teacher.levelIds.length > 0 ? teacher.levelIds.map(levelName).join(" · ") : "No levels assigned"}
                      </span>
                    </span>
                    {year && (
                      <span className="text-sm text-ink-600">
                        <strong className="text-ink-900">{counts.get(teacher.id) ?? 0}</strong> students in {formatSchoolYear(year.label)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card>
          <CardHeader title="Add a teacher" />
          <div className="px-5 py-5 sm:px-6">
            <TeacherForm action={createTeacher} levels={levels} />
          </div>
        </Card>
      </div>
    </>
  );
}
