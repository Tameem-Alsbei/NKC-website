import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CapacityMeter } from "@/components/admin/capacity-meter";
import { DeleteButton } from "@/components/admin/delete-button";
import { InlineActionButton } from "@/components/admin/inline-action-button";
import { PageHeader } from "@/components/admin/layout-parts";
import { RegistrationStatusBadge } from "@/components/admin/status-badges";
import { Card, CardHeader } from "@/components/ui/card";
import { getSchoolYears } from "@/lib/admin/data";
import { canManageSensitiveRecords } from "@/lib/auth/access";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, formatGradeRange, fullName, labelFor } from "@/lib/format";
import { ARABIC_LEVEL_LABELS, GRADE_LABELS, GRADES } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addStudentsToGroup, deleteGroup, removeFromGroup, updateGroup } from "../actions";
import { AddStudentsForm, GroupForm } from "../group-forms";

export const metadata: Metadata = { title: "Group" };

export default async function GroupDetailPage({ params }: PageProps<"/admin/groups/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const groupId = Number(id);

  const supabase = await createSupabaseServerClient();
  const { data: group, error } = await supabase.from("admin_group_overview").select("*").eq("id", groupId).maybeSingle();
  if (error) throw new Error("Could not load group");
  if (!group) notFound();

  const [rosterRes, candidatesRes, years] = await Promise.all([
    supabase
      .from("admin_registration_list")
      .select("registration_id, student_id, student_first_name, student_last_name, date_of_birth, grade, arabic_level, status, guardian_first_name, guardian_last_name, guardian_phone")
      .eq("group_id", groupId)
      .order("student_last_name"),
    supabase
      .from("admin_registration_list")
      .select("registration_id, student_first_name, student_last_name, grade, grade_rank, arabic_level")
      .eq("school_year_id", group.school_year_id)
      .is("group_id", null)
      .not("status", "in", "(withdrawn,rejected)")
      .order("grade_rank")
      .order("student_last_name")
      .limit(300),
    getSchoolYears(),
  ]);
  if (rosterRes.error || candidatesRes.error) throw new Error("Could not load group roster");

  const minRank = group.minimum_grade ? GRADES.indexOf(group.minimum_grade as (typeof GRADES)[number]) + 1 : null;
  const maxRank = group.maximum_grade ? GRADES.indexOf(group.maximum_grade as (typeof GRADES)[number]) + 1 : null;
  const candidates = candidatesRes.data
    .map((row) => {
      const inRange =
        (minRank === null || (row.grade_rank ?? 0) >= minRank) && (maxRank === null || (row.grade_rank ?? 99) <= maxRank);
      const levelMatches = !group.arabic_level || row.arabic_level === group.arabic_level;
      return {
        registrationId: row.registration_id,
        name: fullName(row.student_first_name, row.student_last_name),
        detail: `${labelFor(GRADE_LABELS, row.grade)} · ${labelFor(ARABIC_LEVEL_LABELS, row.arabic_level)}`,
        matches: inRange && levelMatches,
      };
    })
    .sort((a, b) => Number(b.matches) - Number(a.matches));

  const spotsLeft = Math.max(0, group.capacity - group.enrolled_count);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: `/admin/groups?year=${group.school_year_id}`, label: "All groups" }}
        title={group.name}
        description={`${formatSchoolYear(group.school_year)} · ${formatGradeRange(group.minimum_grade, group.maximum_grade)} · ${group.arabic_level ? labelFor(ARABIC_LEVEL_LABELS, group.arabic_level) : "Mixed levels"} · Teacher: ${group.teacher_name ?? "not assigned"}`}
        actions={
          canManageSensitiveRecords(admin) && group.enrolled_count === 0 ? (
            <DeleteButton action={deleteGroup.bind(null, group.id)} label="Delete group" confirmMessage={`Delete the group "${group.name}"?`} />
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Roster" />
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <CapacityMeter enrolled={group.enrolled_count} capacity={group.capacity} />
            </div>
            {rosterRes.data.length === 0 ? (
              <p className="px-6 py-6 text-sm text-ink-500">No students assigned yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rosterRes.data.map((student) => (
                  <li key={student.registration_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <div className="min-w-0">
                      <Link href={`/admin/students/${student.student_id}`} className="font-semibold text-pine-800 hover:underline">
                        {fullName(student.student_first_name, student.student_last_name)}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {labelFor(GRADE_LABELS, student.grade)} · Age {ageFromDateOfBirth(student.date_of_birth)} · {labelFor(ARABIC_LEVEL_LABELS, student.arabic_level)} ·{" "}
                        {fullName(student.guardian_first_name, student.guardian_last_name)} {student.guardian_phone ?? ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      <RegistrationStatusBadge status={student.status} />
                      <InlineActionButton
                        action={removeFromGroup.bind(null, group.id, student.registration_id)}
                        label="Remove"
                        pendingLabel="Removing…"
                        tone="danger"
                        confirmMessage={`Remove ${student.student_first_name} from ${group.name}?`}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Add students" />
            <div className="px-5 py-5 sm:px-6">
              {candidates.length === 0 ? (
                <p className="text-sm text-ink-500">Every active student in this school year is already in a group.</p>
              ) : spotsLeft === 0 ? (
                <p className="text-sm text-ink-500">This group is full. Increase its capacity to add more students.</p>
              ) : (
                <AddStudentsForm action={addStudentsToGroup.bind(null, group.id)} candidates={candidates} spotsLeft={spotsLeft} />
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Group details" />
          <div className="px-5 py-5 sm:px-6">
            <GroupForm
              action={updateGroup.bind(null, group.id)}
              years={years.map((y) => ({ id: y.id, label: formatSchoolYear(y.label) }))}
              group={group}
              submitLabel="Save group"
            />
          </div>
        </Card>
      </div>
    </>
  );
}
