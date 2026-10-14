import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { asRole } from "./harness";

type StudentPayload = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  grade: string;
  isReturning: boolean;
  arabicLevel: string;
  studiedArabicBefore: boolean;
  specialConsiderations: string | null;
};

export type RegistrationPayload = {
  primaryGuardian: { firstName: string; lastName: string; email: string; phone: string; relationship: string };
  secondaryGuardian: null | {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    relationship: string;
  };
  emergencyContact: { name: string; phone: string; relationship: string | null };
  students: StudentPayload[];
  acknowledgments: Record<string, boolean>;
  consentVersion?: string;
};

export function student(overrides: Partial<StudentPayload> = {}): StudentPayload {
  return {
    firstName: "Layla",
    lastName: "Haddad",
    dateOfBirth: "2017-04-12",
    grade: "3",
    isReturning: false,
    arabicLevel: "beginner",
    studiedArabicBefore: false,
    specialConsiderations: null,
    ...overrides,
  };
}

export function familyPayload(overrides: Partial<RegistrationPayload> = {}): RegistrationPayload {
  return {
    primaryGuardian: {
      firstName: "Mariam",
      lastName: "Haddad",
      email: "mariam.haddad@example.com",
      phone: "(614) 555-0101",
      relationship: "mother",
    },
    secondaryGuardian: null,
    emergencyContact: { name: "Samir Haddad", phone: "614-555-0199", relationship: "Uncle" },
    students: [student()],
    acknowledgments: { accuracy: true, contact: true, policies: true },
    consentVersion: "test-v1",
    ...overrides,
  };
}

export type SubmitResult = {
  schoolYear: string;
  registrations: { referenceCode: string; studentFirstName: string }[];
  replayed?: boolean;
};

/** Calls the RPC the way the API route does: as service_role. */
export async function submitRegistration(
  db: PGlite,
  payload: RegistrationPayload,
  idempotencyKey: string = randomUUID(),
): Promise<SubmitResult> {
  return asRole(db, "service_role", async () => {
    const result = await db.query<{ result: SubmitResult }>(
      "select public.submit_family_registration($1::jsonb, $2::uuid) as result",
      [JSON.stringify(payload), idempotencyKey],
    );
    return result.rows[0].result;
  });
}

export async function count(db: PGlite, table: string, where = "true"): Promise<number> {
  const result = await db.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`);
  return result.rows[0].n;
}

export async function openNewSchoolYear(db: PGlite, label: string): Promise<number> {
  await db.exec(`update public.school_years set is_current = false, registration_open = false`);
  const result = await db.query<{ id: number }>(
    `insert into public.school_years (label, is_current, registration_open) values ($1, true, true) returning id`,
    [label],
  );
  return result.rows[0].id;
}
