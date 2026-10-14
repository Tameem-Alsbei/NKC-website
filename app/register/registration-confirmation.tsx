"use client";

import { useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { school } from "@/lib/config/school";
import type { RegistrationResult } from "@/lib/registration/schema";
import { formatSchoolYear } from "@/lib/school-year-format";

export function RegistrationConfirmation({ result, email }: { result: RegistrationResult; email: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const plural = result.registrations.length > 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
      <div className="on-dark bg-pine-800 px-6 py-8 text-cream-50 sm:px-8">
        <div className="grid size-12 place-items-center rounded-full bg-gold-300 text-pine-900" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 font-serif text-3xl font-semibold outline-none">
          Registration received
        </h2>
        <p className="mt-2 text-cream-100">
          Thank you! Your registration for the {formatSchoolYear(result.schoolYear)} school year has been submitted.
        </p>
      </div>

      <div className="space-y-6 px-6 py-7 sm:px-8">
        <div>
          <h3 className="font-semibold text-ink-900">Your reference number{plural ? "s" : ""}</h3>
          <p className="mt-1 text-sm text-ink-500">Please save {plural ? "these" : "this"} for any questions about your registration.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {result.registrations.map((registration) => (
              <li key={registration.referenceCode} className="rounded-xl border border-gold-300 bg-cream-100 px-4 py-3">
                <p className="text-sm text-ink-600">{registration.studentFirstName}</p>
                <p className="font-mono text-xl font-semibold tracking-wider text-pine-900">{registration.referenceCode}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-pine-50 p-5 ring-1 ring-pine-100">
          <h3 className="font-semibold text-pine-900">What happens next</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-700">
            <li>School staff will review your registration.</li>
            <li>
              We&apos;ll contact you{email ? <> at <strong className="font-semibold">{email}</strong></> : null} about
              placement and next steps.
            </li>
            {school.registration.tuitionSummary && <li>{school.registration.tuitionSummary}</li>}
          </ul>
        </div>

        <div className="no-print flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => window.print()}>
            Print this page
          </Button>
          <ButtonLink href="/" variant="ghost">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
