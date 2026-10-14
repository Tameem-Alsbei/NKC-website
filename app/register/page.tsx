import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ButtonLink } from "@/components/ui/button";
import { school } from "@/lib/config/school";
import { formatSchoolYear, getOpenSchoolYear } from "@/lib/school-year";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Student registration",
  description: `Register your children for ${school.name}. One form for the whole family.`,
};

export default async function RegisterPage() {
  // Always check live whether registration is open.
  await connection();
  const openYear = await getOpenSchoolYear();

  return (
    <>
      <SiteHeader showRegister={false} />
      <main id="main" className="flex-1 bg-cream-50">
        <div className="border-b border-line bg-cream-100">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-gold-600">
              {openYear ? `${formatSchoolYear(openYear)} school year` : "Registration"}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-pine-900 sm:text-4xl">Student registration</h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-600">
              One form for your whole family. You can register several children at once, and you&apos;ll be able to
              review everything before you submit.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          {openYear ? (
            <RegistrationForm schoolYear={openYear} />
          ) : (
            <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
              <h2 className="font-serif text-2xl font-semibold text-pine-900">Registration is currently closed</h2>
              <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-600">
                Online registration isn&apos;t open right now. Please check back soon or contact the school with any
                questions.
              </p>
              <ButtonLink href="/#contact" variant="secondary" className="mt-6">
                Contact information
              </ButtonLink>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
