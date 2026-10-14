import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DistributionList } from "@/components/admin/distribution";
import { EmptyState, PageHeader, StatCard } from "@/components/admin/layout-parts";
import { PaymentStatusBadge, RegistrationStatusBadge } from "@/components/admin/status-badges";
import { YearSelect } from "@/components/admin/year-select";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { resolveSchoolYear } from "@/lib/admin/data";
import { formatDateTime, fullName } from "@/lib/format";
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

export const metadata: Metadata = { title: "Overview" };

type Stats = {
  totalRegistrations: number;
  totalStudents: number;
  newStudents: number;
  returningStudents: number;
  needsReview: number;
  registeredLast7Days: number;
  unassigned: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  byGrade: Record<string, number>;
  byArabicLevel: Record<string, number>;
};

const EMPTY_STATS: Stats = {
  totalRegistrations: 0,
  totalStudents: 0,
  newStudents: 0,
  returningStudents: 0,
  needsReview: 0,
  registeredLast7Days: 0,
  unassigned: 0,
  byStatus: {},
  byPaymentStatus: {},
  byGrade: {},
  byArabicLevel: {},
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
  const [statsResult, recentResult] = await Promise.all([
    supabase.rpc("admin_dashboard_stats", { p_school_year_id: year.id }),
    supabase
      .from("admin_registration_list")
      .select("registration_id, student_id, student_first_name, student_last_name, grade, status, payment_status, registered_at, needs_review")
      .eq("school_year_id", year.id)
      .order("registered_at", { ascending: false })
      .limit(8),
  ]);

  if (statsResult.error || recentResult.error) throw new Error("Could not load dashboard data");
  const stats = { ...EMPTY_STATS, ...(statsResult.data as Partial<Stats>) };
  const recent = recentResult.data;
  const yearQuery = `year=${year.id}`;

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <>
            {formatSchoolYear(year.label)} school year
            {year.registration_open ? " · Registration is open" : " · Registration is closed"}
          </>
        }
        actions={
          <Suspense>
            <YearSelect years={years} selectedId={year.id} />
          </Suspense>
        }
      />

      {stats.needsReview > 0 && (
        <Link
          href={`/admin/students?${yearQuery}&review=1`}
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-danger-200 bg-danger-50 px-5 py-4 text-danger-800 hover:border-danger-700"
        >
          <span>
            <strong className="font-semibold">
              {stats.needsReview} registration{stats.needsReview === 1 ? "" : "s"} need{stats.needsReview === 1 ? "s" : ""} review
            </strong>{" "}
            · possible duplicates or details that differ from existing records
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students registered" value={stats.totalStudents} hint={`${stats.registeredLast7Days} in the last 7 days`} href={`/admin/students?${yearQuery}`} />
        <StatCard label="New students" value={stats.newStudents} href={`/admin/students?${yearQuery}&returning=new`} />
        <StatCard label="Returning students" value={stats.returningStudents} href={`/admin/students?${yearQuery}&returning=returning`} />
        <StatCard
          label="Without a group"
          value={stats.unassigned}
          hint="Active registrations not yet placed"
          href={`/admin/students?${yearQuery}&group=none`}
          tone={stats.unassigned > 0 ? "attention" : "default"}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Registration status" />
          <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
            {REGISTRATION_STATUSES.map((status) => (
              <li key={status} className="bg-white">
                <Link href={`/admin/students?${yearQuery}&status=${status}`} className="block px-5 py-4 hover:bg-cream-50">
                  <span className="text-sm text-ink-500">{REGISTRATION_STATUS_LABELS[status]}</span>
                  <span className="mt-0.5 block font-serif text-2xl font-semibold text-pine-900">{stats.byStatus[status] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Payments" description="Excludes withdrawn and rejected registrations" />
          <ul className="grid grid-cols-2 gap-px bg-line">
            {PAYMENT_STATUSES.map((status) => (
              <li key={status} className="bg-white">
                <Link href={`/admin/students?${yearQuery}&payment=${status}`} className="block px-5 py-4 hover:bg-cream-50">
                  <span className="text-sm text-ink-500">{PAYMENT_STATUS_LABELS[status]}</span>
                  <span className="mt-0.5 block font-serif text-2xl font-semibold text-pine-900">{stats.byPaymentStatus[status] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr_1.3fr]">
        <Card className="p-5 sm:p-6">
          <DistributionList
            title="Students by grade"
            items={GRADES.filter((g) => (stats.byGrade[g] ?? 0) > 0).map((g) => ({ label: GRADE_LABELS[g], value: stats.byGrade[g] ?? 0 }))}
          />
        </Card>
        <Card className="p-5 sm:p-6">
          <DistributionList
            title="Students by Arabic level"
            items={[
              ...ARABIC_LEVELS.map((level) => ({ label: ARABIC_LEVEL_LABELS[level], value: stats.byArabicLevel[level] ?? 0 })),
              ...(stats.byArabicLevel.unknown ? [{ label: "Not set", value: stats.byArabicLevel.unknown }] : []),
            ]}
          />
        </Card>
        <Card>
          <CardHeader
            title="Recent registrations"
            action={
              <ButtonLink href={`/admin/students?${yearQuery}`} variant="ghost" size="sm">
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
                  <Link href={`/admin/students/${row.student_id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-cream-50 sm:px-6">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-900">{fullName(row.student_first_name, row.student_last_name)}</span>
                      <span className="block text-xs text-ink-500">
                        Grade {row.grade} · {formatDateTime(row.registered_at)}
                      </span>
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
    </>
  );
}
