"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckboxField,
  ChoiceGroup,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/fields";
import { acknowledgments, type AcknowledgmentId } from "@/lib/config/school";
import type {
  GuardianFormState,
  RegistrationFormState,
  StudentFormState,
} from "@/lib/registration/form-state";
import {
  ARABIC_LEVEL_DESCRIPTIONS,
  ARABIC_LEVEL_LABELS,
  ARABIC_LEVELS,
  GRADE_LABELS,
  GRADES,
  MAX_STUDENTS_PER_REGISTRATION,
  RELATIONSHIP_LABELS,
  RELATIONSHIPS,
  SPECIAL_CONSIDERATIONS_MAX_LENGTH,
} from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";

/** Everything a step needs to read and update the form. */
export type FormApi = {
  state: RegistrationFormState;
  errors: Record<string, string>;
  setPrimary: (field: keyof GuardianFormState, value: string) => void;
  setSecondary: (field: keyof GuardianFormState, value: string) => void;
  setHasSecondary: (value: boolean) => void;
  setEmergency: (field: keyof RegistrationFormState["emergencyContact"], value: string) => void;
  setStudent: (index: number, field: Exclude<keyof StudentFormState, "key">, value: string) => void;
  addStudent: () => void;
  removeStudent: (index: number) => void;
  setAcknowledgment: (id: AcknowledgmentId, value: boolean) => void;
};

/** DOM id for a field path such as "students.0.firstName". */
export const fieldId = (path: string) => path.replaceAll(".", "-");

export function studentLabel(student: StudentFormState, index: number): string {
  const name = [student.firstName.trim(), student.lastName.trim()].filter(Boolean).join(" ");
  return name || `Student ${index + 1}`;
}

const relationshipOptions = RELATIONSHIPS.map((value) => ({ value, label: RELATIONSHIP_LABELS[value] }));
const gradeOptions = GRADES.map((value) => ({ value, label: GRADE_LABELS[value] }));
const yesNoOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function Panel({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl font-semibold text-pine-900">{title}</h3>
          {description && <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function GuardianFields({
  prefix,
  guardian,
  errors,
  onChange,
  contactOptional,
}: {
  prefix: "primaryGuardian" | "secondaryGuardian";
  guardian: GuardianFormState;
  errors: Record<string, string>;
  onChange: (field: keyof GuardianFormState, value: string) => void;
  contactOptional?: boolean;
}) {
  const path = (field: string) => `${prefix}.${field}`;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        id={fieldId(path("firstName"))}
        label="First name"
        autoComplete={prefix === "primaryGuardian" ? "given-name" : "off"}
        value={guardian.firstName}
        onValueChange={(value) => onChange("firstName", value)}
        error={errors[path("firstName")]}
        maxLength={80}
      />
      <TextField
        id={fieldId(path("lastName"))}
        label="Last name"
        autoComplete={prefix === "primaryGuardian" ? "family-name" : "off"}
        value={guardian.lastName}
        onValueChange={(value) => onChange("lastName", value)}
        error={errors[path("lastName")]}
        maxLength={80}
      />
      <SelectField
        id={fieldId(path("relationship"))}
        label="Relationship to the student(s)"
        value={guardian.relationship}
        onValueChange={(value) => onChange("relationship", value)}
        options={relationshipOptions}
        error={errors[path("relationship")]}
        fieldClassName="sm:col-span-2"
      />
      <TextField
        id={fieldId(path("email"))}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete={prefix === "primaryGuardian" ? "email" : "off"}
        optional={contactOptional}
        hint={prefix === "primaryGuardian" ? "We'll use this to contact you about your registration." : undefined}
        value={guardian.email}
        onValueChange={(value) => onChange("email", value)}
        error={errors[path("email")]}
        maxLength={254}
      />
      <TextField
        id={fieldId(path("phone"))}
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete={prefix === "primaryGuardian" ? "tel" : "off"}
        optional={contactOptional}
        hint={prefix === "primaryGuardian" ? "Include the area code." : undefined}
        value={guardian.phone}
        onValueChange={(value) => onChange("phone", value)}
        error={errors[path("phone")]}
        maxLength={25}
      />
    </div>
  );
}

export function FamilyStep({ form }: { form: FormApi }) {
  const { state, errors } = form;
  return (
    <div className="space-y-6">
      <Panel
        title="Primary parent or guardian"
        description="The main contact for the school. If you have registered before, please use the same email address."
      >
        <GuardianFields prefix="primaryGuardian" guardian={state.primaryGuardian} errors={errors} onChange={form.setPrimary} />
      </Panel>

      {state.hasSecondaryGuardian ? (
        <Panel
          title="Second parent or guardian"
          description="Optional. Email and phone can be left blank if you share contact details."
          action={
            <Button variant="ghost" size="sm" onClick={() => form.setHasSecondary(false)}>
              Remove
            </Button>
          }
        >
          <GuardianFields
            prefix="secondaryGuardian"
            guardian={state.secondaryGuardian}
            errors={errors}
            onChange={form.setSecondary}
            contactOptional
          />
        </Panel>
      ) : (
        <button
          type="button"
          onClick={() => form.setHasSecondary(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-white/60 px-4 py-5 font-semibold text-pine-800 transition-colors hover:border-pine-600 hover:bg-pine-50"
        >
          <PlusIcon />
          Add a second parent or guardian (optional)
        </button>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function StudentsStep({ form }: { form: FormApi }) {
  const { state, errors } = form;
  const canAdd = state.students.length < MAX_STUDENTS_PER_REGISTRATION;
  return (
    <div className="space-y-6">
      {state.students.map((student, index) => {
        const path = (field: string) => `students.${index}.${field}`;
        return (
          <Panel
            key={student.key}
            title={`Student ${index + 1}`}
            action={
              state.students.length > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => form.removeStudent(index)}
                  aria-label={`Remove ${studentLabel(student, index)}`}
                >
                  Remove
                </Button>
              ) : undefined
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id={fieldId(path("firstName"))}
                label="First name"
                autoComplete="off"
                value={student.firstName}
                onValueChange={(value) => form.setStudent(index, "firstName", value)}
                error={errors[path("firstName")]}
                maxLength={80}
              />
              <TextField
                id={fieldId(path("lastName"))}
                label="Last name"
                autoComplete="off"
                value={student.lastName}
                onValueChange={(value) => form.setStudent(index, "lastName", value)}
                error={errors[path("lastName")]}
                maxLength={80}
              />
              <TextField
                id={fieldId(path("dateOfBirth"))}
                label="Date of birth"
                type="date"
                max={todayIso()}
                value={student.dateOfBirth}
                onValueChange={(value) => form.setStudent(index, "dateOfBirth", value)}
                error={errors[path("dateOfBirth")]}
                fieldClassName="sm:col-span-1"
              />
            </div>
          </Panel>
        );
      })}

      {errors["students"] && <p className="text-sm font-medium text-danger-700">{errors["students"]}</p>}

      {canAdd ? (
        <button
          type="button"
          onClick={form.addStudent}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-white/60 px-4 py-5 font-semibold text-pine-800 transition-colors hover:border-pine-600 hover:bg-pine-50"
        >
          <PlusIcon />
          Add another child
        </button>
      ) : (
        <p className="text-sm text-ink-500">
          You can register up to {MAX_STUDENTS_PER_REGISTRATION} children in one form. Please submit a second form for
          additional children.
        </p>
      )}
    </div>
  );
}

export function ArabicStep({ form }: { form: FormApi }) {
  const { state, errors } = form;
  return (
    <div className="space-y-6">
      {state.students.map((student, index) => {
        const path = (field: string) => `students.${index}.${field}`;
        return (
          <Panel key={student.key} title={studentLabel(student, index)}>
            <div className="space-y-6">
              <ChoiceGroup
                id={fieldId(path("studiedArabicBefore"))}
                name={`studied-${student.key}`}
                legend="Has this student studied Arabic before?"
                hint="At home, in another school, or in a program."
                options={yesNoOptions}
                value={student.studiedArabicBefore}
                onValueChange={(value) => form.setStudent(index, "studiedArabicBefore", value)}
                error={errors[path("studiedArabicBefore")]}
              />
              <ChoiceGroup
                id={fieldId(path("arabicLevel"))}
                name={`level-${student.key}`}
                legend="Current Arabic level"
                hint="Choose the closest match. Teachers will confirm placement."
                columns={3}
                options={ARABIC_LEVELS.map((value) => ({
                  value,
                  label: ARABIC_LEVEL_LABELS[value],
                  description: ARABIC_LEVEL_DESCRIPTIONS[value],
                }))}
                value={student.arabicLevel}
                onValueChange={(value) => form.setStudent(index, "arabicLevel", value)}
                error={errors[path("arabicLevel")]}
              />
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export function CareStep({ form }: { form: FormApi }) {
  const { state, errors } = form;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-pine-50 p-5 text-sm leading-relaxed text-pine-900 ring-1 ring-pine-100">
        <p className="font-semibold">What to share here</p>
        <p className="mt-1">
          Tell us only what teachers need to know to keep your child safe and supported, such as allergies, medical
          needs during class, or learning and accessibility support. You don&apos;t need to include diagnoses or medical
          records. This information is visible only to authorized school administrators.
        </p>
      </div>

      {state.students.map((student, index) => {
        const path = `students.${index}.specialConsiderations`;
        return (
          <Panel key={student.key} title={studentLabel(student, index)}>
            <TextAreaField
              id={fieldId(path)}
              label="Allergies, care needs or special considerations"
              optional
              hint='Leave blank if there is nothing to share, or write "None".'
              value={student.specialConsiderations}
              onValueChange={(value) => form.setStudent(index, "specialConsiderations", value)}
              error={errors[path]}
              maxLength={SPECIAL_CONSIDERATIONS_MAX_LENGTH}
              showCount
              rows={4}
            />
          </Panel>
        );
      })}

      <Panel title="Emergency contact" description="Who should we call if we can't reach a parent or guardian?">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id={fieldId("emergencyContact.name")}
            label="Full name"
            autoComplete="off"
            value={state.emergencyContact.name}
            onValueChange={(value) => form.setEmergency("name", value)}
            error={errors["emergencyContact.name"]}
            maxLength={120}
          />
          <TextField
            id={fieldId("emergencyContact.phone")}
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={state.emergencyContact.phone}
            onValueChange={(value) => form.setEmergency("phone", value)}
            error={errors["emergencyContact.phone"]}
            maxLength={25}
          />
          <TextField
            id={fieldId("emergencyContact.relationship")}
            label="Relationship to the student(s)"
            optional
            hint="For example: aunt, neighbor, family friend."
            value={state.emergencyContact.relationship}
            onValueChange={(value) => form.setEmergency("relationship", value)}
            error={errors["emergencyContact.relationship"]}
            maxLength={60}
            fieldClassName="sm:col-span-2"
          />
        </div>
      </Panel>
    </div>
  );
}

export function EnrollmentStep({ form, schoolYear }: { form: FormApi; schoolYear: string }) {
  const { state, errors } = form;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4">
        <span className="grid size-10 place-items-center rounded-xl bg-gold-200 font-serif font-semibold text-pine-900" aria-hidden="true">
          {schoolYear.slice(2, 4)}
        </span>
        <div>
          <p className="text-sm text-ink-500">Registering for</p>
          <p className="font-serif text-lg font-semibold text-pine-900">{formatSchoolYear(schoolYear)} school year</p>
        </div>
      </div>

      {state.students.map((student, index) => {
        const path = (field: string) => `students.${index}.${field}`;
        return (
          <Panel key={student.key} title={studentLabel(student, index)}>
            <div className="space-y-6">
              <SelectField
                id={fieldId(path("grade"))}
                label={`Grade in regular school during ${formatSchoolYear(schoolYear)}`}
                value={student.grade}
                onValueChange={(value) => form.setStudent(index, "grade", value)}
                options={gradeOptions}
                placeholder="Select a grade"
                error={errors[path("grade")]}
              />
              <ChoiceGroup
                id={fieldId(path("isReturning"))}
                name={`returning-${student.key}`}
                legend="Is this student new or returning?"
                options={[
                  { value: "no", label: "New student", description: "First year with our school" },
                  { value: "yes", label: "Returning student", description: "Attended in a previous year" },
                ]}
                value={student.isReturning}
                onValueChange={(value) => form.setStudent(index, "isReturning", value)}
                error={errors[path("isReturning")]}
              />
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export function ConsentStep({ form }: { form: FormApi }) {
  const { state, errors } = form;
  return (
    <Panel title="Please confirm" description="All items are required to submit your registration.">
      <div className="space-y-3">
        {acknowledgments.map((item) => (
          <CheckboxField
            key={item.id}
            id={fieldId(`acknowledgments.${item.id}`)}
            checked={state.acknowledgments[item.id]}
            onCheckedChange={(value) => form.setAcknowledgment(item.id, value)}
            label={item.label}
            error={errors[`acknowledgments.${item.id}`]}
          />
        ))}
      </div>
    </Panel>
  );
}
