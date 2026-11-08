import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ColorGroupLabel } from "@/components/admin/color-group-label";
import { DistributionList } from "@/components/admin/distribution";
import { EmptyState, PageHeader, StatCard } from "@/components/admin/layout-parts";
import { PaymentStatusBadge, RegistrationStatusBadge } from "@/components/admin/status-badges";
import { YearSelect } from "@/components/admin/year-select";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { getColorGroups, getQuranLevels, resolveSchoolYear } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/admin";
import { formatDateTime, fullName } from "@/lib/format";
import { formatQuranLevel, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

type Stats = {
  totalRegistrations: number;
  activeStudents: number;
  newStudents: number;
  returningStudents: number;
  pending: number;
  needsReview: number;
  registeredLast7Days: number;
  unassignedColorGroup: number;
  unassignedQuranLevel: number;
  levelWithoutTeacher: number;
  byPaymentStatus: Record<string, number>;
  byColorGroup: Record<string, number>;
  byQuranLevel: Record<string, number>;
  teacherRosters: { teacherId: number; teacherName: string; quranLevelId: number; count: number }[];
};

const EMPTY_STATS: Stats = {
  totalRegistrations: 0,
  activeStudents: 0,
  newStudents: 0,
  returningStudents: 0,
  pending: 0,
  needsReview: 0,
  registeredLast7Days: 0,
  unassignedColorGroup: 0,
  unassignedQuranLevel: 0,
  levelWithoutTeacher: 0,
  byPaymentStatus: {},
  byColorGroup: {},
  byQuranLevel: {},
  teacherRosters: [],
};

export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = typeof params.year === "string" && /^\d+$/.test(params.year) ? Number(params.year) : null;
  const { years, year } = await resolveSchoolYear(requested);

  if (!year) {
    return (
      <>
        <PageHeader title="Overview" />
        <EmptyState title="No school years yet">Apply the database migrations to create the first school year.</EmptyState>
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [statsResult, recentResult, colorGroups, levels] = await Promise.all([
    supabase.rpc("admin_dashboard_stats", { p_school_year_id: year.id }),
    supabase
      .from("admin_registration_list")
      .select("registration_id, student_id, student_first_name, student_last_name, grade, status, payment_status, registered_at")
      .eq("school_year_id", year.id)
      .order("registered_at", { ascending: false })
      .limit(6),
    getColorGroups(),
    getQuranLevels(),
  ]);

  if (statsResult.error || recentResult.error) throw new Error("Could not load dashboard data");
  const stats = { ...EMPTY_STATS, ...(statsResult.data as Partial<Stats>) };
  const recent = recentResult.data;
  const y = `year=${year.id}`;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${formatSchoolYear(year.label)} · Registration is ${year.registration_open ? "open" : "closed"}`}
        actions={
          <Suspense>
            <YearSelect years={years} selectedId={year.id} />
          </Suspense>
        }
      />

      {stats.needsReview > 0 && (
        <Link
          href={`/admin/students?${y}&review=1`}
          className="mb-6 flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-danger-200 bg-danger-50 px-5 py-4 text-danger-800 hover:border-danger-700"
        >
          <span>
            <strong className="font-bold">
              {stats.needsReview} registration{stats.needsReview === 1 ? " needs" : "s need"} review
            </strong>{" "}
            · possible duplicates or details that differ from existing records
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <section aria-label="Registrations" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active students" value={stats.activeStudents} hint={`${stats.registeredLast7Days} registered in the last 7 days`} href={`/admin/students?${y}`} />
        <StatCard label="New students" value={stats.newStudents} href={`/admin/students?${y}&returning=new`} />
        <StatCard label="Returning students" value={stats.returningStudents} href={`/admin/students?${y}&returning=returning`} />
        <StatCard label="Pending registrations" value={stats.pending} hint="Pending or under review" href={`/admin/students?${y}&status=pending`} />
      </section>

      <section aria-label="Placement" className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="No color group"
          value={stats.unassignedColorGroup}
          href={`/admin/color-groups?${y}`}
          tone={stats.unassignedColorGroup > 0 ? "attention" : "default"}
        />
        <StatCard
          label="No Quran level"
          value={stats.unassignedQuranLevel}
          href={`/admin/quran?${y}#unassigned`}
          tone={stats.unassignedQuranLevel > 0 ? "attention" : "default"}
        />
        <StatCard
          label="Level but no Quran teacher"
          value={stats.levelWithoutTeacher}
          href={`/admin/students?${y}&teacher=none&assignment=unassigned`}
          tone={stats.levelWithoutTeacher > 0 ? "attention" : "default"}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5 sm:p-6">
          <DistributionList
            title="Color groups"
            items={colorGroups.map((group) => ({ label: group.name, value: stats.byColorGroup[group.slug] ?? 0, color: group.color_hex }))}
          />
        </Card>
        <Card className="p-5 sm:p-6">
          <DistributionList
            title="Quran levels"
            items={levels.map((level) => ({ label: formatQuranLevel(level.id, level.name), value: stats.byQuranLevel[String(level.id)] ?? 0 }))}
          />
        </Card>
        <Card>
          <CardHeader title="Payments" description="Active registrations" />
          <ul className="grid grid-cols-2 gap-px bg-line">
            {PAYMENT_STATUSES.map((status) => (
              <li key={status} className="bg-white">
                <Link href={`/admin/students?${y}&payment=${status}`} className="block px-5 py-4 hover:bg-mist-50">
                  <span className="text-sm text-ink-500">{PAYMENT_STATUS_LABELS[status]}</span>
                  <span className="mt-0.5 block font-display text-2xl font-semibold text-brand-800">{stats.byPaymentStatus[status] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Quran teacher rosters"
            action={
              <ButtonLink href={`/admin/quran?${y}`} variant="ghost" size="sm">
                Manage Quran
              </ButtonLink>
            }
          />
          {stats.teacherRosters.length === 0 ? (
            <p className="px-6 py-6 text-sm text-ink-500">No students have been assigned to a Quran teacher this year yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Students per Quran teacher and level</caption>
              <thead className="bg-mist-50 text-xs font-bold uppercase tracking-wide text-ink-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5">Teacher</th>
                  <th scope="col" className="px-5 py-2.5">Level</th>
                  <th scope="col" className="px-5 py-2.5 text-right">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.teacherRosters.map((roster) => (
                  <tr key={`${roster.teacherId}-${roster.quranLevelId}`}>
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/quran/teachers/${roster.teacherId}?${y}`} className="font-bold text-brand-700 hover:underline">
                        {roster.teacherName}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5">{formatQuranLevel(roster.quranLevelId, levels.find((l) => l.id === roster.quranLevelId)?.name)}</td>
                    <td className="px-5 py-2.5 text-right font-bold tabular-nums">{roster.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Recent registrations"
            action={
              <ButtonLink href={`/admin/students?${y}`} variant="ghost" size="sm">
                View all
              </ButtonLink>
            }
          />
          {recent.length === 0 ? (
            <p className="px-6 py-8 text-sm text-ink-500">No registrations for this school year yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((row) => (
                <li key={row.registration_id}>
                  <Link href={`/admin/students/${row.student_id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-mist-50 sm:px-6">
                    <span className="min-w-0">
                      <span className="block font-bold text-ink-900">{fullName(row.student_first_name, row.student_last_name)}</span>
                      <span className="block text-xs text-ink-500">{formatDateTime(row.registered_at)}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <RegistrationStatusBadge status={row.status} />
                      <PaymentStatusBadge status={row.payment_status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {colorGroups.length > 0 && (
        <p className="mt-6 flex flex-wrap gap-4 text-sm text-ink-600">
          {colorGroups.map((group) => (
            <Link key={group.id} href={`/admin/color-groups/${group.id}?${y}`} className="hover:underline">
              <ColorGroupLabel name={`${group.name} roster`} color={group.color_hex} />
            </Link>
          ))}
        </p>
      )}
    </>
  );
}
