"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { FormSelect, FormTextarea } from "@/components/admin/form-controls";
import { Button, Spinner } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FieldError, inputClasses } from "@/components/ui/fields";
import type { ActionResult } from "@/lib/admin/actions";
import { formatQuranLevel } from "@/lib/registration/options";

type Action = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

export type LevelOption = { id: number; name: string };
export type TeacherOption = { id: number; name: string; levelIds: number[]; isActive: boolean };
export type ColorGroupOption = { id: number; name: string };

function Feedback({ state }: { state: ActionResult }) {
  return (
    <p role={state && !state.ok ? "alert" : "status"} className={cn("text-sm font-semibold", state?.ok ? "text-leaf-700" : "text-danger-700", !state && "sr-only")}>
      {state?.message ?? ""}
    </p>
  );
}

/** Teachers who can take students at the given level right now. */
export function teachersForLevel(teachers: TeacherOption[], levelId: number | null): TeacherOption[] {
  if (!levelId) return [];
  return teachers.filter((teacher) => teacher.isActive && teacher.levelIds.includes(levelId));
}

/**
 * Chooses a student's Quran level and teacher. Only teachers who teach the
 * selected level are offered, and changing the level clears an incompatible
 * teacher. Changing an existing assignment asks for confirmation because it
 * closes the current assignment and starts a new one (history is kept).
 */
export function QuranAssignmentForm({
  action,
  levels,
  teachers,
  current,
  idPrefix,
  compact = false,
}: {
  action: Action;
  levels: LevelOption[];
  teachers: TeacherOption[];
  current: { levelId: number; teacherId: number | null; teacherName?: string | null } | null;
  idPrefix: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [levelId, setLevelId] = useState<number | null>(current?.levelId ?? null);
  const [teacherId, setTeacherId] = useState<number | null>(current?.teacherId ?? null);
  const available = useMemo(() => teachersForLevel(teachers, levelId), [teachers, levelId]);
  const levelName = (idValue: number) => levels.find((level) => level.id === idValue)?.name ?? "";
  const changed = levelId !== (current?.levelId ?? null) || teacherId !== (current?.teacherId ?? null);

  // A teacher who taught the previous level may not teach the new one.
  const teacherStillValid = teacherId === null || available.some((teacher) => teacher.id === teacherId) || (teacherId === current?.teacherId && levelId === current?.levelId);

  return (
    <form
      noValidate
      className={cn("space-y-3", compact && "space-y-2")}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !changed) return;
        if (current) {
          const from = `${formatQuranLevel(current.levelId, levelName(current.levelId))}${current.teacherName ? ` with ${current.teacherName}` : ""}`;
          const to = levelId
            ? `${formatQuranLevel(levelId, levelName(levelId))}${teacherId ? ` with ${teachers.find((t) => t.id === teacherId)?.name ?? "the selected teacher"}` : " (no teacher yet)"}`
            : "no Quran level";
          if (!window.confirm(`Move this student from ${from} to ${to}?\n\nThe current assignment will be closed and kept in the student's history.`)) return;
        }
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <div className={cn("grid gap-3", compact ? "sm:grid-cols-[1fr_1fr_auto] sm:items-end" : "sm:grid-cols-2")}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-level`} className="text-sm font-bold text-ink-900">
            Quran level
          </label>
          <select
            id={`${idPrefix}-level`}
            name="quranLevelId"
            value={levelId ?? ""}
            onChange={(event) => {
              const next = event.target.value ? Number(event.target.value) : null;
              setLevelId(next);
              if (!teachersForLevel(teachers, next).some((teacher) => teacher.id === teacherId)) setTeacherId(null);
            }}
            className={inputClasses(Boolean(state?.fieldErrors?.quranLevelId))}
          >
            <option value="">Not assigned</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {formatQuranLevel(level.id, level.name)}
              </option>
            ))}
          </select>
          {state?.fieldErrors?.quranLevelId && <FieldError>{state.fieldErrors.quranLevelId}</FieldError>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-teacher`} className="text-sm font-bold text-ink-900">
            Quran teacher
          </label>
          <select
            id={`${idPrefix}-teacher`}
            name="teacherId"
            value={teacherStillValid ? (teacherId ?? "") : ""}
            disabled={!levelId}
            onChange={(event) => setTeacherId(event.target.value ? Number(event.target.value) : null)}
            aria-describedby={`${idPrefix}-teacher-hint`}
            className={inputClasses(false)}
          >
            <option value="">{levelId ? "No teacher yet" : "Choose a level first"}</option>
            {/* Keep showing the current teacher even if they were later deactivated. */}
            {current?.teacherId && levelId === current.levelId && !available.some((t) => t.id === current.teacherId) && (
              <option value={current.teacherId}>{current.teacherName ?? "Current teacher"} (inactive)</option>
            )}
            {available.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
          <p id={`${idPrefix}-teacher-hint`} className={cn("text-xs text-ink-500", compact && "sr-only")}>
            {levelId && available.length === 0
              ? "No active teachers teach this level yet. Add one on the Quran page."
              : "Only teachers who teach the selected level are listed."}
          </p>
        </div>
        {compact && (
          <Button type="submit" variant="secondary" disabled={pending || !changed} className="sm:mb-[1.15rem]">
            {pending ? <Spinner /> : null}
            Save
          </Button>
        )}
      </div>
      {!compact && (
        <FormTextarea id={`${idPrefix}-note`} name="note" label="Note about this change" optional rows={2} maxLength={1000} />
      )}
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending || !changed}>
            {pending ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              "Save Quran assignment"
            )}
          </Button>
          <Feedback state={state} />
        </div>
      )}
      {compact && <Feedback state={state} />}
    </form>
  );
}

/** Choose (or clear) one registration's color group. */
export function ColorGroupForm({
  action,
  groups,
  currentId,
  idPrefix,
  compact = false,
}: {
  action: Action;
  groups: ColorGroupOption[];
  currentId: number | null;
  idPrefix: string;
  compact?: boolean;
}) {
  return (
    <ActionForm action={action} submitLabel={compact ? "Save" : "Save color group"} submitVariant={compact ? "secondary" : "primary"} footerClassName={compact ? "mt-2" : undefined}>
      <FormSelect
        id={`${idPrefix}-color`}
        name="colorGroupId"
        label="Color group"
        defaultValue={currentId ?? ""}
        placeholder="Not assigned"
        options={groups.map((group) => ({ value: group.id, label: group.name }))}
      />
    </ActionForm>
  );
}

export type SelectableStudent = {
  /** Value submitted for this student (registration id or student id). */
  value: number;
  name: string;
  detail: string;
};

/**
 * A checklist of students plus a target (color group or Quran level/teacher),
 * submitted together so the whole batch is saved in one transaction.
 */
function BulkAssignShell({
  action,
  students,
  fieldName,
  legend,
  submitLabel,
  confirmMessage,
  children,
}: {
  action: Action;
  students: SelectableStudent[];
  fieldName: "registrationId" | "studentId";
  legend: string;
  submitLabel: string;
  /** Asked before submitting, e.g. when the change closes existing assignments. */
  confirmMessage?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the selection once per successful save (state adjusted during render,
  // as React recommends, rather than in an effect).
  const [handledState, setHandledState] = useState<ActionResult>(null);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setSelected(new Set());
  }

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const allSelected = students.length > 0 && selected.size === students.length;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-4"
    >
      <fieldset>
        <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm text-ink-600">
          <span>{legend}</span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-bold text-brand-700 hover:bg-brand-50"
            onClick={() => setSelected(allSelected ? new Set() : new Set(students.map((s) => s.value)))}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </button>
        </legend>
        <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {students.map((student) => (
            <li key={student.value}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-mist-50">
                <input
                  type="checkbox"
                  name={fieldName}
                  value={student.value}
                  checked={selected.has(student.value)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(student.value);
                      else next.delete(student.value);
                      return next;
                    })
                  }
                  className="mt-1 size-4 accent-brand-700"
                />
                <span>
                  <span className="block font-bold text-ink-900">{student.name}</span>
                  <span className="block text-xs text-ink-500">{student.detail}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || selected.size === 0}>
          {pending ? <Spinner /> : null}
          {submitLabel}
          {selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function BulkColorGroupForm({ action, students, groups, defaultGroupId }: { action: Action; students: SelectableStudent[]; groups: ColorGroupOption[]; defaultGroupId?: number }) {
  return (
    <BulkAssignShell action={action} students={students} fieldName="registrationId" legend="Select students to place." submitLabel="Place in group">
      <FormSelect
        id="bulk-color-group"
        name="colorGroupId"
        label="Color group"
        defaultValue={defaultGroupId ?? ""}
        placeholder="Choose a group"
        options={groups.map((group) => ({ value: group.id, label: group.name }))}
      />
    </BulkAssignShell>
  );
}

export function BulkQuranForm({
  action,
  students,
  levels,
  teachers,
  defaultLevelId,
  closesExisting = false,
}: {
  action: Action;
  students: SelectableStudent[];
  levels: LevelOption[];
  teachers: TeacherOption[];
  defaultLevelId?: number;
  /** True when the listed students already have Quran assignments that will be closed. */
  closesExisting?: boolean;
}) {
  const [levelId, setLevelId] = useState<number | null>(defaultLevelId ?? null);
  const available = teachersForLevel(teachers, levelId);
  return (
    <BulkAssignShell
      action={action}
      students={students}
      fieldName="studentId"
      legend="Select students to assign."
      submitLabel="Assign"
      confirmMessage={closesExisting ? "Each selected student’s current Quran assignment will be closed and kept in their history, and a new assignment will start. Continue?" : undefined}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bulk-quran-level" className="text-sm font-bold text-ink-900">
            Quran level
          </label>
          <select
            id="bulk-quran-level"
            name="quranLevelId"
            value={levelId ?? ""}
            onChange={(event) => setLevelId(event.target.value ? Number(event.target.value) : null)}
            className={inputClasses(false)}
          >
            <option value="">Choose a level</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {formatQuranLevel(level.id, level.name)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bulk-quran-teacher" className="text-sm font-bold text-ink-900">
            Quran teacher
          </label>
          {/* Keyed by level so an incompatible teacher can never stay selected. */}
          <select key={levelId ?? "none"} id="bulk-quran-teacher" name="teacherId" disabled={!levelId} defaultValue="" className={inputClasses(false)}>
            <option value="">{levelId ? "No teacher yet" : "Choose a level first"}</option>
            {available.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </BulkAssignShell>
  );
}
