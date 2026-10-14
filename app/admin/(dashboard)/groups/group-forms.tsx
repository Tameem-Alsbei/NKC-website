"use client";

import { ActionForm } from "@/components/admin/action-form";
import { FormInput, FormSelect, FormTextarea } from "@/components/admin/form-controls";
import type { ActionResult } from "@/lib/admin/actions";
import { ARABIC_LEVEL_LABELS, ARABIC_LEVELS, GRADE_LABELS, GRADES } from "@/lib/registration/options";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

export type GroupValues = {
  school_year_id: number;
  name: string;
  minimum_grade: string | null;
  maximum_grade: string | null;
  arabic_level: string | null;
  teacher_name: string | null;
  capacity: number;
  notes: string | null;
};

const gradeOptions = GRADES.map((g) => ({ value: g, label: GRADE_LABELS[g] }));

export function GroupForm({
  action,
  years,
  group,
  submitLabel,
}: {
  action: Action;
  years: { id: number; label: string }[];
  group?: GroupValues;
  submitLabel: string;
}) {
  const prefix = group ? "edit-group" : "new-group";
  return (
    <ActionForm action={action} submitLabel={submitLabel} resetOnSuccess={!group}>
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput id={`${prefix}-name`} name="name" label="Group name" defaultValue={group?.name} maxLength={80} error={state?.fieldErrors?.name} />
          <FormSelect
            id={`${prefix}-year`}
            name="schoolYearId"
            label="School year"
            defaultValue={group?.school_year_id ?? years[0]?.id}
            options={years.map((y) => ({ value: y.id, label: y.label }))}
            error={state?.fieldErrors?.schoolYearId}
          />
          <FormSelect id={`${prefix}-min`} name="minimumGrade" label="Lowest grade" optional defaultValue={group?.minimum_grade ?? ""} placeholder="Any" options={gradeOptions} error={state?.fieldErrors?.minimumGrade} />
          <FormSelect id={`${prefix}-max`} name="maximumGrade" label="Highest grade" optional defaultValue={group?.maximum_grade ?? ""} placeholder="Any" options={gradeOptions} error={state?.fieldErrors?.maximumGrade} />
          <FormSelect
            id={`${prefix}-level`}
            name="arabicLevel"
            label="Arabic level"
            optional
            defaultValue={group?.arabic_level ?? ""}
            placeholder="Mixed levels"
            options={ARABIC_LEVELS.map((l) => ({ value: l, label: ARABIC_LEVEL_LABELS[l] }))}
          />
          <FormInput id={`${prefix}-capacity`} name="capacity" type="number" min={1} max={500} label="Capacity" defaultValue={group?.capacity ?? 15} error={state?.fieldErrors?.capacity} />
          <FormInput id={`${prefix}-teacher`} name="teacherName" label="Teacher" optional defaultValue={group?.teacher_name ?? ""} maxLength={120} className="sm:col-span-2" error={state?.fieldErrors?.teacherName} />
          <FormTextarea id={`${prefix}-notes`} name="notes" label="Notes" optional rows={2} defaultValue={group?.notes ?? ""} maxLength={2000} className="sm:col-span-2" error={state?.fieldErrors?.notes} />
        </div>
      )}
    </ActionForm>
  );
}

export function AddStudentsForm({
  action,
  candidates,
  spotsLeft,
}: {
  action: Action;
  candidates: { registrationId: number; name: string; detail: string; matches: boolean }[];
  spotsLeft: number;
}) {
  return (
    <ActionForm action={action} submitLabel="Add selected students">
      <fieldset>
        <legend className="text-sm text-ink-600">
          Unassigned students in this school year. Students matching the group&apos;s grade range and level are listed
          first. {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left.
        </legend>
        <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {candidates.map((candidate) => (
            <li key={candidate.registrationId}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-cream-50">
                <input type="checkbox" name="registrationId" value={candidate.registrationId} className="mt-1 size-4 accent-pine-700" />
                <span>
                  <span className="block font-semibold text-ink-900">{candidate.name}</span>
                  <span className="block text-xs text-ink-500">
                    {candidate.detail}
                    {candidate.matches ? " · good match" : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </ActionForm>
  );
}
