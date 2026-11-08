import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { faqs, formatAddress, formatTuition, mapsUrl, program, programActivities } from "@/lib/config/program";
import { formatQuranLevel, QURAN_LEVELS } from "@/lib/registration/options";
import { formatSchoolYear, getOpenSchoolYear } from "@/lib/school-year";
import { getActiveTheme } from "@/lib/themes";

export const metadata: Metadata = {
  title: { absolute: `${program.name} | ${program.schedule.summary}` },
  description: program.description,
};

// Re-check registration status and the active theme every five minutes.
export const revalidate = 300;

/** Simple line icons for the three parts of the program (decorative). */
const ACTIVITY_ICONS: Record<(typeof programActivities)[number]["id"], ReactNode> = {
  quran: (
    <>
      <path d="M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  halaqah: (
    <>
      <circle cx="12" cy="6" r="2" />
      <circle cx="5.5" cy="12" r="2" />
      <circle cx="18.5" cy="12" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M8.5 8.5 7 10M15.5 8.5 17 10M7 14l1.5 1.5M17 14l-1.5 1.5" />
    </>
  ),
  activities: (
    <>
      <path d="M12 3.5 14.4 8.4l5.4.8-3.9 3.8.9 5.4L12 15.9l-4.8 2.5.9-5.4L4.2 9.2l5.4-.8Z" />
    </>
  ),
};

const ACTIVITY_ACCENTS: Record<(typeof programActivities)[number]["id"], string> = {
  quran: "bg-brand-100 text-brand-700",
  halaqah: "bg-leaf-100 text-leaf-700",
  activities: "bg-sun-100 text-sun-700",
};

function Icon({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

export default async function HomePage() {
  const [openYear, theme] = await Promise.all([getOpenSchoolYear(), getActiveTheme()]);
  const answeredFaqs = faqs.filter((faq): faq is { question: string; answer: string } => faq.answer !== null);
  const { schedule, location, contact } = program;

  return (
    <>
      <SiteHeader showRegister={Boolean(openYear)} />
      <main id="main">
        {/* Hero */}
        <section className="pattern-stars relative overflow-hidden border-b border-line bg-brand-50">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h1 className="font-display text-4xl font-semibold leading-tight text-brand-800 sm:text-5xl lg:text-6xl">
                {program.name}
              </h1>
              <p className="mt-4 text-xl font-semibold text-ink-700 sm:text-2xl">
                Quran, halaqah and fun activities for kids, every Saturday from {schedule.startTime} to {schedule.endTime}.
              </p>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-600">
                Children learn Quran with their teachers, grow in their deen through halaqah, and make friends in the Noor
                community.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {openYear ? (
                  <ButtonLink href="/register" variant="cta" size="lg">
                    Register for {formatSchoolYear(openYear)}
                  </ButtonLink>
                ) : (
                  <p className="rounded-xl bg-white px-4 py-3 font-semibold text-ink-700 ring-1 ring-line">
                    Registration is closed right now.
                  </p>
                )}
                <a href="#program" className={buttonClasses("secondary", "lg")}>
                  Learn about the program
                </a>
              </div>
            </div>

            <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
              <h2 className="font-display text-2xl font-semibold text-brand-800">Program details</h2>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-sm font-bold text-ink-500">When</dt>
                  <dd className="text-lg font-semibold text-ink-900">
                    {schedule.days}, {schedule.startTime}–{schedule.endTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-bold text-ink-500">Where</dt>
                  <dd className="text-lg font-semibold text-ink-900">{location.venue}</dd>
                  <dd className="text-ink-600">{formatAddress()}</dd>
                </div>
                <div>
                  <dt className="text-sm font-bold text-ink-500">Tuition</dt>
                  <dd className="text-lg font-semibold text-ink-900">{formatTuition()}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Program */}
        <section id="program" className="scroll-mt-24 py-16 sm:py-24" aria-labelledby="program-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 id="program-heading" className="font-display text-3xl font-semibold text-brand-800 sm:text-4xl">
                What children do on Saturdays
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-600">
                Each afternoon brings together Quran, Islamic learning and time to play.
              </p>
            </div>
            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {programActivities.map((activity) => (
                <article key={activity.id} className="flex flex-col gap-4">
                  <Icon className={ACTIVITY_ACCENTS[activity.id]}>{ACTIVITY_ICONS[activity.id]}</Icon>
                  <h3 className="font-display text-2xl font-semibold text-brand-800">{activity.title}</h3>
                  <p className="text-lg leading-relaxed text-ink-600">{activity.body}</p>
                  {activity.id === "quran" && (
                    <a href="#quran-levels" className="w-fit font-bold text-brand-700 underline-offset-4 hover:underline">
                      See the Quran levels
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Quran levels */}
        <section id="quran-levels" className="scroll-mt-24 border-y border-line bg-mist-50 py-16 sm:py-20" aria-labelledby="levels-heading">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <h2 id="levels-heading" className="font-display text-3xl font-semibold text-brand-800 sm:text-4xl">
                Quran levels
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-600">
                Every student is placed in a Quran level and learns with an assigned Quran teacher. When you register,
                tell us about your child&apos;s Quran reading, and we&apos;ll take it from there.
              </p>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line">
              {QURAN_LEVELS.map((level) => (
                <li key={level.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-5">
                  <span className="font-display text-xl font-semibold text-brand-800">{formatQuranLevel(level.id, level.name)}</span>
                  <span className="text-ink-600">{level.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Rotating theme: shown only once a real theme is published */}
        {theme && (
          <section className="py-16 sm:py-20" aria-labelledby="theme-heading">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div
                className="rounded-[var(--radius-card)] border-l-8 bg-white p-8 shadow-[var(--shadow-card)] ring-1 ring-line"
                style={{ borderLeftColor: theme.colorHex ?? "var(--color-sun-500)" }}
              >
                <p className="text-sm font-bold text-ink-500">This year&apos;s theme</p>
                <h2 id="theme-heading" className="mt-1 font-display text-3xl font-semibold text-brand-800">
                  {theme.name}
                </h2>
                <p className="mt-2 text-lg font-semibold text-ink-700">{theme.mainValue}</p>
                {theme.description && <p className="mt-3 max-w-3xl leading-relaxed text-ink-600">{theme.description}</p>}
              </div>
            </div>
          </section>
        )}

        {/* Schedule and tuition */}
        <section id="schedule" className="scroll-mt-24 py-16 sm:py-20" aria-labelledby="schedule-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="schedule-heading" className="font-display text-3xl font-semibold text-brand-800 sm:text-4xl">
              Schedule and tuition
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="rounded-[var(--radius-card)] bg-brand-800 p-6 text-white">
                <h3 className="font-display text-xl font-semibold">{schedule.days}</h3>
                <p className="mt-2 text-3xl font-bold">
                  {schedule.startTime}–{schedule.endTime}
                </p>
              </div>
              <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-line">
                <h3 className="font-display text-xl font-semibold text-brand-800">Location</h3>
                <p className="mt-2 font-semibold text-ink-900">{location.venue}</p>
                <p className="text-ink-600">{formatAddress()}</p>
                <a className="mt-3 inline-block font-bold text-brand-700 underline-offset-4 hover:underline" href={mapsUrl()} target="_blank" rel="noopener noreferrer">
                  Get directions<span className="sr-only"> (opens Google Maps)</span>
                </a>
              </div>
              <div className="rounded-[var(--radius-card)] bg-sun-50 p-6 ring-1 ring-sun-200">
                <h3 className="font-display text-xl font-semibold text-brand-800">Tuition</h3>
                <p className="mt-2 text-3xl font-bold text-ink-900">{formatTuition()}</p>
                <p className="mt-2 text-sm text-ink-600">
                  Questions about tuition? Email{" "}
                  <a className="font-bold text-brand-700 underline underline-offset-4" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        {answeredFaqs.length > 0 && (
          <section id="faq" className="scroll-mt-24 border-t border-line bg-mist-50 py-16 sm:py-20" aria-labelledby="faq-heading">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
              <h2 id="faq-heading" className="font-display text-3xl font-semibold text-brand-800 sm:text-4xl">
                Questions parents ask
              </h2>
              <div className="mt-8 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line">
                {answeredFaqs.map((faq) => (
                  <details key={faq.question} className="group px-6 py-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-bold text-ink-900 [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-brand-600 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="m5 8 5 5 5-5" />
                      </svg>
                    </summary>
                    <p className="pb-5 leading-relaxed text-ink-600">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Contact and registration */}
        <section id="contact" className="on-dark scroll-mt-24 bg-brand-800 py-16 text-white sm:py-20" aria-labelledby="contact-heading">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="contact-heading" className="font-display text-3xl font-semibold sm:text-4xl">
                {openYear ? "We'd love to see your family on Saturday" : "Get in touch"}
              </h2>
              <p className="mt-3 text-lg text-brand-100">
                Questions about Noor Kids Club? Email us at{" "}
                <a className="font-bold text-sun-300 underline underline-offset-4" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              </p>
            </div>
            {openYear && (
              <ButtonLink href="/register" variant="cta" size="lg" className="shrink-0">
                Register now
              </ButtonLink>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
