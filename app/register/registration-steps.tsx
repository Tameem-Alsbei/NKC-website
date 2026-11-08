"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField, ChoiceGroup, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { acknowledgments, type AcknowledgmentId } from "@/lib/config/program";
import type { GuardianFormState, RegistrationFormState, StudentFormState } from "@/lib/registration/form-state";
import {
  GENDER_LABELS,
  GENDERS,
  GRADE_LABELS,
  GRADES,
  MAX_STUDENTS_PER_REGISTRATION,
  QURAN_ABILITIES,
  QURAN_ABILITY_LABELS,
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
  return name || `Child ${index + 1}`;
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

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-brand-800">{title}</h3>
          {description && <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-5 font-bold text-brand-700 transition-colors hover:border-brand-500 hover:bg-brand-50"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M10 4v12M4 10h12" />
      </svg>
      {children}
    </button>
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
  const primary = prefix === "primaryGuardian";
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        id={fieldId(path("firstName"))}
        label="First name"
        autoComplete={primary ? "given-name" : "off"}
        value={guardian.firstName}
        onValueChange={(value) => onChange("firstName", value)}
        error={errors[path("firstName")]}
        maxLength={80}
      />
      <TextField
        id={fieldId(path("lastName"))}
        label="Last name"
        autoComplete={primary ? "family-name" : "off"}
        value={guardian.lastName}
        onValueChange={(value) => onChange("lastName", value)}
        error={errors[path("lastName")]}
        maxLength={80}
      />
      <SelectField
        id={fieldId(path("relationship"))}
        label="Relationship to the child(ren)"
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
        autoComplete={primary ? "email" : "off"}
        optional={contactOptional}
        hint={primary ? "We'll use this to contact you about your registration." : undefined}
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
        autoComplete={primary ? "tel" : "off"}
        optional={contactOptional}
        hint={primary ? "Include the area code." : undefined}
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
        title="Parent or guardian"
        description="The main contact for Noor Kids Club. If you've registered before, please use the same email address."
      >
        <GuardianFields prefix="primaryGuardian" guardian={state.primaryGuardian} errors={errors} onChange={form.setPrimary} />
      </Panel>

      {state.hasSecondaryGuardian ? (
        <Panel
          title="Second parent or guardian"
          description="Email and phone can be left blank if you share contact details."
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
        <AddButton onClick={() => form.setHasSecondary(true)}>Add a second parent or guardian (optional)</AddButton>
      )}
    </div>
  );
}

export function ChildrenStep({ form, schoolYear }: { form: FormApi; schoolYear: string }) {
  const { state, errors } = form;
  const canAdd = state.students.length < MAX_STUDENTS_PER_REGISTRATION;
  return (
    <div className="space-y-6">
      {state.students.map((student, index) => {
        const path = (field: string) => `students.${index}.${field}`;
        return (
          <Panel
            key={student.key}
            title={state.students.length > 1 ? studentLabel(student, index) : "Your child"}
            action={
              state.students.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => form.removeStudent(index)} aria-label={`Remove ${studentLabel(student, index)}`}>
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
              />
              <SelectField
                id={fieldId(path("grade"))}
                label={`School grade in ${formatSchoolYear(schoolYear)}`}
                value={student.grade}
                onValueChange={(value) => form.setStudent(index, "grade", value)}
                options={gradeOptions}
                placeholder="Select a grade"
                error={errors[path("grade")]}
              />
              <div className="sm:col-span-2">
                <ChoiceGroup
                  id={fieldId(path("gender"))}
                  name={`gender-${student.key}`}
                  legend="Is your child a boy or a girl?"
                  hint="We use this, along with age, to place children in their activity groups."
                  options={GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }))}
                  value={student.gender}
                  onValueChange={(value) => form.setStudent(index, "gender", value)}
                  error={errors[path("gender")]}
                />
              </div>
              <div className="sm:col-span-2">
                <ChoiceGroup
                  id={fieldId(path("isReturning"))}
                  name={`returning-${student.key}`}
                  legend="Has this child attended Noor Kids Club before?"
                  options={[
                    { value: "no", label: "New to Noor Kids Club" },
                    { value: "yes", label: "Returning student" },
                  ]}
                  value={student.isReturning}
                  onValueChange={(value) => form.setStudent(index, "isReturning", value)}
                  error={errors[path("isReturning")]}
                />
              </div>
            </div>
          </Panel>
        );
      })}

      {errors["students"] && <p className="text-sm font-semibold text-danger-700">{errors["students"]}</p>}

      {canAdd ? (
        <AddButton onClick={form.addStudent}>Add another child</AddButton>
      ) : (
        <p className="text-sm text-ink-500">
          You can register up to {MAX_STUDENTS_PER_REGISTRATION} children in one form. Please submit a second form for
          additional children.
        </p>
      )}
    </div>
  );
}

export function BackgroundStep({ form }: { form: FormApi }) {
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
                legend="Has your child studied Arabic or Quran before?"
                hint="At home, at the masjid, or in another program."
                options={yesNoOptions}
                value={student.studiedArabicBefore}
                onValueChange={(value) => form.setStudent(index, "studiedArabicBefore", value)}
                error={errors[path("studiedArabicBefore")]}
              />
              <ChoiceGroup
                id={fieldId(path("quranAbility"))}
                name={`ability-${student.key}`}
                legend="Which best describes your child's Quran reading today?"
                options={QURAN_ABILITIES.map((value) => ({ value, label: QURAN_ABILITY_LABELS[value] }))}
                value={student.quranAbility}
                onValueChange={(value) => form.setStudent(index, "quranAbility", value)}
                error={errors[path("quranAbility")]}
              />
              <TextAreaField
                id={fieldId(path("quranNotes"))}
                label="Anything else about their Quran learning?"
                optional
                hint="For example, surahs they have memorized or a previous teacher or program."
                value={student.quranNotes}
                onValueChange={(value) => form.setStudent(index, "quranNotes", value)}
                error={errors[path("quranNotes")]}
                maxLength={1000}
                rows={3}
              />
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export function AdditionalStep({ form }: { form: FormApi }) {
  const { state, errors } = form;
  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] bg-brand-50 p-5 text-sm leading-relaxed text-brand-900 ring-1 ring-brand-100">
        <p className="font-bold">Health and care information</p>
        <p className="mt-1">
          Please share only what our staff need to keep your child safe and supported, such as allergies, medical needs
          during the program, or accessibility support. You don&apos;t need to include diagnoses or medical records. Only
          approved program administrators can see this.
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
              rows={3}
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
            label="Relationship to the child(ren)"
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

      <Panel title="Please confirm" description="All of these are required to submit your registration.">
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
    </div>
  );
}
