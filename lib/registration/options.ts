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

export const ARABIC_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ArabicLevel = (typeof ARABIC_LEVELS)[number];

export const ARABIC_LEVEL_LABELS: Record<ArabicLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const ARABIC_LEVEL_DESCRIPTIONS: Record<ArabicLevel, string> = {
  beginner: "Little or no Arabic; learning letters and sounds",
  intermediate: "Reads simple words and sentences; understands some speech",
  advanced: "Reads and writes independently; holds conversations",
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
