import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/admin/delete-button";
import { DetailItem, PageHeader } from "@/components/admin/layout-parts";
import { NeedsReviewBadge, PaymentStatusBadge, RegistrationStatusBadge } from "@/components/admin/status-badges";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { describeAuditEntry } from "@/lib/admin/audit";
import { getAdminNames, getGroupOptions } from "@/lib/admin/data";
import { canManageSensitiveRecords, canViewHealthNotes } from "@/lib/auth/access";
import { requireAdmin } from "@/lib/auth/admin";
import type { Json } from "@/lib/database.types";
import { ageFromDateOfBirth, formatDate, formatDateTime, formatMoney, fullName, labelFor } from "@/lib/format";
import {
  ARABIC_LEVEL_LABELS,
  GRADE_LABELS,
  PAYMENT_METHOD_LABELS,
  RELATIONSHIP_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addAdminNote,
  assignGroup,
  deleteAdminNote,
  deletePayment,
  recordPayment,
  saveHealthNote,
  updatePaymentSettings,
  updateRegistration,
  updateStudentProfile,
} from "./actions";
import {
  AddNoteForm,
  GroupForm,
  HealthNoteForm,
  PaymentSettingsForm,
  ProfileForm,
  RecordPaymentForm,
  RegistrationForm,
} from "./student-forms";

export const metadata: Metadata = { title: "Student" };

type SubmittedContact = {
  primaryGuardian?: { firstName?: string; lastName?: string; email?: string; phone?: string };
  secondaryGuardian?: { firstName?: string; lastName?: string; email?: string; phone?: string };
  emergencyContact?: { name?: string; phone?: string; relationship?: string };
};

function asContact(value: Json | undefined): SubmittedContact {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SubmittedContact) : {};
}

export default async function StudentDetailPage({ params }: PageProps<"/admin/students/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const studentId = Number(id);
  const showHealth = canViewHealthNotes(admin);

  const supabase = await createSupabaseServerClient();
  const [studentRes, guardiansRes, registrationsRes, listRes, notesRes, healthRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, household_id, first_name, last_name, date_of_birth, grade, arabic_level, studied_arabic_before, created_at, updated_at")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("student_parents")
      .select("relationship, is_primary_contact, parents(id, first_name, last_name, email, phone, household_id)")
      .eq("student_id", studentId)
      .order("is_primary_contact", { ascending: false }),
    supabase
      .from("registrations")
      .select(
        "id, school_year_id, reference_code, grade, status, is_returning, needs_review, review_reasons, acknowledged_at, amount_due, payment_status, payment_note, registered_at, status_changed_at, status_changed_by, updated_at, submission_id, school_years(label)",
      )
      .eq("student_id", studentId)
      .order("registered_at", { ascending: false }),
    supabase.from("admin_registration_list").select("registration_id, group_id, group_name, amount_paid").eq("student_id", studentId),
    supabase
      .from("admin_notes")
      .select("id, body, author_id, registration_id, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    showHealth
      ? supabase.from("student_health_notes").select("special_considerations, updated_at, updated_by").eq("student_id", studentId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (studentRes.error || guardiansRes.error || registrationsRes.error || listRes.error || notesRes.error || healthRes.error) {
    throw new Error("Could not load student");
  }
  const student = studentRes.data;
  if (!student) notFound();

  const registrations = registrationsRes.data;
  const registrationIds = registrations.map((r) => r.id);
  const listById = new Map(listRes.data.map((row) => [row.registration_id, row]));
  const submissionIds = registrations.filter((r) => r.needs_review && r.submission_id).map((r) => r.submission_id as number);

  const auditFilter = [
    `and(table_name.in.(students,student_health_notes),record_id.eq.${studentId})`,
    ...(registrationIds.length > 0
      ? [`and(table_name.in.(registrations,student_group_assignments),record_id.in.(${registrationIds.join(",")}))`]
      : []),
  ].join(",");

  const [paymentsRes, submissionsRes, householdRes, auditRes, groups, adminNames] = await Promise.all([
    registrationIds.length
      ? supabase
          .from("payments")
          .select("id, registration_id, amount, payment_method, receipt_reference, note, paid_at, recorded_by")
          .in("registration_id", registrationIds)
          .order("paid_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    submissionIds.length
      ? supabase.from("registration_submissions").select("id, submitted_contact").in("id", submissionIds)
      : Promise.resolve({ data: [], error: null }),
    student.household_id
      ? supabase
          .from("households")
          .select("id, display_name, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship")
          .eq("id", student.household_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("audit_logs")
      .select("id, actor_id, action, table_name, record_id, changed_fields, old_values, new_values, created_at")
      .or(auditFilter)
      .order("created_at", { ascending: false })
      .limit(25),
    getGroupOptions([...new Set(registrations.map((r) => r.school_year_id))]),
    getAdminNames(),
  ]);

  const payments = paymentsRes.data ?? [];
  const submissions = new Map((submissionsRes.data ?? []).map((s) => [s.id, asContact(s.submitted_contact)]));
  const household = householdRes.data;
  const audit = auditRes.data ?? [];
  const nameOf = (userId: string | null) => (userId ? (adminNames.get(userId) ?? "Former administrator") : "System");
  const today = new Date().toISOString().slice(0, 10);
  const studentName = fullName(student.first_name, student.last_name);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/students", label: "All students" }}
        title={studentName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {labelFor(GRADE_LABELS, student.grade)} · Age {ageFromDateOfBirth(student.date_of_birth)} ·{" "}
              {labelFor(ARABIC_LEVEL_LABELS, student.arabic_level)}
            </span>
            {registrations.some((r) => r.needs_review) && <NeedsReviewBadge />}
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Registrations */}
        <div className="space-y-6">
          {registrations.length === 0 && (
            <Card className="p-6 text-ink-500">This student has no registrations.</Card>
          )}
          {registrations.map((registration) => {
            const list = listById.get(registration.id);
            const yearGroups = groups.filter((g) => g.schoolYearId === registration.school_year_id);
            const regPayments = payments.filter((p) => p.registration_id === registration.id);
            const submitted = registration.submission_id ? submissions.get(registration.submission_id) : undefined;
            const yearLabel = registration.school_years?.label ?? "";
            return (
              <Card key={registration.id}>
                <CardHeader
                  title={`${formatSchoolYear(yearLabel)} registration`}
                  description={`Reference ${registration.reference_code} · Submitted ${formatDateTime(registration.registered_at)}`}
                  action={
                    <span className="flex flex-wrap gap-1.5">
                      <RegistrationStatusBadge status={registration.status} />
                      <PaymentStatusBadge status={registration.payment_status} />
                    </span>
                  }
                />
                <div className="space-y-6 px-5 py-5 sm:px-6">
                  {registration.needs_review && (
                    <Alert tone="warning" title="Needs review">
                      <ul className="list-disc space-y-0.5 pl-4">
                        {registration.review_reasons.map((reason) => (
                          <li key={reason}>{REVIEW_REASON_LABELS[reason] ?? reason}</li>
                        ))}
                      </ul>
                      {submitted && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-semibold">Details as submitted by the family</summary>
                          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                            {submitted.primaryGuardian && (
                              <div>
                                <dt className="font-semibold">Primary guardian</dt>
                                <dd>
                                  {fullName(submitted.primaryGuardian.firstName, submitted.primaryGuardian.lastName)}
                                  <br />
                                  {submitted.primaryGuardian.email}
                                  <br />
                                  {submitted.primaryGuardian.phone}
                                </dd>
                              </div>
                            )}
                            {submitted.secondaryGuardian && (
                              <div>
                                <dt className="font-semibold">Second guardian</dt>
                                <dd>
                                  {fullName(submitted.secondaryGuardian.firstName, submitted.secondaryGuardian.lastName)}
                                  {submitted.secondaryGuardian.email && <><br />{submitted.secondaryGuardian.email}</>}
                                  {submitted.secondaryGuardian.phone && <><br />{submitted.secondaryGuardian.phone}</>}
                                </dd>
                              </div>
                            )}
                            {submitted.emergencyContact && (
                              <div>
                                <dt className="font-semibold">Emergency contact</dt>
                                <dd>
                                  {submitted.emergencyContact.name} · {submitted.emergencyContact.phone}
                                  {submitted.emergencyContact.relationship ? ` (${submitted.emergencyContact.relationship})` : ""}
                                </dd>
                              </div>
                            )}
                          </dl>
                        </details>
                      )}
                    </Alert>
                  )}

                  <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
                    <DetailItem label="Grade">{labelFor(GRADE_LABELS, registration.grade)}</DetailItem>
                    <DetailItem label="Type">{registration.is_returning ? "Returning" : "New"}</DetailItem>
                    <DetailItem label="Group">{list?.group_name ?? "Not assigned"}</DetailItem>
                    <DetailItem label="Status changed">
                      {registration.status_changed_at
                        ? `${formatDateTime(registration.status_changed_at)} by ${nameOf(registration.status_changed_by)}`
                        : "Not yet"}
                    </DetailItem>
                  </dl>

                  <section aria-labelledby={`reg-manage-${registration.id}`}>
                    <h3 id={`reg-manage-${registration.id}`} className="mb-3 font-semibold text-ink-900">
                      Registration status
                    </h3>
                    <RegistrationForm action={updateRegistration.bind(null, student.id, registration.id)} registration={registration} />
                  </section>

                  <section aria-labelledby={`reg-group-${registration.id}`} className="border-t border-line pt-5">
                    <h3 id={`reg-group-${registration.id}`} className="mb-3 font-semibold text-ink-900">
                      Group placement
                    </h3>
                    <GroupForm
                      action={assignGroup.bind(null, student.id, registration.id)}
                      registrationId={registration.id}
                      currentGroupId={list?.group_id ?? null}
                      groups={yearGroups}
                    />
                  </section>

                  <section aria-labelledby={`reg-pay-${registration.id}`} className="border-t border-line pt-5">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 id={`reg-pay-${registration.id}`} className="font-semibold text-ink-900">
                        Payments
                      </h3>
                      <p className="text-sm text-ink-600">
                        Paid <strong>{formatMoney(list?.amount_paid ?? 0)}</strong> of{" "}
                        <strong>{registration.amount_due === null ? "amount not set" : formatMoney(registration.amount_due)}</strong>
                      </p>
                    </div>
                    <PaymentSettingsForm action={updatePaymentSettings.bind(null, student.id, registration.id)} registration={registration} />

                    {regPayments.length > 0 && (
                      <div className="mt-5 overflow-x-auto rounded-xl border border-line">
                        <table className="w-full text-left text-sm">
                          <caption className="sr-only">Payments recorded</caption>
                          <thead className="bg-cream-50 text-xs uppercase tracking-wide text-ink-500">
                            <tr>
                              <th scope="col" className="px-3 py-2">Date</th>
                              <th scope="col" className="px-3 py-2">Amount</th>
                              <th scope="col" className="px-3 py-2">Method</th>
                              <th scope="col" className="px-3 py-2">Reference / note</th>
                              <th scope="col" className="px-3 py-2">Recorded by</th>
                              {canManageSensitiveRecords(admin) && <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {regPayments.map((payment) => (
                              <tr key={payment.id}>
                                <td className="whitespace-nowrap px-3 py-2">{formatDate(payment.paid_at.slice(0, 10))}</td>
                                <td className="whitespace-nowrap px-3 py-2 font-semibold">{formatMoney(payment.amount)}</td>
                                <td className="px-3 py-2">{labelFor(PAYMENT_METHOD_LABELS, payment.payment_method)}</td>
                                <td className="px-3 py-2 text-ink-600">{[payment.receipt_reference, payment.note].filter(Boolean).join(" · ") || "—"}</td>
                                <td className="px-3 py-2 text-ink-600">{nameOf(payment.recorded_by)}</td>
                                {canManageSensitiveRecords(admin) && (
                                  <td className="px-3 py-2 text-right">
                                    <DeleteButton
                                      action={deletePayment.bind(null, student.id, payment.id)}
                                      confirmMessage={`Delete the ${formatMoney(payment.amount)} payment from ${formatDate(payment.paid_at.slice(0, 10))}?`}
                                      accessibleLabel={`Delete ${formatMoney(payment.amount)} payment`}
                                    />
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <details className="mt-5 rounded-xl border border-line bg-cream-50 px-4 py-3">
                      <summary className="cursor-pointer font-semibold text-pine-800">Record a payment</summary>
                      <div className="mt-4">
                        <RecordPaymentForm action={recordPayment.bind(null, student.id, registration.id)} registrationId={registration.id} today={today} />
                      </div>
                    </details>
                  </section>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Parents & guardians" action={
              household ? (
                <Link href={`/admin/families/${household.id}`} className="rounded text-sm font-semibold text-pine-700 hover:underline">
                  View family
                </Link>
              ) : undefined
            } />
            <ul className="divide-y divide-line">
              {guardiansRes.data.length === 0 && <li className="px-6 py-4 text-sm text-ink-500">No guardians linked.</li>}
              {guardiansRes.data.map((link) =>
                link.parents ? (
                  <li key={link.parents.id} className="px-5 py-4 sm:px-6">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                      {fullName(link.parents.first_name, link.parents.last_name)}
                      {link.is_primary_contact && <Badge tone="green">Primary contact</Badge>}
                    </p>
                    <p className="text-sm text-ink-500">{labelFor(RELATIONSHIP_LABELS, link.relationship)}</p>
                    <div className="mt-1 space-y-0.5 text-sm">
                      {link.parents.email && (
                        <a className="block text-pine-700 hover:underline" href={`mailto:${link.parents.email}`}>
                          {link.parents.email}
                        </a>
                      )}
                      {link.parents.phone && (
                        <a className="block text-pine-700 hover:underline" href={`tel:${link.parents.phone}`}>
                          {link.parents.phone}
                        </a>
                      )}
                    </div>
                  </li>
                ) : null,
              )}
            </ul>
            {household && (
              <div className="border-t border-line px-5 py-4 text-sm sm:px-6">
                <p className="font-semibold text-ink-900">Emergency contact</p>
                <p className="text-ink-700">
                  {household.emergency_contact_name ?? "Not provided"}
                  {household.emergency_contact_relationship ? ` (${household.emergency_contact_relationship})` : ""}
                </p>
                {household.emergency_contact_phone && (
                  <a className="text-pine-700 hover:underline" href={`tel:${household.emergency_contact_phone}`}>
                    {household.emergency_contact_phone}
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Special considerations" description="Health, allergy and care information" />
            <div className="px-5 py-5 sm:px-6">
              {showHealth ? (
                <>
                  {healthRes.data && (
                    <p className="mb-3 text-xs text-ink-500">
                      Last updated {formatDateTime(healthRes.data.updated_at)}
                      {healthRes.data.updated_by ? ` by ${nameOf(healthRes.data.updated_by)}` : " (from registration)"}
                    </p>
                  )}
                  <HealthNoteForm action={saveHealthNote.bind(null, student.id)} value={healthRes.data?.special_considerations ?? ""} />
                </>
              ) : (
                <p className="text-sm text-ink-600">
                  This information is restricted to full administrators. Ask a school administrator if you need it.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Student profile" description={`Created ${formatDate(student.created_at.slice(0, 10))} · Updated ${formatDateTime(student.updated_at)}`} />
            <div className="px-5 py-5 sm:px-6">
              <ProfileForm action={updateStudentProfile.bind(null, student.id)} student={student} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Internal notes" description="Visible to school administrators only" />
            <div className="px-5 py-5 sm:px-6">
              <AddNoteForm
                action={addAdminNote.bind(null, student.id)}
                registrations={registrations.map((r) => ({ id: r.id, label: `${formatSchoolYear(r.school_years?.label ?? "")} (${r.reference_code})` }))}
              />
              <ul className="mt-6 space-y-4">
                {notesRes.data.map((note) => (
                  <li key={note.id} className="rounded-xl bg-cream-50 p-4 ring-1 ring-line">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-ink-500">
                        {nameOf(note.author_id)} · {formatDateTime(note.created_at)}
                      </p>
                      {(note.author_id === admin.userId || canManageSensitiveRecords(admin)) && (
                        <DeleteButton
                          action={deleteAdminNote.bind(null, student.id, note.id)}
                          confirmMessage="Delete this note?"
                          accessibleLabel="Delete note"
                        />
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-900">{note.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Change history" />
            {audit.length === 0 ? (
              <p className="px-6 py-5 text-sm text-ink-500">No administrative changes yet.</p>
            ) : (
              <ol className="divide-y divide-line">
                {audit.map((entry) => (
                  <li key={entry.id} className="px-5 py-3 text-sm sm:px-6">
                    <p className="text-ink-900">{describeAuditEntry(entry)}</p>
                    <p className="text-xs text-ink-500">
                      {nameOf(entry.actor_id)} · {formatDateTime(entry.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
