"use client";

import { ActionForm } from "@/components/admin/action-form";
import { FormInput, FormSelect, FormTextarea } from "@/components/admin/form-controls";
import type { ActionResult } from "@/lib/admin/actions";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

/** Age and gender guidance for one color group (used for suggestions only). */
export function CriteriaForm({
  action,
  group,
}: {
  action: Action;
  group: { id: number; min_age: number | null; max_age: number | null; gender: "male" | "female" | "any"; criteria_note: string | null };
}) {
  const prefix = `criteria-${group.id}`;
  return (
    <ActionForm action={action} submitLabel="Save guidance" submitVariant="secondary">
      {(state) => (
        <div className="grid gap-3 sm:grid-cols-3">
          <FormInput id={`${prefix}-min`} name="minAge" type="number" min={2} max={25} label="Youngest age" optional defaultValue={group.min_age ?? ""} error={state?.fieldErrors?.minAge} />
          <FormInput id={`${prefix}-max`} name="maxAge" type="number" min={2} max={25} label="Oldest age" optional defaultValue={group.max_age ?? ""} error={state?.fieldErrors?.maxAge} />
          <FormSelect
            id={`${prefix}-gender`}
            name="gender"
            label="Boys or girls"
            defaultValue={group.gender}
            options={[
              { value: "any", label: "Boys and girls" },
              { value: "male", label: "Boys" },
              { value: "female", label: "Girls" },
            ]}
          />
          <FormTextarea
            id={`${prefix}-note`}
            name="criteriaNote"
            label="Notes for administrators"
            optional
            rows={2}
            maxLength={500}
            defaultValue={group.criteria_note ?? ""}
            className="sm:col-span-3"
            error={state?.fieldErrors?.criteriaNote}
          />
        </div>
      )}
    </ActionForm>
  );
}
