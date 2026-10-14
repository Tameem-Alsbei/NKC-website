/**
 * Maps the stable error codes raised by submit_family_registration (and the
 * API route itself) to messages that are safe and helpful for families.
 * Raw database errors are never shown to the public.
 */
export const REGISTRATION_ERROR_MESSAGES = {
  registration_closed:
    "Registration is not open right now. Please check back later or contact the school.",
  invalid_payload:
    "Some of the information could not be accepted. Please review the form and try again.",
  duplicate_student_in_submission:
    "The same student appears more than once in this registration. Please remove the duplicate.",
  duplicate_registration:
    "One of these students is already registered for this school year. Please contact the school if you need to make changes.",
  rate_limited:
    "We've received several registrations from this connection in a short time. Please wait a few minutes and try again.",
  too_fast: "Please take a moment to review the form, then submit again.",
  unexpected:
    "Something went wrong on our side and your registration was not saved. Please try again in a few minutes.",
} as const;

export type RegistrationErrorCode = keyof typeof REGISTRATION_ERROR_MESSAGES;

const KNOWN_DATABASE_CODES = new Set<RegistrationErrorCode>([
  "registration_closed",
  "invalid_payload",
  "duplicate_student_in_submission",
  "duplicate_registration",
]);

export function registrationErrorFromDatabase(message: string | undefined | null): RegistrationErrorCode {
  const code = (message ?? "").trim() as RegistrationErrorCode;
  return KNOWN_DATABASE_CODES.has(code) ? code : "unexpected";
}

export function statusForRegistrationError(code: RegistrationErrorCode): number {
  switch (code) {
    case "registration_closed":
      return 403;
    case "duplicate_registration":
      return 409;
    case "rate_limited":
      return 429;
    case "unexpected":
      return 500;
    default:
      return 400;
  }
}
