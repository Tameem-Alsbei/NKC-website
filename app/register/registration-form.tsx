"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, Spinner } from "@/components/ui/button";
import {
  emptyGuardian,
  emptyStudent,
  fieldBelongsToStep,
  initialFormState,
  REGISTRATION_STEPS,
  toRegistrationInput,
  validateStep,
  type RegistrationFormState,
  type RegistrationStepId,
} from "@/lib/registration/form-state";
import { MAX_STUDENTS_PER_REGISTRATION } from "@/lib/registration/options";
import {
  issuesToFieldErrors,
  registrationResultSchema,
  registrationSchema,
  type RegistrationResult,
} from "@/lib/registration/schema";
import { RegistrationProgress } from "./progress";
import { RegistrationConfirmation } from "./registration-confirmation";
import { ReviewStep } from "./registration-review";
import {
  ArabicStep,
  CareStep,
  ConsentStep,
  EnrollmentStep,
  FamilyStep,
  fieldId,
  StudentsStep,
  type FormApi,
} from "./registration-steps";

type Errors = Record<string, string>;

const NETWORK_ERROR =
  "We couldn't reach the school's server. Please check your internet connection and try again. Your answers are still here.";

function withoutKeys(errors: Errors, prefix: string): Errors {
  const next: Errors = {};
  for (const [key, value] of Object.entries(errors)) {
    if (key !== prefix && !key.startsWith(`${prefix}.`)) next[key] = value;
  }
  return next;
}

/** Moves keyboard focus to the first invalid field (or radio option). */
function focusField(path: string) {
  requestAnimationFrame(() => {
    const element = document.getElementById(fieldId(path));
    if (!element) return;
    const target =
      element instanceof HTMLFieldSetElement ? (element.querySelector("input") ?? element) : element;
    target.focus();
    target.scrollIntoView({ block: "center" });
  });
}

export function RegistrationForm({ schoolYear }: { schoolYear: string }) {
  const [state, setState] = useState<RegistrationFormState>(() => initialFormState("student-1"));
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [dirty, setDirty] = useState(false);

  // Created once per form session. Reusing the same key on retries lets the
  // server recognise a repeated submission instead of creating duplicates.
  const idempotencyKey = useRef<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const inFlight = useRef(false);
  const studentCounter = useRef(1);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    idempotencyKey.current ??= crypto.randomUUID();
    startedAt.current ??= Date.now();
  }, []);

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    if (!dirty || result) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, result]);

  const step = REGISTRATION_STEPS[stepIndex];

  const update = useCallback((recipe: (current: RegistrationFormState) => RegistrationFormState, clearPath: string) => {
    setState(recipe);
    setErrors((current) => withoutKeys(current, clearPath));
    setSubmitError(null);
    setDirty(true);
  }, []);

  const form: FormApi = useMemo(
    () => ({
      state,
      errors,
      setPrimary: (field, value) =>
        update((s) => ({ ...s, primaryGuardian: { ...s.primaryGuardian, [field]: value } }), `primaryGuardian.${field}`),
      setSecondary: (field, value) =>
        update((s) => ({ ...s, secondaryGuardian: { ...s.secondaryGuardian, [field]: value } }), `secondaryGuardian.${field}`),
      setHasSecondary: (value) => {
        update(
          (s) => ({ ...s, hasSecondaryGuardian: value, secondaryGuardian: value ? s.secondaryGuardian : emptyGuardian() }),
          "secondaryGuardian",
        );
        if (value) focusField("secondaryGuardian.firstName");
      },
      setEmergency: (field, value) =>
        update((s) => ({ ...s, emergencyContact: { ...s.emergencyContact, [field]: value } }), `emergencyContact.${field}`),
      setStudent: (index, field, value) =>
        update(
          (s) => ({
            ...s,
            students: s.students.map((student, i) => (i === index ? { ...student, [field]: value } : student)),
          }),
          `students.${index}.${field}`,
        ),
      addStudent: () => {
        if (state.students.length >= MAX_STUDENTS_PER_REGISTRATION) return;
        studentCounter.current += 1;
        const newIndex = state.students.length;
        const lastName = state.students[0]?.lastName ?? "";
        update(
          (s) => ({ ...s, students: [...s.students, emptyStudent(`student-${studentCounter.current}`, lastName)] }),
          "students",
        );
        focusField(`students.${newIndex}.firstName`);
      },
      removeStudent: (index) => {
        // Errors are keyed by index, so clear all student errors after a removal.
        update((s) => ({ ...s, students: s.students.filter((_, i) => i !== index) }), "students");
      },
      setAcknowledgment: (id, value) =>
        update((s) => ({ ...s, acknowledgments: { ...s.acknowledgments, [id]: value } }), `acknowledgments.${id}`),
    }),
    [state, errors, update],
  );

  const goToStep = useCallback((index: number) => {
    setStepIndex(index);
    setFurthestStep((furthest) => Math.max(furthest, index));
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ block: "start" });
      stepHeadingRef.current?.focus({ preventScroll: true });
    });
  }, []);

  function goNext() {
    const stepErrors = validateStep(state, step.id);
    const keys = Object.keys(stepErrors);
    if (keys.length > 0) {
      setErrors(stepErrors);
      focusField(keys[0]);
      return;
    }
    setErrors({});
    goToStep(stepIndex + 1);
  }

  function goBack() {
    // Moving backward keeps all answers; only visible errors are cleared.
    setErrors({});
    setSubmitError(null);
    goToStep(stepIndex - 1);
  }

  function editStep(id: RegistrationStepId) {
    goToStep(REGISTRATION_STEPS.findIndex((s) => s.id === id));
  }

  async function submit() {
    if (inFlight.current) return;

    const input = toRegistrationInput(state);
    const parsed = registrationSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      setSubmitError("Some answers need attention before you can submit. Please use the links below to fix them.");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: input,
          idempotencyKey: idempotencyKey.current,
          formStartedAt: startedAt.current,
          website,
        }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.ok) {
        const confirmed = registrationResultSchema.safeParse(body);
        if (confirmed.success) {
          setResult(confirmed.data);
          setDirty(false);
          requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
          return;
        }
      }

      const payload = (body ?? {}) as { error?: unknown; fieldErrors?: unknown };
      if (payload.fieldErrors && typeof payload.fieldErrors === "object") {
        setErrors(payload.fieldErrors as Errors);
      }
      setSubmitError(
        typeof payload.error === "string" ? payload.error : "Something went wrong and your registration was not saved. Please try again.",
      );
    } catch {
      setSubmitError(NETWORK_ERROR);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div ref={topRef} className="scroll-mt-24">
        <RegistrationConfirmation result={result} email={state.primaryGuardian.email.trim().toLowerCase()} />
      </div>
    );
  }

  const isReview = step.id === "review";
  const errorCount = Object.keys(errors).length;
  const stepsWithErrors = isReview
    ? REGISTRATION_STEPS.filter((s) => s.id !== "review" && Object.keys(errors).some((path) => fieldBelongsToStep(path, s.id)))
    : [];

  return (
    <div ref={topRef} className="scroll-mt-24">
      <RegistrationProgress current={stepIndex} furthest={furthestStep} onSelect={goToStep} />

      <form
        noValidate
        className="mt-8"
        aria-labelledby="registration-step-heading"
        onSubmit={(event) => {
          event.preventDefault();
          if (isReview) void submit();
          else goNext();
        }}
      >
        <div className="mb-6">
          <p className="text-sm font-semibold text-gold-600">
            Step {stepIndex + 1} of {REGISTRATION_STEPS.length}
          </p>
          <h2
            id="registration-step-heading"
            ref={stepHeadingRef}
            tabIndex={-1}
            className="mt-1 font-serif text-2xl font-semibold text-pine-900 outline-none sm:text-3xl"
          >
            {isReview ? "Review your registration" : step.title}
          </h2>
          <p className="mt-1 text-ink-600">{step.description}</p>
        </div>

        {!isReview && errorCount > 0 && (
          <Alert tone="error" title={`Please correct ${errorCount === 1 ? "1 answer" : `${errorCount} answers`} to continue`} className="mb-6">
            The fields that need attention are marked below.
          </Alert>
        )}

        {step.id === "family" && <FamilyStep form={form} />}
        {step.id === "students" && <StudentsStep form={form} />}
        {step.id === "arabic" && <ArabicStep form={form} />}
        {step.id === "care" && <CareStep form={form} />}
        {step.id === "enrollment" && <EnrollmentStep form={form} schoolYear={schoolYear} />}
        {step.id === "consent" && <ConsentStep form={form} />}
        {isReview && (
          <>
            {submitError && (
              <Alert tone="error" title="Your registration has not been submitted yet" className="mb-6">
                <p>{submitError}</p>
                {stepsWithErrors.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {stepsWithErrors.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => editStep(s.id)}
                          className="rounded-md bg-white px-2.5 py-1 text-sm font-semibold text-danger-800 ring-1 ring-danger-200 hover:bg-danger-50"
                        >
                          Fix {s.title.toLowerCase()}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}
            <ReviewStep state={state} schoolYear={schoolYear} onEdit={editStep} />
          </>
        )}

        {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
        <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="website">Leave this field empty</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        <div className="no-print mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {stepIndex > 0 ? (
            <Button variant="secondary" size="lg" onClick={goBack} disabled={submitting}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {isReview ? (
            <Button type="submit" size="lg" disabled={submitting} aria-disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner />
                  Submitting…
                </>
              ) : (
                "Submit registration"
              )}
            </Button>
          ) : (
            <Button type="submit" size="lg">
              Continue
            </Button>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {submitting ? "Submitting your registration, please wait." : ""}
        </p>
      </form>
    </div>
  );
}
