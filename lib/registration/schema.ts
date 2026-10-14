import { z } from "zod";
import { acknowledgments, type AcknowledgmentId } from "@/lib/config/school";
import {
  ARABIC_LEVELS,
  GRADES,
  MAX_STUDENTS_PER_REGISTRATION,
  RELATIONSHIPS,
  SPECIAL_CONSIDERATIONS_MAX_LENGTH,
} from "./options";

/**
 * One schema validates the registration in the browser (step by step) and
 * again on the server before anything reaches the database.
 */

// Letters, spaces, apostrophes, hyphens and periods in any script; no control characters.
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .\-]*$/u;
const PHONE_PATTERN = /^[0-9+().\-\s]+$/;

const collapseSpaces = (value: string) => value.replace(/\s+/g, " ").trim();

const personName = (label: string) =>
  z
    .string({ error: `Please enter ${label}` })
    .transform(collapseSpaces)
    .pipe(
      z
        .string()
        .min(1, `Please enter ${label}`)
        .max(80, "Please use 80 characters or fewer")
        .regex(NAME_PATTERN, "Please use letters, spaces, hyphens or apostrophes only"),
    );

const email = z
  .string({ error: "Please enter an email address" })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(1, "Please enter an email address")
      .max(254, "That email address is too long")
      .pipe(z.email("Please enter a valid email address, like name@example.com")),
  );

const phone = z
  .string({ error: "Please enter a phone number" })
  .transform(collapseSpaces)
  .pipe(
    z
      .string()
      .min(1, "Please enter a phone number")
      .max(25, "That phone number is too long")
      .regex(PHONE_PATTERN, "Please use digits and + ( ) - only")
      .refine((value) => {
        const digits = value.replace(/\D/g, "").length;
        return digits >= 7 && digits <= 15;
      }, "Please enter a complete phone number, including area code"),
  );

const relationship = z.enum(RELATIONSHIPS, { error: "Please choose a relationship" });

export const primaryGuardianSchema = z.object({
  firstName: personName("a first name"),
  lastName: personName("a last name"),
  email,
  phone,
  relationship,
});

export const secondaryGuardianSchema = z.object({
  firstName: personName("a first name"),
  lastName: personName("a last name"),
  email: email.nullable(),
  phone: phone.nullable(),
  relationship,
});

export const emergencyContactSchema = z.object({
  name: z
    .string({ error: "Please enter a name" })
    .transform(collapseSpaces)
    .pipe(z.string().min(1, "Please enter a name").max(120, "Please use 120 characters or fewer")),
  phone,
  relationship: z
    .string()
    .transform(collapseSpaces)
    .pipe(z.string().max(60, "Please use 60 characters or fewer"))
    .nullable(),
});

/** Today's date as YYYY-MM-DD in the school's local time. */
function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function ageOnDate(dateOfBirth: string, on: string = todayIso()): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export const studentSchema = z.object({
  firstName: personName("the student's first name"),
  lastName: personName("the student's last name"),
  dateOfBirth: z
    .iso.date({ error: "Please enter a valid date of birth" })
    .refine((value) => value <= todayIso(), "The date of birth can't be in the future")
    .refine((value) => {
      const age = ageOnDate(value);
      return age >= 2 && age <= 20;
    }, "Please check the date of birth. The student should be between 2 and 20 years old."),
  grade: z.enum(GRADES, { error: "Please choose a grade" }),
  isReturning: z.boolean({ error: "Please tell us whether this student is new or returning" }),
  arabicLevel: z.enum(ARABIC_LEVELS, { error: "Please choose the closest Arabic level" }),
  studiedArabicBefore: z.boolean({ error: "Please choose yes or no" }),
  specialConsiderations: z
    .string()
    .trim()
    .max(
      SPECIAL_CONSIDERATIONS_MAX_LENGTH,
      `Please keep this under ${SPECIAL_CONSIDERATIONS_MAX_LENGTH} characters`,
    )
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

const acknowledgmentsSchema = z.object(
  Object.fromEntries(
    acknowledgments.map((item) => [
      item.id,
      z.literal(true, { error: "Please confirm this item to continue" }),
    ]),
  ) as Record<AcknowledgmentId, z.ZodLiteral<true>>,
);

export const registrationSchema = z
  .object({
    primaryGuardian: primaryGuardianSchema,
    secondaryGuardian: secondaryGuardianSchema.nullable(),
    emergencyContact: emergencyContactSchema,
    students: z
      .array(studentSchema)
      .min(1, "Please add at least one student")
      .max(MAX_STUDENTS_PER_REGISTRATION, `Please register at most ${MAX_STUDENTS_PER_REGISTRATION} students at a time`),
    acknowledgments: acknowledgmentsSchema,
  })
  .superRefine((value, ctx) => {
    const secondaryEmail = value.secondaryGuardian?.email;
    if (secondaryEmail && secondaryEmail === value.primaryGuardian.email) {
      ctx.addIssue({
        code: "custom",
        path: ["secondaryGuardian", "email"],
        message: "Each guardian needs their own email address. Leave this blank if you share one.",
      });
    }

    const seen = new Set<string>();
    value.students.forEach((student, index) => {
      const key = `${student.firstName.toLowerCase()}|${student.lastName.toLowerCase()}|${student.dateOfBirth}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["students", index, "firstName"],
          message: "This student has already been added above",
        });
      }
      seen.add(key);
    });
  });

export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

/** Body of POST /api/register. */
export const registrationRequestSchema = z.object({
  registration: registrationSchema,
  idempotencyKey: z.uuid(),
  /** Epoch milliseconds when the form was opened (simple bot check). */
  formStartedAt: z.number().int().positive(),
  /** Honeypot: hidden from people, so it must be empty. */
  website: z.string().max(500).optional(),
});

export type RegistrationRequest = z.input<typeof registrationRequestSchema>;

/** The response returned to the family after a successful submission. */
export const registrationResultSchema = z.object({
  schoolYear: z.string(),
  registrations: z.array(
    z.object({
      referenceCode: z.string(),
      studentFirstName: z.string(),
    }),
  ),
});

export type RegistrationResult = z.infer<typeof registrationResultSchema>;

/** Flattens zod issues into { "students.0.firstName": "message" } (first message wins). */
export function issuesToFieldErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
