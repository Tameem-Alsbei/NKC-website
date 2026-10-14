/**
 * School-specific copy and contact details, kept in one place so they can be
 * edited without touching page components.
 *
 * Values set to `null` are NOT known yet and must be supplied by the school.
 * The UI hides or softens anything that is `null`, and the README lists every
 * placeholder under "Remaining school-specific configuration".
 * Do not invent addresses, prices, phone numbers or policies here.
 */
export const school = {
  /** Short brand used in the header and page titles. */
  shortName: "NKC",
  /** TODO(school): confirm the official full name of the school. */
  name: "NKC Arabic School",
  /** Arabic name shown alongside the English one. */
  arabicName: "مدرسة اللغة العربية",
  tagline: "Saturday Arabic School",

  description:
    "A weekend Arabic language program where children build reading, writing and speaking skills in a warm, community-centered classroom.",

  /** TODO(school): which day(s) and hours classes meet, e.g. "Saturdays, 10:00 am – 1:00 pm". */
  schedule: null as string | null,
  /** TODO(school): the age or grade range the program accepts, e.g. "Pre-K through grade 12". */
  ageRange: null as string | null,

  contact: {
    /** TODO(school): public contact email for families. */
    email: null as string | null,
    /** TODO(school): public phone number, if the school wants one listed. */
    phone: null as string | null,
    /** TODO(school): street address or meeting location. */
    address: null as string | null,
  },

  registration: {
    /** TODO(school): tuition/fee information to show families. Leave null to hide. */
    tuitionSummary: null as string | null,
    /** TODO(school): registration deadline text, e.g. "August 31, 2026". */
    deadline: null as string | null,
  },
} as const;

/**
 * Acknowledgments a parent must accept before submitting.
 *
 * TODO(school): replace `label` text for any item marked `needsSchoolWording`
 * with wording approved by the school. Bump `CONSENT_VERSION` whenever the
 * wording changes so each registration records which version was accepted.
 */
export const CONSENT_VERSION = "2026-10-draft";

export const acknowledgments = [
  {
    id: "accuracy",
    label:
      "The information in this registration is accurate and complete to the best of my knowledge.",
    needsSchoolWording: false,
  },
  {
    id: "contact",
    label:
      "The school may contact me by email or phone about this registration and my child's participation in the program.",
    needsSchoolWording: false,
  },
  {
    id: "policies",
    label:
      "I have read and agree to follow the school's policies. (Placeholder: the school will provide its policy wording and a link here.)",
    needsSchoolWording: true,
  },
] as const;

export type AcknowledgmentId = (typeof acknowledgments)[number]["id"];
