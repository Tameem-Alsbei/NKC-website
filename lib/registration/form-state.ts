import { acknowledgments, type AcknowledgmentId } from "@/lib/config/program";
import type { Gender, Grade, QuranAbility, Relationship } from "./options";
import { issuesToFieldErrors, registrationSchema, type RegistrationInput } from "./schema";

/**
 * Shape of the registration form while a parent is filling it in. Inputs hold
 * strings ("" until answered); `toRegistrationInput` converts them into the
 * shape validated by `registrationSchema` and sent to the API.
 */

export type YesNo = "" | "yes" | "no";

export type GuardianFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: Relationship | "";
};

export type StudentFormState = {
  /** Stable client-side key for React lists; never sent to the server. */
  key: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | "";
  grade: Grade | "";
  isReturning: YesNo;
  studiedArabicBefore: YesNo;
  quranAbility: QuranAbility | "";
  quranNotes: string;
  specialConsiderations: string;
};

export type RegistrationFormState = {
  primaryGuardian: GuardianFormState;
  hasSecondaryGuardian: boolean;
  secondaryGuardian: GuardianFormState;
  emergencyContact: { name: string; phone: string; relationship: string };
  students: StudentFormState[];
  acknowledgments: Record<AcknowledgmentId, boolean>;
};

export const emptyGuardian = (): GuardianFormState => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  relationship: "",
});

export const emptyStudent = (key: string, lastName = ""): StudentFormState => ({
  key,
  firstName: "",
  lastName,
  dateOfBirth: "",
  gender: "",
  grade: "",
  isReturning: "",
  studiedArabicBefore: "",
  quranAbility: "",
  quranNotes: "",
  specialConsiderations: "",
});

export function initialFormState(firstStudentKey: string): RegistrationFormState {
  return {
    primaryGuardian: emptyGuardian(),
    hasSecondaryGuardian: false,
    secondaryGuardian: emptyGuardian(),
    emergencyContact: { name: "", phone: "", relationship: "" },
    students: [emptyStudent(firstStudentKey)],
    acknowledgments: Object.fromEntries(acknowledgments.map((item) => [item.id, false])) as Record<
      AcknowledgmentId,
      boolean
    >,
  };
}

const yesNoToBoolean = (value: YesNo): boolean | undefined =>
  value === "yes" ? true : value === "no" ? false : undefined;

const blankToUndefined = <T extends string>(value: T | ""): T | undefined =>
  value === "" ? undefined : value;

const blankToNull = (value: string): string | null => (value.trim() === "" ? null : value);

export function toRegistrationInput(state: RegistrationFormState): RegistrationInput {
  const secondary = state.secondaryGuardian;
  return {
    primaryGuardian: {
      ...state.primaryGuardian,
      relationship: blankToUndefined(state.primaryGuardian.relationship) as Relationship,
    },
    secondaryGuardian: state.hasSecondaryGuardian
      ? {
          firstName: secondary.firstName,
          lastName: secondary.lastName,
          email: blankToNull(secondary.email),
          phone: blankToNull(secondary.phone),
          relationship: blankToUndefined(secondary.relationship) as Relationship,
        }
      : null,
    emergencyContact: {
      name: state.emergencyContact.name,
      phone: state.emergencyContact.phone,
      relationship: blankToNull(state.emergencyContact.relationship),
    },
    students: state.students.map((student) => ({
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth,
      gender: blankToUndefined(student.gender) as Gender,
      grade: blankToUndefined(student.grade) as Grade,
      isReturning: yesNoToBoolean(student.isReturning) as boolean,
      studiedArabicBefore: yesNoToBoolean(student.studiedArabicBefore) as boolean,
      quranAbility: blankToUndefined(student.quranAbility) as QuranAbility,
      quranNotes: student.quranNotes,
      specialConsiderations: student.specialConsiderations,
    })),
    acknowledgments: state.acknowledgments as RegistrationInput["acknowledgments"],
  };
}

export const REGISTRATION_STEPS = [
  { id: "family", title: "Family", description: "Contact details for the parents or guardians." },
  { id: "children", title: "Children", description: "Tell us about each child you're registering." },
  {
    id: "background",
    title: "Learning Background",
    description: "Your child's experience with Arabic and the Quran helps us place them. The program decides final Quran levels and teachers.",
  },
  { id: "additional", title: "Additional Information", description: "Care needs, an emergency contact and a few confirmations." },
  { id: "review", title: "Review", description: "Please check everything before you submit." },
] as const;

export type RegistrationStepId = (typeof REGISTRATION_STEPS)[number]["id"];

const STUDENT_FIELDS_BY_STEP: Record<"children" | "background" | "additional", readonly string[]> = {
  children: ["firstName", "lastName", "dateOfBirth", "gender", "grade", "isReturning"],
  background: ["studiedArabicBefore", "quranAbility", "quranNotes"],
  additional: ["specialConsiderations"],
};

/** Whether a field path (e.g. "students.1.grade") belongs to the given step. */
export function fieldBelongsToStep(path: string, step: RegistrationStepId): boolean {
  const [root, index, field] = path.split(".");
  switch (step) {
    case "family":
      return root === "primaryGuardian" || root === "secondaryGuardian";
    case "children":
      return root === "students" && (index === undefined || STUDENT_FIELDS_BY_STEP.children.includes(field));
    case "background":
      return root === "students" && index !== undefined && STUDENT_FIELDS_BY_STEP.background.includes(field);
    case "additional":
      return (
        root === "emergencyContact" ||
        root === "acknowledgments" ||
        (root === "students" && index !== undefined && STUDENT_FIELDS_BY_STEP.additional.includes(field))
      );
    case "review":
      return true;
  }
}

/** Validates the whole form and returns only the errors for one step. */
export function validateStep(
  state: RegistrationFormState,
  step: RegistrationStepId,
): Record<string, string> {
  const result = registrationSchema.safeParse(toRegistrationInput(state));
  if (result.success) return {};
  const all = issuesToFieldErrors(result.error.issues);
  return Object.fromEntries(Object.entries(all).filter(([path]) => fieldBelongsToStep(path, step)));
}
