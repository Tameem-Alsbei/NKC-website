/**
 * Allowed values shared by the registration form, the API, the admin
 * dashboard and the database CHECK constraints. Keep these lists in sync with
 * supabase/migrations.
 */

export const GRADES = ["Pre-K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABELS: Record<Grade, string> = {
  "Pre-K": "Pre-K",
  K: "Kindergarten",
  "1": "1st grade",
  "2": "2nd grade",
  "3": "3rd grade",
  "4": "4th grade",
  "5": "5th grade",
  "6": "6th grade",
  "7": "7th grade",
  "8": "8th grade",
  "9": "9th grade",
  "10": "10th grade",
  "11": "11th grade",
  "12": "12th grade",
};

/** Needed so administrators can place children in color groups. */
export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Boy",
  female: "Girl",
};

/**
 * What a parent tells us about their child's Quran reading. This is only
 * guidance: administrators decide the actual Quran level and teacher.
 */
export const QURAN_ABILITIES = [
  "not_started",
  "learning_letters",
  "reading_with_help",
  "reading_fluently",
  "memorizing",
] as const;
export type QuranAbility = (typeof QURAN_ABILITIES)[number];

export const QURAN_ABILITY_LABELS: Record<QuranAbility, string> = {
  not_started: "Not reading Arabic letters yet",
  learning_letters: "Learning the Arabic letters and sounds",
  reading_with_help: "Reads the Quran with some help",
  reading_fluently: "Reads the Quran fluently",
  memorizing: "Reads fluently and is memorizing",
};

/**
 * Noor Kids Club Quran levels, in their official order. The database seeds
 * the same four rows (quran_levels.id is the level number).
 */
export const QURAN_LEVELS = [
  { id: 4, name: "Hifz", summary: "Quran memorization" },
  { id: 3, name: "Tajweed", summary: "The rules of correct recitation" },
  { id: 2, name: "Tilawah", summary: "Reading and reciting the Quran" },
  { id: 1, name: "Nooraniah", summary: "Foundations: Arabic letters and sounds" },
] as const;

/** "4 – Hifz" */
export function formatQuranLevel(id: number, name?: string | null): string {
  const levelName = name ?? QURAN_LEVELS.find((level) => level.id === id)?.name ?? "";
  return `${id} – ${levelName}`;
}

/**
 * @deprecated Arabic level was collected by the earlier form. It is kept only
 * to label legacy data; new registrations no longer ask for it.
 */
export const ARABIC_LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const RELATIONSHIPS = ["mother", "father", "parent", "guardian", "grandparent", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  mother: "Mother",
  father: "Father",
  parent: "Parent",
  guardian: "Legal guardian",
  grandparent: "Grandparent",
  other: "Other",
};

export const REGISTRATION_STATUSES = [
  "pending",
  "under_review",
  "confirmed",
  "waitlisted",
  "withdrawn",
  "rejected",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  confirmed: "Confirmed",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
  rejected: "Not accepted",
};

export const PAYMENT_STATUSES = ["not_paid", "partially_paid", "paid", "waived"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_paid: "Not paid",
  partially_paid: "Partially paid",
  paid: "Paid",
  waived: "Waived / scholarship",
};

export const PAYMENT_METHODS = ["cash", "check", "card_in_person", "online", "bank_transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  card_in_person: "Card (in person)",
  online: "Online",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export const REVIEW_REASON_LABELS: Record<string, string> = {
  guardian_details_differ:
    "The guardian's name doesn't match the existing record for this email address.",
  contact_details_differ:
    "Phone or emergency contact differs from what is on file. See the submitted details.",
  guardian_in_other_household: "The second guardian is already linked to a different family.",
  returning_student_not_matched:
    "Marked as returning, but no earlier record was matched automatically.",
  possible_duplicate_student:
    "A student with the same name and date of birth already exists in another family.",
};

export const MAX_STUDENTS_PER_REGISTRATION = 8;
export const SPECIAL_CONSIDERATIONS_MAX_LENGTH = 1000;
