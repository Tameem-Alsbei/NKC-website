import { describe, expect, it } from "vitest";
import {
  emptyStudent,
  initialFormState,
  toRegistrationInput,
  validateStep,
  type RegistrationFormState,
} from "@/lib/registration/form-state";
import { registrationRequestSchema, registrationSchema } from "@/lib/registration/schema";

function completeForm(): RegistrationFormState {
  const state = initialFormState("s1");
  state.primaryGuardian = {
    firstName: "Mariam",
    lastName: "Haddad",
    email: " Mariam.Haddad@Example.com ",
    phone: "(614) 555-0101",
    relationship: "mother",
  };
  state.emergencyContact = { name: "Samir Haddad", phone: "614-555-0199", relationship: "Uncle" };
  state.students = [
    {
      ...emptyStudent("s1"),
      firstName: "Layla",
      lastName: "Haddad",
      dateOfBirth: "2017-04-12",
      grade: "3",
      isReturning: "no",
      arabicLevel: "beginner",
      studiedArabicBefore: "yes",
      specialConsiderations: "",
    },
  ];
  state.acknowledgments = { accuracy: true, contact: true, policies: true };
  return state;
}

describe("registration schema", () => {
  it("accepts a complete registration and normalizes it", () => {
    const parsed = registrationSchema.parse(toRegistrationInput(completeForm()));
    expect(parsed.primaryGuardian.email).toBe("mariam.haddad@example.com");
    expect(parsed.students[0]).toMatchObject({
      studiedArabicBefore: true,
      isReturning: false,
      specialConsiderations: null,
    });
    expect(parsed.secondaryGuardian).toBeNull();
  });

  it("supports multiple children and rejects duplicates", () => {
    const state = completeForm();
    state.students.push({ ...state.students[0], key: "s2", firstName: "Yusuf", dateOfBirth: "2019-01-02" });
    expect(registrationSchema.safeParse(toRegistrationInput(state)).success).toBe(true);

    state.students.push({ ...state.students[0], key: "s3" });
    const result = registrationSchema.safeParse(toRegistrationInput(state));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["students", 2, "firstName"] });
  });

  it("requires every acknowledgment", () => {
    const state = completeForm();
    state.acknowledgments.policies = false;
    expect(validateStep(state, "consent")).toHaveProperty("acknowledgments.policies");
  });

  it("rejects invalid contact details and impossible dates", () => {
    const state = completeForm();
    state.primaryGuardian.email = "not-an-email";
    state.primaryGuardian.phone = "12";
    state.students[0].dateOfBirth = "2099-01-01";
    const family = validateStep(state, "family");
    expect(Object.keys(family).sort()).toEqual(["primaryGuardian.email", "primaryGuardian.phone"]);
    expect(validateStep(state, "students")).toHaveProperty("students.0.dateOfBirth");
  });

  it("requires a yes/no answer for studied Arabic before", () => {
    const state = completeForm();
    state.students[0].studiedArabicBefore = "";
    expect(validateStep(state, "arabic")).toEqual({ "students.0.studiedArabicBefore": "Please choose yes or no" });
  });

  it("only reports errors that belong to the current step", () => {
    const state = initialFormState("s1");
    const errors = validateStep(state, "family");
    expect(Object.keys(errors).every((key) => key.startsWith("primaryGuardian."))).toBe(true);
    expect(validateStep(completeForm(), "enrollment")).toEqual({});
  });

  it("validates an optional second guardian only when added", () => {
    const state = completeForm();
    state.hasSecondaryGuardian = true;
    expect(validateStep(state, "family")).toHaveProperty("secondaryGuardian.firstName");

    state.secondaryGuardian = {
      firstName: "Omar",
      lastName: "Haddad",
      email: "MARIAM.haddad@example.com",
      phone: "",
      relationship: "father",
    };
    const parsed = registrationSchema.safeParse(toRegistrationInput(state));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((i) => i.path.join(".") === "secondaryGuardian.email")).toBe(true);

    state.secondaryGuardian.email = "";
    expect(registrationSchema.parse(toRegistrationInput(state)).secondaryGuardian).toMatchObject({
      email: null,
      phone: null,
    });
  });

  it("limits the length of special considerations", () => {
    const state = completeForm();
    state.students[0].specialConsiderations = "x".repeat(1001);
    expect(validateStep(state, "care")).toHaveProperty("students.0.specialConsiderations");
  });

  it("rejects unexpected types sent directly to the API", () => {
    const result = registrationRequestSchema.safeParse({
      registration: { ...toRegistrationInput(completeForm()), students: "Layla" },
      idempotencyKey: "not-a-uuid",
      formStartedAt: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});
