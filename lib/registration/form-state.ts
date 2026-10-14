import { acknowledgments, type AcknowledgmentId } from "@/lib/config/school";
import type { ArabicLevel, Grade, Relationship } from "./options";
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
  grade: Grade | "";
  isReturning: YesNo;
  arabicLevel: ArabicLevel | "";
  studiedArabicBefore: YesNo;
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
  grade: "",
  isReturning: "",
  arabicLevel: "",
  studiedArabicBefore: "",
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
      grade: blankToUndefined(student.grade) as Grade,
      isReturning: yesNoToBoolean(student.isReturning) as boolean,
      arabicLevel: blankToUndefined(student.arabicLevel) as ArabicLevel,
      studiedArabicBefore: yesNoToBoolean(student.studiedArabicBefore) as boolean,
      specialConsiderations: student.specialConsiderations,
    })),
    acknowledgments: state.acknowledgments as RegistrationInput["acknowledgments"],
  };
}

export const REGISTRATION_STEPS = [
  { id: "family", title: "Family", description: "Parent or guardian contact details" },
  { id: "students", title: "Students", description: "Who you are registering" },
  { id: "arabic", title: "Arabic background", description: "Each student's experience with Arabic" },
  { id: "care", title: "Care & emergency", description: "Special considerations and emergency contact" },
  { id: "enrollment", title: "Enrollment", description: "Grade and returning status" },
  { id: "consent", title: "Acknowledgments", description: "Please review and confirm" },
  { id: "review", title: "Review", description: "Check everything before submitting" },
] as const;

export type RegistrationStepId = (typeof REGISTRATION_STEPS)[number]["id"];

const STUDENT_FIELDS_BY_STEP: Partial<Record<RegistrationStepId, readonly string[]>> = {
  students: ["firstName", "lastName", "dateOfBirth"],
  arabic: ["arabicLevel", "studiedArabicBefore"],
  care: ["specialConsiderations"],
  enrollment: ["grade", "isReturning"],
};

/** Whether a field path (e.g. "students.1.grade") belongs to the given step. */
export function fieldBelongsToStep(path: string, step: RegistrationStepId): boolean {
  const [root, index, field] = path.split(".");
  switch (step) {
    case "family":
      return root === "primaryGuardian" || root === "secondaryGuardian";
    case "care":
      return (
        root === "emergencyContact" ||
        (root === "students" && index !== undefined && STUDENT_FIELDS_BY_STEP.care!.includes(field))
      );
    case "students":
      return (
        root === "students" &&
        (index === undefined || STUDENT_FIELDS_BY_STEP.students!.includes(field))
      );
    case "arabic":
    case "enrollment":
      return root === "students" && index !== undefined && STUDENT_FIELDS_BY_STEP[step]!.includes(field);
    case "consent":
      return root === "acknowledgments";
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
