"use client";

import { ActionForm } from "@/components/admin/action-form";
import { FormCheckbox, FormInput, FormSelect, FormTextarea } from "@/components/admin/form-controls";
import type { ActionResult } from "@/lib/admin/actions";
import {
  ARABIC_LEVEL_LABELS,
  ARABIC_LEVELS,
  GRADE_LABELS,
  GRADES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
  SPECIAL_CONSIDERATIONS_MAX_LENGTH,
} from "@/lib/registration/options";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

const gradeOptions = GRADES.map((g) => ({ value: g, label: GRADE_LABELS[g] }));

export function ProfileForm({
  action,
  student,
}: {
  action: Action;
  student: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    grade: string;
    arabic_level: string | null;
    studied_arabic_before: boolean | null;
  };
}) {
  return (
    <ActionForm action={action} submitLabel="Save profile">
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput id="profile-first" name="firstName" label="First name" defaultValue={student.first_name} maxLength={80} error={state?.fieldErrors?.firstName} />
          <FormInput id="profile-last" name="lastName" label="Last name" defaultValue={student.last_name} maxLength={80} error={state?.fieldErrors?.lastName} />
          <FormInput id="profile-dob" name="dateOfBirth" type="date" label="Date of birth" defaultValue={student.date_of_birth} error={state?.fieldErrors?.dateOfBirth} />
          <FormSelect id="profile-grade" name="grade" label="Current grade" defaultValue={student.grade} options={gradeOptions} error={state?.fieldErrors?.grade} />
          <FormSelect
            id="profile-level"
            name="arabicLevel"
            label="Arabic level"
            defaultValue={student.arabic_level ?? ""}
            placeholder="Not set"
            options={ARABIC_LEVELS.map((l) => ({ value: l, label: ARABIC_LEVEL_LABELS[l] }))}
          />
          <FormSelect
            id="profile-studied"
            name="studiedArabicBefore"
            label="Studied Arabic before"
            defaultValue={student.studied_arabic_before === null ? "" : student.studied_arabic_before ? "yes" : "no"}
            placeholder="Unknown"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </div>
      )}
    </ActionForm>
  );
}

export function RegistrationForm({
  action,
  registration,
}: {
  action: Action;
  registration: { id: number; status: string; grade: string; is_returning: boolean; needs_review: boolean };
}) {
  const prefix = `reg-${registration.id}`;
  return (
    <ActionForm action={action} submitLabel="Update registration">
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormSelect
            id={`${prefix}-status`}
            name="status"
            label="Status"
            defaultValue={registration.status}
            options={REGISTRATION_STATUSES.map((s) => ({ value: s, label: REGISTRATION_STATUS_LABELS[s] }))}
            error={state?.fieldErrors?.status}
          />
          <FormSelect id={`${prefix}-grade`} name="grade" label="Grade this year" defaultValue={registration.grade} options={gradeOptions} error={state?.fieldErrors?.grade} />
          <FormSelect
            id={`${prefix}-returning`}
            name="isReturning"
            label="Student type"
            defaultValue={registration.is_returning ? "yes" : "no"}
            options={[
              { value: "no", label: "New" },
              { value: "yes", label: "Returning" },
            ]}
          />
          {registration.needs_review && (
            <FormCheckbox
              id={`${prefix}-reviewed`}
              name="markReviewed"
              label="I've reviewed the flagged details. Clear the review flag."
              className="sm:col-span-3"
            />
          )}
        </div>
      )}
    </ActionForm>
  );
}

export function GroupForm({
  action,
  registrationId,
  currentGroupId,
  groups,
}: {
  action: Action;
  registrationId: number;
  currentGroupId: number | null;
  groups: { id: number; name: string; capacity: number; enrolled: number }[];
}) {
  return (
    <ActionForm action={action} submitLabel="Save group" submitVariant="secondary">
      <FormSelect
        id={`group-${registrationId}`}
        name="groupId"
        label="Class / group"
        defaultValue={currentGroupId ?? ""}
        placeholder="Not assigned"
        hint={groups.length === 0 ? "No groups exist for this school year yet. Create one on the Groups page." : undefined}
        options={groups.map((g) => ({
          value: g.id,
          label: `${g.name} (${g.enrolled}/${g.capacity}${g.enrolled >= g.capacity && g.id !== currentGroupId ? ", full" : ""})`,
        }))}
      />
    </ActionForm>
  );
}

export function PaymentSettingsForm({
  action,
  registration,
}: {
  action: Action;
  registration: { id: number; amount_due: number | null; payment_status: string; payment_note: string | null };
}) {
  const prefix = `pay-${registration.id}`;
  return (
    <ActionForm action={action} submitLabel="Save payment details" submitVariant="secondary">
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            id={`${prefix}-due`}
            name="amountDue"
            label="Amount due (USD)"
            inputMode="decimal"
            optional
            defaultValue={registration.amount_due ?? ""}
            error={state?.fieldErrors?.amountDue}
          />
          <div className="flex items-end pb-2">
            <FormCheckbox
              id={`${prefix}-waived`}
              name="waived"
              label="Waived / scholarship"
              defaultChecked={registration.payment_status === "waived"}
            />
          </div>
          <FormTextarea
            id={`${prefix}-note`}
            name="paymentNote"
            label="Internal payment note"
            optional
            rows={2}
            maxLength={1000}
            defaultValue={registration.payment_note ?? ""}
            className="sm:col-span-2"
            error={state?.fieldErrors?.paymentNote}
          />
        </div>
      )}
    </ActionForm>
  );
}

export function RecordPaymentForm({ action, registrationId, today }: { action: Action; registrationId: number; today: string }) {
  const prefix = `newpay-${registrationId}`;
  return (
    <ActionForm action={action} submitLabel="Record payment" resetOnSuccess>
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput id={`${prefix}-amount`} name="amount" label="Amount (USD)" inputMode="decimal" error={state?.fieldErrors?.amount} />
          <FormSelect
            id={`${prefix}-method`}
            name="paymentMethod"
            label="Method"
            defaultValue=""
            placeholder="Choose…"
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
            error={state?.fieldErrors?.paymentMethod}
          />
          <FormInput id={`${prefix}-date`} name="paidOn" type="date" label="Date received" defaultValue={today} max={today} error={state?.fieldErrors?.paidOn} />
          <FormInput
            id={`${prefix}-ref`}
            name="receiptReference"
            label="Receipt or check number"
            optional
            maxLength={80}
            hint="Never enter card or bank account numbers."
            error={state?.fieldErrors?.receiptReference}
          />
          <FormInput id={`${prefix}-note`} name="note" label="Note" optional maxLength={1000} className="sm:col-span-2" error={state?.fieldErrors?.note} />
        </div>
      )}
    </ActionForm>
  );
}

export function HealthNoteForm({ action, value }: { action: Action; value: string }) {
  return (
    <ActionForm action={action} submitLabel="Save" submitVariant="secondary">
      {(state) => (
        <FormTextarea
          id="health-note"
          name="specialConsiderations"
          label="Allergies, care needs or special considerations"
          hint="Visible only to full administrators. Leave empty to clear."
          defaultValue={value}
          maxLength={SPECIAL_CONSIDERATIONS_MAX_LENGTH}
          rows={4}
          error={state?.fieldErrors?.specialConsiderations}
        />
      )}
    </ActionForm>
  );
}

export function AddNoteForm({ action, registrations }: { action: Action; registrations: { id: number; label: string }[] }) {
  return (
    <ActionForm action={action} submitLabel="Add note" resetOnSuccess>
      {(state) => (
        <div className="space-y-3">
          <FormTextarea id="note-body" name="body" label="New internal note" rows={3} maxLength={4000} error={state?.fieldErrors?.body} />
          {registrations.length > 0 && (
            <FormSelect
              id="note-registration"
              name="registrationId"
              label="About registration"
              optional
              defaultValue=""
              placeholder="General note"
              options={registrations.map((r) => ({ value: r.id, label: r.label }))}
            />
          )}
        </div>
      )}
    </ActionForm>
  );
}
