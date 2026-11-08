"use client";

import { ActionForm } from "@/components/admin/action-form";
import { FormCheckbox, FormInput, FormTextarea } from "@/components/admin/form-controls";
import type { ActionResult } from "@/lib/admin/actions";
import { formatQuranLevel } from "@/lib/registration/options";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

/** Add or edit a Quran teacher and the levels they teach. */
export function TeacherForm({
  action,
  levels,
  teacher,
}: {
  action: Action;
  levels: { id: number; name: string }[];
  teacher?: { id: number; name: string; email: string | null; notes: string | null; isActive: boolean; levelIds: number[] };
}) {
  const prefix = teacher ? `teacher-${teacher.id}` : "new-teacher";
  return (
    <ActionForm action={action} submitLabel={teacher ? "Save teacher" : "Add teacher"} resetOnSuccess={!teacher}>
      {(state) => (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput id={`${prefix}-name`} name="fullName" label="Name" defaultValue={teacher?.name} maxLength={120} error={state?.fieldErrors?.fullName} />
            <FormInput id={`${prefix}-email`} name="email" type="email" label="Email" optional defaultValue={teacher?.email ?? ""} maxLength={254} error={state?.fieldErrors?.email} />
          </div>
          <fieldset>
            <legend className="text-sm font-bold text-ink-900">Quran levels taught</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {levels.map((level) => (
                <FormCheckbox
                  key={level.id}
                  id={`${prefix}-level-${level.id}`}
                  name="levelId"
                  value={level.id}
                  defaultChecked={teacher?.levelIds.includes(level.id)}
                  label={formatQuranLevel(level.id, level.name)}
                  className="rounded-lg border border-line px-3 py-2.5"
                />
              ))}
            </div>
          </fieldset>
          <FormTextarea id={`${prefix}-notes`} name="notes" label="Notes" optional rows={2} maxLength={1000} defaultValue={teacher?.notes ?? ""} error={state?.fieldErrors?.notes} />
          {teacher && (
            <FormCheckbox
              id={`${prefix}-active`}
              name="isActive"
              defaultChecked={teacher.isActive}
              label="Active. Uncheck to stop new assignments; current history is kept."
            />
          )}
          {!teacher && <input type="hidden" name="isActive" value="true" />}
        </div>
      )}
    </ActionForm>
  );
}
