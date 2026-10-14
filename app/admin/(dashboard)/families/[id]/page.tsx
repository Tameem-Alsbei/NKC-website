import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineActionButton } from "@/components/admin/inline-action-button";
import { PageHeader } from "@/components/admin/layout-parts";
import { NeedsReviewBadge, PaymentStatusBadge, RegistrationStatusBadge } from "@/components/admin/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { ageFromDateOfBirth, formatDate, fullName, labelFor } from "@/lib/format";
import { GRADE_LABELS, RELATIONSHIP_LABELS } from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addGuardian, makePrimaryContact, unlinkGuardian, updateGuardian, updateHousehold } from "./actions";
import { AddGuardianForm, GuardianForm, HouseholdForm } from "./family-forms";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyDetailPage({ params }: PageProps<"/admin/families/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const householdId = Number(id);

  const supabase = await createSupabaseServerClient();
  const [householdRes, guardiansRes, childrenRes, registrationsRes] = await Promise.all([
    supabase
      .from("households")
      .select("id, display_name, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, created_at")
      .eq("id", householdId)
      .maybeSingle(),
    supabase.from("parents").select("id, first_name, last_name, email, phone, created_at").eq("household_id", householdId).order("id"),
    supabase
      .from("students")
      .select("id, first_name, last_name, date_of_birth, grade, student_parents(parent_id, relationship, is_primary_contact)")
      .eq("household_id", householdId)
      .order("date_of_birth"),
    supabase
      .from("admin_registration_list")
      .select("registration_id, student_id, student_first_name, student_last_name, school_year, reference_code, grade, status, payment_status, group_name, needs_review")
      .eq("household_id", householdId)
      .order("school_year", { ascending: false })
      .order("student_first_name"),
  ]);

  if (householdRes.error || guardiansRes.error || childrenRes.error || registrationsRes.error) {
    throw new Error("Could not load family");
  }
  const household = householdRes.data;
  if (!household) notFound();
  const guardians = guardiansRes.data;
  const children = childrenRes.data;

  // Relationship and primary-contact status for each guardian, taken from the children's links.
  const linkInfo = (parentId: number) => {
    const links = children.flatMap((child) => child.student_parents.filter((link) => link.parent_id === parentId));
    return {
      relationship: links[0]?.relationship ?? null,
      isPrimary: links.some((link) => link.is_primary_contact),
      childCount: links.length,
    };
  };

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/families", label: "All families" }}
        title={household.display_name}
        description={`${children.length} ${children.length === 1 ? "child" : "children"} · ${guardians.length} ${guardians.length === 1 ? "guardian" : "guardians"} · Family since ${formatDate(household.created_at.slice(0, 10))}`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Children" />
            {children.length === 0 ? (
              <p className="px-6 py-5 text-sm text-ink-500">No children linked to this family.</p>
            ) : (
              <ul className="divide-y divide-line">
                {children.map((child) => (
                  <li key={child.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
                    <div>
                      <Link href={`/admin/students/${child.id}`} className="font-semibold text-pine-800 hover:underline">
                        {fullName(child.first_name, child.last_name)}
                      </Link>
                      <p className="text-sm text-ink-500">
                        {labelFor(GRADE_LABELS, child.grade)} · Age {ageFromDateOfBirth(child.date_of_birth)} · Born {formatDate(child.date_of_birth)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Registrations" description="All school years for this family" />
            {registrationsRes.data.length === 0 ? (
              <p className="px-6 py-5 text-sm text-ink-500">No registrations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Registrations for this family</caption>
                  <thead className="bg-cream-50 text-xs uppercase tracking-wide text-ink-500">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">Year</th>
                      <th scope="col" className="px-4 py-2.5">Student</th>
                      <th scope="col" className="px-4 py-2.5">Grade</th>
                      <th scope="col" className="px-4 py-2.5">Status</th>
                      <th scope="col" className="px-4 py-2.5">Payment</th>
                      <th scope="col" className="px-4 py-2.5">Group</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {registrationsRes.data.map((row) => (
                      <tr key={row.registration_id}>
                        <td className="whitespace-nowrap px-4 py-2.5">{formatSchoolYear(row.school_year)}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/students/${row.student_id}`} className="font-semibold text-pine-800 hover:underline">
                            {fullName(row.student_first_name, row.student_last_name)}
                          </Link>
                          <span className="block text-xs text-ink-500">{row.reference_code}</span>
                        </td>
                        <td className="px-4 py-2.5">{labelFor(GRADE_LABELS, row.grade)}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex flex-wrap gap-1">
                            <RegistrationStatusBadge status={row.status} />
                            {row.needs_review && <NeedsReviewBadge />}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><PaymentStatusBadge status={row.payment_status} /></td>
                        <td className="px-4 py-2.5">{row.group_name ?? <span className="text-ink-500">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Family details & emergency contact" />
            <div className="px-5 py-5 sm:px-6">
              <HouseholdForm action={updateHousehold.bind(null, household.id)} household={household} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Parents & guardians" />
            <ul className="divide-y divide-line">
              {guardians.length === 0 && <li className="px-6 py-5 text-sm text-ink-500">No guardians in this family.</li>}
              {guardians.map((guardian) => {
                const info = linkInfo(guardian.id);
                return (
                  <li key={guardian.id} className="px-5 py-5 sm:px-6">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                        {fullName(guardian.first_name, guardian.last_name)}
                        {info.relationship && <span className="text-sm font-normal text-ink-500">{labelFor(RELATIONSHIP_LABELS, info.relationship)}</span>}
                        {info.isPrimary && <Badge tone="green">Primary contact</Badge>}
                        {info.childCount === 0 && <Badge tone="muted">Not linked to children</Badge>}
                      </p>
                      <span className="flex flex-wrap gap-1">
                        {!info.isPrimary && info.childCount > 0 && (
                          <InlineActionButton action={makePrimaryContact.bind(null, household.id, guardian.id)} label="Make primary" />
                        )}
                        {guardians.length > 1 && (
                          <InlineActionButton
                            action={unlinkGuardian.bind(null, household.id, guardian.id)}
                            label="Remove from family"
                            pendingLabel="Removing…"
                            tone="danger"
                            confirmMessage={`Remove ${guardian.first_name} ${guardian.last_name} from this family? Their record is kept but no longer linked to these children.`}
                          />
                        )}
                      </span>
                    </div>
                    <GuardianForm action={updateGuardian.bind(null, household.id, guardian.id)} guardian={guardian} />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Add a guardian" description="They'll be linked to every child in this family." />
            <div className="px-5 py-5 sm:px-6">
              <AddGuardianForm action={addGuardian.bind(null, household.id)} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
