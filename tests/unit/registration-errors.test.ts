import { describe, expect, it } from "vitest";
import {
  REGISTRATION_ERROR_MESSAGES,
  registrationErrorFromDatabase,
  statusForRegistrationError,
} from "@/lib/registration/errors";

describe("registrationErrorFromDatabase", () => {
  it("maps known RPC error codes", () => {
    expect(registrationErrorFromDatabase("duplicate_registration")).toBe("duplicate_registration");
    expect(statusForRegistrationError("duplicate_registration")).toBe(409);
    expect(registrationErrorFromDatabase("registration_closed")).toBe("registration_closed");
  });

  it("hides raw database errors behind a generic message", () => {
    const code = registrationErrorFromDatabase('duplicate key value violates unique constraint "parents_pkey"');
    expect(code).toBe("unexpected");
    expect(REGISTRATION_ERROR_MESSAGES[code]).not.toMatch(/constraint|parents|key/i);
    expect(statusForRegistrationError(code)).toBe(500);
  });
});
