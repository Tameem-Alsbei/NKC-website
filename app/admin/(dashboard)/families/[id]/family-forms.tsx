"use client";

import { ActionForm } from "@/components/admin/action-form";
import { FormInput, FormSelect } from "@/components/admin/form-controls";
import type { ActionResult } from "@/lib/admin/actions";
import { RELATIONSHIP_LABELS, RELATIONSHIPS } from "@/lib/registration/options";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

export function HouseholdForm({
  action,
  household,
}: {
  action: Action;
  household: {
    display_name: string;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relationship: string | null;
  };
}) {
  return (
    <ActionForm action={action} submitLabel="Save family details" submitVariant="secondary">
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput id="hh-name" name="displayName" label="Family name" defaultValue={household.display_name} maxLength={120} error={state?.fieldErrors?.displayName} className="sm:col-span-2" />
          <FormInput id="hh-em-name" name="emergencyName" label="Emergency contact" optional defaultValue={household.emergency_contact_name ?? ""} maxLength={120} error={state?.fieldErrors?.emergencyName} />
          <FormInput id="hh-em-phone" name="emergencyPhone" type="tel" label="Emergency phone" optional defaultValue={household.emergency_contact_phone ?? ""} maxLength={25} error={state?.fieldErrors?.emergencyPhone} />
          <FormInput
            id="hh-em-rel"
            name="emergencyRelationship"
            label="Relationship"
            optional
            defaultValue={household.emergency_contact_relationship ?? ""}
            maxLength={60}
            error={state?.fieldErrors?.emergencyRelationship}
          />
        </div>
      )}
    </ActionForm>
  );
}

export function GuardianForm({
  action,
  guardian,
}: {
  action: Action;
  guardian: { id: number; first_name: string; last_name: string; email: string | null; phone: string | null };
}) {
  const prefix = `guardian-${guardian.id}`;
  return (
    <ActionForm action={action} submitLabel="Save contact" submitVariant="secondary">
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput id={`${prefix}-first`} name="firstName" label="First name" defaultValue={guardian.first_name} maxLength={80} error={state?.fieldErrors?.firstName} />
          <FormInput id={`${prefix}-last`} name="lastName" label="Last name" defaultValue={guardian.last_name} maxLength={80} error={state?.fieldErrors?.lastName} />
          <FormInput id={`${prefix}-email`} name="email" type="email" label="Email" optional defaultValue={guardian.email ?? ""} maxLength={254} error={state?.fieldErrors?.email} />
          <FormInput id={`${prefix}-phone`} name="phone" type="tel" label="Phone" optional defaultValue={guardian.phone ?? ""} maxLength={25} error={state?.fieldErrors?.phone} />
        </div>
      )}
    </ActionForm>
  );
}

export function AddGuardianForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submitLabel="Add guardian" resetOnSuccess>
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput id="new-guardian-first" name="firstName" label="First name" maxLength={80} error={state?.fieldErrors?.firstName} />
          <FormInput id="new-guardian-last" name="lastName" label="Last name" maxLength={80} error={state?.fieldErrors?.lastName} />
          <FormSelect
            id="new-guardian-relationship"
            name="relationship"
            label="Relationship"
            defaultValue=""
            placeholder="Choose…"
            options={RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_LABELS[r] }))}
            error={state?.fieldErrors?.relationship}
            className="sm:col-span-2"
          />
          <FormInput id="new-guardian-email" name="email" type="email" label="Email" optional maxLength={254} error={state?.fieldErrors?.email} />
          <FormInput id="new-guardian-phone" name="phone" type="tel" label="Phone" optional maxLength={25} error={state?.fieldErrors?.phone} />
        </div>
      )}
    </ActionForm>
  );
}
