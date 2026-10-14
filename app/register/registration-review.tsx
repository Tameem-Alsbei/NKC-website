"use client";

import type { ReactNode } from "react";
import { acknowledgments } from "@/lib/config/school";
import { REGISTRATION_STEPS, type RegistrationFormState, type RegistrationStepId } from "@/lib/registration/form-state";
import {
  ARABIC_LEVEL_LABELS,
  GRADE_LABELS,
  RELATIONSHIP_LABELS,
  type ArabicLevel,
  type Grade,
  type Relationship,
} from "@/lib/registration/options";
import { formatSchoolYear } from "@/lib/school-year-format";
import { studentLabel } from "./registration-steps";

function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "Not provided";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const yesNo = (value: string) => (value === "yes" ? "Yes" : value === "no" ? "No" : "Not answered");
const orDash = (value: string) => value.trim() || "Not provided";

function ReviewSection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: RegistrationStepId;
  onEdit: (step: RegistrationStepId) => void;
  children: ReactNode;
}) {
  const stepTitle = REGISTRATION_STEPS.find((s) => s.id === step)?.title ?? title;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg font-semibold text-pine-900">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="rounded-md px-2 py-1 text-sm font-semibold text-pine-700 underline-offset-4 hover:underline"
        >
          Edit<span className="sr-only"> {stepTitle}</span>
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="break-words text-ink-900">{value}</dd>
    </div>
  );
}

export function ReviewStep({
  state,
  schoolYear,
  onEdit,
}: {
  state: RegistrationFormState;
  schoolYear: string;
  onEdit: (step: RegistrationStepId) => void;
}) {
  const { primaryGuardian: primary, secondaryGuardian: secondary, emergencyContact: emergency } = state;
  const relationship = (value: string) => (value ? RELATIONSHIP_LABELS[value as Relationship] : "Not provided");

  return (
    <div className="space-y-5">
      <ReviewSection title="Parents and guardians" step="family" onEdit={onEdit}>
        <dl className="divide-y divide-line">
          <Row
            label="Primary contact"
            value={`${orDash(`${primary.firstName} ${primary.lastName}`)} (${relationship(primary.relationship)})`}
          />
          <Row label="Email" value={orDash(primary.email)} />
          <Row label="Phone" value={orDash(primary.phone)} />
          {state.hasSecondaryGuardian && (
            <>
              <Row
                label="Second guardian"
                value={`${orDash(`${secondary.firstName} ${secondary.lastName}`)} (${relationship(secondary.relationship)})`}
              />
              <Row label="Their email" value={orDash(secondary.email)} />
              <Row label="Their phone" value={orDash(secondary.phone)} />
            </>
          )}
        </dl>
      </ReviewSection>

      {state.students.map((student, index) => (
        <ReviewSection key={student.key} title={studentLabel(student, index)} step="students" onEdit={onEdit}>
          <dl className="divide-y divide-line">
            <Row label="Date of birth" value={formatDate(student.dateOfBirth)} />
            <Row
              label={`Grade (${formatSchoolYear(schoolYear)})`}
              value={student.grade ? GRADE_LABELS[student.grade as Grade] : "Not provided"}
            />
            <Row
              label="Student type"
              value={student.isReturning === "yes" ? "Returning" : student.isReturning === "no" ? "New" : "Not answered"}
            />
            <Row label="Studied Arabic before" value={yesNo(student.studiedArabicBefore)} />
            <Row
              label="Arabic level"
              value={student.arabicLevel ? ARABIC_LEVEL_LABELS[student.arabicLevel as ArabicLevel] : "Not provided"}
            />
            <Row
              label="Special considerations"
              value={
                student.specialConsiderations.trim() ? (
                  <span className="whitespace-pre-line">{student.specialConsiderations.trim()}</span>
                ) : (
                  "None provided"
                )
              }
            />
          </dl>
        </ReviewSection>
      ))}

      <ReviewSection title="Emergency contact" step="care" onEdit={onEdit}>
        <dl className="divide-y divide-line">
          <Row label="Name" value={orDash(emergency.name)} />
          <Row label="Phone" value={orDash(emergency.phone)} />
          <Row label="Relationship" value={orDash(emergency.relationship)} />
        </dl>
      </ReviewSection>

      <ReviewSection title="Acknowledgments" step="consent" onEdit={onEdit}>
        <ul className="space-y-2">
          {acknowledgments.map((item) => (
            <li key={item.id} className="flex gap-2 text-sm text-ink-700">
              <span aria-hidden="true" className={state.acknowledgments[item.id] ? "text-pine-700" : "text-danger-700"}>
                {state.acknowledgments[item.id] ? "✓" : "✕"}
              </span>
              <span>
                <span className="sr-only">{state.acknowledgments[item.id] ? "Confirmed: " : "Not confirmed: "}</span>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </ReviewSection>
    </div>
  );
}
