import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CapacityMeter } from "@/components/admin/capacity-meter";
import { EmptyState, PageHeader } from "@/components/admin/layout-parts";
import { YearSelect } from "@/components/admin/year-select";
import { Card, CardHeader } from "@/components/ui/card";
import { resolveSchoolYear } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { formatGradeRange, labelFor } from "@/lib/format";
import { ARABIC_LEVEL_LABELS } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createGroup } from "./actions";
import { GroupForm } from "./group-forms";

export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage({ searchParams }: PageProps<"/admin/groups">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = typeof params.year === "string" && /^\d+$/.test(params.year) ? Number(params.year) : null;
  const { years, year } = await resolveSchoolYear(requested);
  if (!year) return <EmptyState title="No school years yet" />;

  const supabase = await createSupabaseServerClient();
  const { data: groups, error } = await supabase
    .from("admin_group_overview")
    .select("id, name, minimum_grade, maximum_grade, arabic_level, teacher_name, capacity, enrolled_count")
    .eq("school_year_id", year.id)
    .order("name");
  if (error) throw new Error("Could not load groups");

  const yearOptions = [year, ...years.filter((y) => y.id !== year.id)].map((y) => ({ id: y.id, label: formatSchoolYear(y.label) }));

  return (
    <>
      <PageHeader
        title="Groups & classes"
        description={`${formatSchoolYear(year.label)} · ${groups.length} group${groups.length === 1 ? "" : "s"}`}
        actions={
          <Suspense>
            <YearSelect years={years} selectedId={year.id} />
          </Suspense>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          {groups.length === 0 ? (
            <EmptyState title="No groups for this school year">Create the first group using the form.</EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <li key={group.id}>
                  <Link href={`/admin/groups/${group.id}`} className="block h-full rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] hover:border-pine-600">
                    <p className="font-serif text-lg font-semibold text-pine-900">{group.name}</p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {formatGradeRange(group.minimum_grade, group.maximum_grade)} · {group.arabic_level ? labelFor(ARABIC_LEVEL_LABELS, group.arabic_level) : "Mixed levels"}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">Teacher: {group.teacher_name ?? "Not assigned"}</p>
                    <div className="mt-4">
                      <CapacityMeter enrolled={group.enrolled_count} capacity={group.capacity} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card>
          <CardHeader title="Create a group" />
          <div className="px-5 py-5 sm:px-6">
            <GroupForm action={createGroup} years={yearOptions} submitLabel="Create group" />
          </div>
        </Card>
      </div>
    </>
  );
}
