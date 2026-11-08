"use client";

import { ActionForm } from "@/components/admin/action-form";
import { FormInput, FormTextarea } from "@/components/admin/form-controls";
import type { ActionResult } from "@/lib/admin/actions";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

export function ThemeForm({
  action,
  theme,
  readOnly,
}: {
  action: Action;
  theme: {
    id: number;
    name: string | null;
    main_value: string | null;
    description: string | null;
    color_hex: string | null;
    starts_on: string | null;
    ends_on: string | null;
  };
  readOnly: boolean;
}) {
  const prefix = `theme-${theme.id}`;
  const fields = (errors?: Record<string, string>) => (
    <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
      <FormInput id={`${prefix}-name`} name="name" label="Theme name" optional defaultValue={theme.name ?? ""} maxLength={80} error={errors?.name} />
      <FormInput id={`${prefix}-value`} name="mainValue" label="Main value or lesson" optional defaultValue={theme.main_value ?? ""} maxLength={120} error={errors?.mainValue} />
      <FormTextarea id={`${prefix}-description`} name="description" label="Short description" optional rows={2} maxLength={600} defaultValue={theme.description ?? ""} className="sm:col-span-2" error={errors?.description} />
      <FormInput id={`${prefix}-color`} name="colorHex" label="Accent color" optional placeholder="#1f5aa6" defaultValue={theme.color_hex ?? ""} maxLength={7} hint="A hex color, used as a small accent." error={errors?.colorHex} />
      <div className="grid grid-cols-2 gap-3">
        <FormInput id={`${prefix}-start`} name="startsOn" type="date" label="Starts" optional defaultValue={theme.starts_on ?? ""} error={errors?.startsOn} />
        <FormInput id={`${prefix}-end`} name="endsOn" type="date" label="Ends" optional defaultValue={theme.ends_on ?? ""} error={errors?.endsOn} />
      </div>
    </fieldset>
  );

  if (readOnly) return fields();
  return (
    <ActionForm action={action} submitLabel="Save theme" submitVariant="secondary">
      {(state) => fields(state?.fieldErrors)}
    </ActionForm>
  );
}
