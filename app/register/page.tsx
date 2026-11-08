import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { formatTuition, program } from "@/lib/config/program";
import { formatSchoolYear, getOpenSchoolYear } from "@/lib/school-year";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Register",
  description: `Register your children for ${program.name}, ${program.schedule.summary}. One form for the whole family.`,
};

export default async function RegisterPage() {
  // Always check live whether registration is open.
  await connection();
  const openYear = await getOpenSchoolYear();

  return (
    <>
      <SiteHeader showRegister={false} />
      <main id="main" className="flex-1">
        <div className="pattern-stars border-b border-line bg-brand-50">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
            <h1 className="font-display text-3xl font-semibold text-brand-800 sm:text-4xl">
              {openYear ? `Register for ${formatSchoolYear(openYear)}` : `Register for ${program.name}`}
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-700">
              One form for your whole family. Add each of your children, and you&apos;ll be able to review everything
              before you submit.
            </p>
            <p className="mt-4 text-sm font-semibold text-ink-600">
              {program.schedule.summary} · Tuition {formatTuition()}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          {openYear ? (
            <RegistrationForm schoolYear={openYear} />
          ) : (
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
              <h2 className="font-display text-2xl font-semibold text-brand-800">Registration is closed right now</h2>
              <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-600">
                Online registration isn&apos;t open at the moment. For questions, please email us at{" "}
                <a className="font-bold text-brand-700 underline underline-offset-4" href={`mailto:${program.contact.email}`}>
                  {program.contact.email}
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
