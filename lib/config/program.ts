import logoImage from "@/public/brand/noor-kids-club-logo.jpg";

/**
 * Noor Kids Club: every organization-specific fact the website shows lives
 * here, so it can be updated without searching through components.
 *
 * Only confirmed information is filled in. Anything set to `null` is unknown
 * and is hidden from the site until the program supplies it. Do not invent
 * phone numbers, deadlines, billing periods or policies here.
 */
export const program = {
  name: "Noor Kids Club",
  /** Short form used for internal reference codes (NKC-XXXXXXXX). */
  initials: "NKC",
  description:
    "A Saturday Islamic program for children with Quran classes, halaqah and fun activities in a caring community.",

  schedule: {
    days: "Saturdays",
    startTime: "2:30 PM",
    endTime: "5:30 PM",
    /** Compact form used in headings, e.g. "Saturdays, 2:30–5:30 PM". */
    summary: "Saturdays, 2:30–5:30 PM",
  },

  tuition: {
    amount: 185,
    currency: "USD",
    /**
     * TODO(program): e.g. "per child, per school year". Leave null until the
     * billing period is confirmed. The site then shows the amount alone.
     */
    periodLabel: null as string | null,
  },

  contact: {
    email: "noorkidsclub@noorohio.com",
    /** TODO(program): add only if the program wants a public phone number. */
    phone: null as string | null,
  },

  location: {
    venue: "NICC",
    /** TODO(program): confirm the venue's full name if it should be spelled out. */
    venueFullName: null as string | null,
    street: "5001 Wilcox Rd",
    city: "Dublin",
    region: "OH",
    postalCode: "43016",
  },

  /** TODO(program): registration deadline text, or null to hide it. */
  registrationDeadline: null as string | null,
} as const;

/** The three parts of every Saturday, in the order families see them. */
export const programActivities = [
  {
    id: "quran",
    title: "Quran",
    body: "Students are placed into Quran levels and work with their assigned Quran teachers.",
  },
  {
    id: "halaqah",
    title: "Halaqah",
    body: "Age-appropriate Islamic learning, reflection, discussion and character development.",
  },
  {
    id: "activities",
    title: "Fun Activities",
    body: "Organized activities that help children build friendships and enjoy being part of the Noor community.",
  },
] as const;

/** Official logo. Use components/site/logo.tsx rather than this directly. */
export const brandAssets = {
  logo: logoImage,
  logoPath: "/brand/noor-kids-club-logo.jpg",
  logoAlt: "Noor Kids Club",
} as const;

/**
 * Brand colors from the logo. The full palette (with accessible text shades)
 * is defined as CSS tokens in app/globals.css.
 */
export const brandColors = {
  blue: "#0e386c",
  orange: "#e08a28",
  white: "#ffffff",
  green: "#2c8049",
} as const;

/**
 * Frequently asked questions. An entry whose `answer` is null is hidden.
 * TODO(program): fill in answers for the remaining questions when confirmed.
 */
export const faqs: { question: string; answer: string | null }[] = [
  {
    question: "When does Noor Kids Club meet?",
    answer: `${program.schedule.days} from ${program.schedule.startTime} to ${program.schedule.endTime}.`,
  },
  {
    question: "Where is the program held?",
    answer: `At ${program.location.venue}, ${program.location.street}, ${program.location.city}, ${program.location.region} ${program.location.postalCode}.`,
  },
  {
    question: "How much is tuition?",
    answer: `Tuition is $${program.tuition.amount}${program.tuition.periodLabel ? ` ${program.tuition.periodLabel}` : ""}. Please email us if you have questions about payment.`,
  },
  {
    question: "How is my child's Quran level decided?",
    answer:
      "You tell us about your child's Quran experience when you register. The program then places each student in a Quran level and with a Quran teacher.",
  },
  {
    question: "Can I register more than one child?",
    answer: "Yes. You can add all of your children in one registration form.",
  },
  { question: "What should my child bring?", answer: null },
  { question: "What is the refund policy?", answer: null },
];

export function formatTuition(): string {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: program.tuition.currency,
    maximumFractionDigits: 0,
  }).format(program.tuition.amount);
  return program.tuition.periodLabel ? `${amount} ${program.tuition.periodLabel}` : amount;
}

export function formatAddress(): string {
  const { street, city, region, postalCode } = program.location;
  return `${street}, ${city}, ${region} ${postalCode}`;
}

/** A plain Google Maps search link (no API key, no tracking parameters). */
export function mapsUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${program.location.venue}, ${formatAddress()}`)}`;
}

/**
 * Acknowledgments a parent must accept before submitting.
 * TODO(program): replace any item marked `needsProgramWording` with approved
 * wording, then bump CONSENT_VERSION so registrations record what was accepted.
 */
export const CONSENT_VERSION = "2026-11-draft";

export const acknowledgments = [
  {
    id: "accuracy",
    label: "The information in this registration is accurate and complete to the best of my knowledge.",
    needsProgramWording: false,
  },
  {
    id: "contact",
    label: "Noor Kids Club may contact me by email or phone about this registration and my child's participation.",
    needsProgramWording: false,
  },
  {
    id: "policies",
    label:
      "I agree to follow Noor Kids Club's program policies. (Placeholder: the program will provide its policy wording here.)",
    needsProgramWording: true,
  },
] as const;

export type AcknowledgmentId = (typeof acknowledgments)[number]["id"];

/** Rotating six-year theme display settings. Theme content lives in the database. */
export const themeSettings = {
  /** Show the active theme on the homepage once one is configured and published. */
  showOnHomepage: true,
  cycleLength: 6,
} as const;
