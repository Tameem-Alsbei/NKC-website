"use client";

import { useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { formatTuition, program } from "@/lib/config/program";
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
      <div className="on-dark bg-brand-800 px-6 py-8 text-white sm:px-8">
        <Logo size="md" plate href={null} className="mb-5" />
        <div className="grid size-12 place-items-center rounded-full bg-sun-500 text-brand-950" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-3xl font-semibold outline-none">
          Registration received
        </h2>
        <p className="mt-2 text-brand-100">
          JazakAllahu khayran! Your {program.name} registration for {formatSchoolYear(result.schoolYear)} has been submitted.
        </p>
      </div>

      <div className="space-y-6 px-6 py-7 sm:px-8">
        <div>
          <h3 className="font-semibold text-ink-900">Your reference number{plural ? "s" : ""}</h3>
          <p className="mt-1 text-sm text-ink-500">Please save {plural ? "these" : "this"} for any questions about your registration.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {result.registrations.map((registration) => (
              <li key={registration.referenceCode} className="rounded-xl border-2 border-sun-300 bg-sun-50 px-4 py-3">
                <p className="text-sm text-ink-600">{registration.studentFirstName}</p>
                <p className="font-mono text-xl font-semibold tracking-wider text-brand-800">{registration.referenceCode}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-brand-50 p-5 ring-1 ring-brand-100">
          <h3 className="font-semibold text-brand-800">What happens next</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-700">
            <li>Our team will review your registration and place each child in their groups.</li>
            <li>
              We&apos;ll contact you{email ? <> at <strong className="font-semibold">{email}</strong></> : null} about
              next steps.
            </li>
            <li>Tuition is {formatTuition()}.</li>
            <li>
              Questions? Email{" "}
              <a className="font-semibold text-brand-700 underline underline-offset-4" href={`mailto:${program.contact.email}`}>
                {program.contact.email}
              </a>
              .
            </li>
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
