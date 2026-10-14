import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ButtonLink } from "@/components/ui/button";
import { school } from "@/lib/config/school";
import { formatSchoolYear, getOpenSchoolYear } from "@/lib/school-year";

export const metadata: Metadata = {
  title: { absolute: `${school.name} | ${school.tagline}` },
  description: school.description,
};

// Re-check whether registration is open every five minutes.
export const revalidate = 300;

const HIGHLIGHTS = [
  {
    title: "Reading & writing",
    body: "From the alphabet and letter sounds to reading and writing with confidence, at a pace that suits each child.",
    icon: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5v-12ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 0 1.5-1.5v-12Z" />,
  },
  {
    title: "Speaking & listening",
    body: "Everyday vocabulary, conversation and listening practice that help students use Arabic, not just study it.",
    icon: <path d="M5 6h14v9H9l-4 3V6Zm4 4h6" />,
  },
  {
    title: "Grouped by level",
    body: "Students are placed in groups by age and Arabic experience, so beginners and fluent speakers are both supported.",
    icon: <path d="M4 18h4v-6H4v6Zm6 0h4V8h-4v10Zm6 0h4V4h-4v14Z" />,
  },
  {
    title: "A caring community",
    body: "A welcoming weekend space where children build friendships and a connection to the Arabic language and culture.",
    icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  },
];

const AUDIENCES = [
  {
    title: "New learners",
    body: "Children who are just starting out, including those with no Arabic at home.",
  },
  {
    title: "Heritage speakers",
    body: "Students who hear or speak Arabic at home and want to read, write and speak with more confidence.",
  },
  {
    title: "Returning families",
    body: "Students continuing from a previous year. Re-registering takes only a few minutes.",
  },
];

const REGISTRATION_STEPS = [
  {
    title: "Gather your details",
    body: "Contact information for each parent or guardian, and each child's date of birth, grade and Arabic background.",
  },
  {
    title: "Complete one family form",
    body: "Register all of your children together. You can review everything before you submit.",
  },
  {
    title: "Save your reference number",
    body: "You'll get a reference number for each child as soon as your registration is received.",
  },
  {
    title: "The school follows up",
    body: "School staff review each registration and will contact you about next steps.",
  },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-11 place-items-center rounded-xl bg-pine-50 text-pine-700 ring-1 ring-pine-100">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-gold-600">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl font-semibold text-pine-900 sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-ink-600">{intro}</p>}
    </div>
  );
}

function DetailRow({ label, value, fallback }: { label: string; value: string | null; fallback: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-0 sm:flex-row sm:gap-6">
      <dt className="w-40 shrink-0 font-semibold text-ink-900">{label}</dt>
      <dd className={value ? "text-ink-700" : "text-ink-500 italic"}>{value ?? fallback}</dd>
    </div>
  );
}

export default async function HomePage() {
  const openYear = await getOpenSchoolYear();
  const yearLabel = openYear ? formatSchoolYear(openYear) : null;
  const { contact, registration } = school;
  const hasContact = Boolean(contact.email || contact.phone || contact.address);

  return (
    <>
      <SiteHeader showRegister={Boolean(openYear)} />
      <main id="main">
        {/* Hero */}
        <section className="on-dark relative overflow-hidden bg-pine-900 text-cream-50">
          <div className="pattern-girih absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <p lang="ar" dir="rtl" className="w-fit font-arabic text-2xl text-gold-300 sm:text-3xl">
                أهلاً وسهلاً
              </p>
              <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight sm:text-5xl lg:text-[3.4rem]">
                Growing confident Arabic readers, writers and speakers
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream-100">{school.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {openYear ? (
                  <ButtonLink href="/register" variant="gold" size="lg">
                    Register for {yearLabel}
                  </ButtonLink>
                ) : (
                  <p className="rounded-lg bg-white/10 px-4 py-3 text-cream-100 ring-1 ring-white/15">
                    Registration is currently closed. Please check back soon.
                  </p>
                )}
                <ButtonLink
                  href="#program"
                  size="lg"
                  variant="ghost"
                  className="text-cream-50 ring-1 ring-cream-50/30 hover:bg-white/10 active:bg-white/15"
                >
                  About the program
                </ButtonLink>
              </div>
            </div>

            <div className="rounded-2xl bg-cream-50 p-6 text-ink-900 shadow-xl ring-1 ring-black/5 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-gold-600">
                {openYear ? "Now enrolling" : "Registration"}
              </p>
              <p className="mt-2 font-serif text-2xl font-semibold text-pine-900">
                {openYear ? `The ${yearLabel} school year` : "Opening soon"}
              </p>
              <ul className="mt-5 space-y-3 text-[0.95rem] text-ink-700">
                {[
                  "Register all of your children in one form",
                  "New and returning students welcome",
                  "Placement by age and Arabic level",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0 text-pine-600" fill="currentColor">
                      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              {openYear && (
                <ButtonLink href="/register" className="mt-6 w-full" size="lg">
                  Start registration
                </ButtonLink>
              )}
            </div>
          </div>
        </section>

        {/* Program */}
        <section id="program" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="The program"
              title="Arabic learning that fits family life"
              intro="Our weekend program gives children steady, meaningful time with the Arabic language in a supportive classroom."
            />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {HIGHLIGHTS.map((item) => (
                <li key={item.title} className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
                  <Icon>{item.icon}</Icon>
                  <h3 className="mt-5 font-serif text-xl font-semibold text-pine-900">{item.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-600">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Who we serve */}
        <section id="who" className="scroll-mt-20 border-y border-line bg-cream-100 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
            <SectionHeading
              eyebrow="Who we serve"
              title="Every child, whatever their starting point"
              intro={school.ageRange ? `The program is open to students in ${school.ageRange}.` : undefined}
            />
            <ul className="grid gap-4">
              {AUDIENCES.map((item, index) => (
                <li key={item.title} className="flex gap-5 rounded-2xl bg-white p-6 ring-1 ring-line">
                  <span className="font-serif text-3xl font-semibold text-gold-600" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-pine-900">{item.title}</h3>
                    <p className="mt-1 leading-relaxed text-ink-600">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Registration information */}
        <section id="registration" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Registration"
              title="How registration works"
              intro="Registration is completed online by a parent or guardian. Here is what to expect."
            />
            <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {REGISTRATION_STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl border border-line bg-white p-6">
                  <span className="grid size-9 place-items-center rounded-full bg-pine-800 font-semibold text-cream-50">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-serif text-lg font-semibold text-pine-900">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-600">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
                <h3 className="font-serif text-xl font-semibold text-pine-900">Important information</h3>
                <dl className="mt-4">
                  <DetailRow label="School year" value={yearLabel} fallback="Will be announced when registration opens" />
                  <DetailRow label="Schedule" value={school.schedule} fallback="Class days and times will be shared by the school" />
                  <DetailRow label="Deadline" value={registration.deadline} fallback="To be announced" />
                  <DetailRow label="Tuition & fees" value={registration.tuitionSummary} fallback="Details will be shared by the school" />
                </dl>
              </div>
              <div className="rounded-2xl bg-pine-50 p-6 ring-1 ring-pine-100 sm:p-8">
                <h3 className="font-serif text-xl font-semibold text-pine-900">Your family&apos;s privacy</h3>
                <p className="mt-3 leading-relaxed text-ink-700">
                  We ask only for what the school needs to run the program and keep children safe. Registration details
                  are visible only to authorized school administrators and are never shared publicly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-20 border-t border-line bg-cream-100 py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <SectionHeading
              eyebrow="Contact"
              title="Questions? We're happy to help."
              intro="If you have questions about the program or your registration, please get in touch with the school."
            />
            <div className="rounded-2xl bg-white p-6 ring-1 ring-line sm:p-8">
              {hasContact ? (
                <dl className="space-y-4">
                  {contact.email && (
                    <div>
                      <dt className="text-sm font-semibold text-ink-500">Email</dt>
                      <dd>
                        <a className="text-lg font-semibold text-pine-800 underline-offset-4 hover:underline" href={`mailto:${contact.email}`}>
                          {contact.email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <dt className="text-sm font-semibold text-ink-500">Phone</dt>
                      <dd>
                        <a className="text-lg font-semibold text-pine-800 underline-offset-4 hover:underline" href={`tel:${contact.phone}`}>
                          {contact.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {contact.address && (
                    <div>
                      <dt className="text-sm font-semibold text-ink-500">Location</dt>
                      <dd className="text-lg text-ink-900">{contact.address}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="leading-relaxed text-ink-600">
                  Contact details for the school will be posted here soon. If you have already registered, please keep
                  your reference number handy when you reach out.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        {openYear && (
          <section className="on-dark bg-pine-800 py-14 text-cream-50">
            <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
              <div>
                <h2 className="font-serif text-3xl font-semibold">Ready to join us for {yearLabel}?</h2>
                <p className="mt-2 text-cream-100">Register all of your children in one simple form.</p>
              </div>
              <ButtonLink href="/register" variant="gold" size="lg">
                Register now
              </ButtonLink>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
