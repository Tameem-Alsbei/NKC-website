import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { count, familyPayload, openNewSchoolYear, student, submitRegistration } from "./fixtures";
import { createMigratedDb } from "./harness";

let db: PGlite;

beforeEach(async () => {
  db = await createMigratedDb();
});

describe("submit_family_registration", () => {
  it("registers several children and both guardians in one family", async () => {
    const result = await submitRegistration(
      db,
      familyPayload({
        secondaryGuardian: {
          firstName: "Omar",
          lastName: "Haddad",
          email: null,
          phone: "614-555-0102",
          relationship: "father",
        },
        students: [
          student({ firstName: "Layla", specialConsiderations: "Peanut allergy; carries an EpiPen." }),
          student({ firstName: "Yusuf", dateOfBirth: "2019-09-01", grade: "1", studiedArabicBefore: true }),
        ],
      }),
    );

    expect(result.schoolYear).toBe("2026-2027");
    expect(result.registrations.map((r) => r.studentFirstName)).toEqual(["Layla", "Yusuf"]);
    for (const registration of result.registrations) {
      expect(registration.referenceCode).toMatch(/^NKC-[0-9A-F]{8}$/);
    }

    expect(await count(db, "public.households")).toBe(1);
    expect(await count(db, "public.parents")).toBe(2);
    expect(await count(db, "public.students")).toBe(2);
    expect(await count(db, "public.student_parents")).toBe(4);
    expect(await count(db, "public.student_parents", "is_primary_contact")).toBe(2);
    expect(await count(db, "public.registrations", "status = 'pending' and not needs_review")).toBe(2);
    expect(await count(db, "public.student_health_notes")).toBe(1);

    const acks = await db.query<{ acknowledgments: Record<string, unknown> }>("select acknowledgments from public.registrations limit 1");
    expect(acks.rows[0].acknowledgments).toEqual({ accuracy: true, contact: true, policies: true, _version: "test-v1" });

    const yusuf = await db.query<{ studied_arabic_before: boolean; grade: string }>(
      `select studied_arabic_before, grade from public.students where first_name = 'Yusuf'`,
    );
    expect(yusuf.rows[0]).toEqual({ studied_arabic_before: true, grade: "1" });

    const household = await db.query<{ emergency_contact_name: string }>(
      `select emergency_contact_name from public.households`,
    );
    expect(household.rows[0].emergency_contact_name).toBe("Samir Haddad");
  });

  it("normalizes names and emails before saving", async () => {
    await submitRegistration(
      db,
      familyPayload({
        primaryGuardian: {
          firstName: "  Mariam  ",
          lastName: "Haddad",
          email: "  Mariam.Haddad@Example.COM ",
          phone: "614 555 0101",
          relationship: "mother",
        },
        students: [student({ firstName: " Layla   Noor " })],
      }),
    );
    const parent = await db.query<{ first_name: string; email: string; phone_normalized: string }>(
      `select first_name, email, phone_normalized from public.parents`,
    );
    expect(parent.rows[0]).toEqual({
      first_name: "Mariam",
      email: "mariam.haddad@example.com",
      phone_normalized: "6145550101",
    });
    const child = await db.query<{ first_name: string }>(`select first_name from public.students`);
    expect(child.rows[0].first_name).toBe("Layla Noor");
  });

  it("is atomic: a failure on a later child leaves no partial records", async () => {
    const payload = familyPayload({
      students: [student({ firstName: "Layla" }), student({ firstName: "Yusuf", grade: "13" })],
    });

    await expect(submitRegistration(db, payload)).rejects.toThrow(/invalid_payload/);

    for (const table of [
      "public.households",
      "public.parents",
      "public.students",
      "public.student_parents",
      "public.registrations",
      "public.registration_submissions",
      "public.student_health_notes",
    ]) {
      expect(await count(db, table), table).toBe(0);
    }
  });

  it("rejects the same child twice in one submission without saving anything", async () => {
    const payload = familyPayload({ students: [student(), student({ firstName: "LAYLA" })] });
    await expect(submitRegistration(db, payload)).rejects.toThrow(/duplicate_student_in_submission/);
    expect(await count(db, "public.students")).toBe(0);
  });

  it("replays a retried submission instead of creating duplicates", async () => {
    const key = randomUUID();
    const first = await submitRegistration(db, familyPayload(), key);
    const second = await submitRegistration(db, familyPayload(), key);

    expect(second.replayed).toBe(true);
    expect(second.registrations).toEqual(first.registrations);
    expect(await count(db, "public.registrations")).toBe(1);
    expect(await count(db, "public.parents")).toBe(1);
  });

  it("reuses an existing parent (matched by email) when they register another child", async () => {
    await submitRegistration(db, familyPayload());
    await submitRegistration(
      db,
      familyPayload({
        primaryGuardian: {
          ...familyPayload().primaryGuardian,
          email: "MARIAM.HADDAD@example.com",
        },
        students: [student({ firstName: "Adam", dateOfBirth: "2020-01-05", grade: "K" })],
      }),
    );

    expect(await count(db, "public.parents")).toBe(1);
    expect(await count(db, "public.households")).toBe(1);
    expect(await count(db, "public.students")).toBe(2);
    expect(await count(db, "public.students", "household_id is not null")).toBe(2);
    expect(await count(db, "public.registrations", "needs_review")).toBe(0);
  });

  it("matches a returning student in a later school year", async () => {
    await submitRegistration(db, familyPayload());
    await openNewSchoolYear(db, "2027-2028");

    const result = await submitRegistration(
      db,
      familyPayload({
        students: [student({ grade: "4", isReturning: true, arabicLevel: "intermediate", studiedArabicBefore: true })],
      }),
    );

    expect(result.schoolYear).toBe("2027-2028");
    expect(await count(db, "public.students")).toBe(1);
    expect(await count(db, "public.registrations")).toBe(2);

    const latest = await db.query<{ is_returning: boolean; needs_review: boolean; grade: string }>(
      `select r.is_returning, r.needs_review, r.grade
       from public.registrations r join public.school_years y on y.id = r.school_year_id
       where y.label = '2027-2028'`,
    );
    expect(latest.rows[0]).toEqual({ is_returning: true, needs_review: false, grade: "4" });

    const profile = await db.query<{ grade: string; arabic_level: string }>(
      `select grade, arabic_level from public.students`,
    );
    expect(profile.rows[0]).toEqual({ grade: "4", arabic_level: "intermediate" });
  });

  it("refuses a second registration for the same child in the same year", async () => {
    await submitRegistration(db, familyPayload());
    await expect(submitRegistration(db, familyPayload())).rejects.toThrow(/duplicate_registration/);
    expect(await count(db, "public.registrations")).toBe(1);
    expect(await count(db, "public.registration_submissions")).toBe(1);
  });

  it("does not merge or overwrite when the email matches but the name does not", async () => {
    await submitRegistration(db, familyPayload());
    await openNewSchoolYear(db, "2027-2028");

    await submitRegistration(
      db,
      familyPayload({
        primaryGuardian: { ...familyPayload().primaryGuardian, firstName: "Someone", lastName: "Else" },
        students: [student({ isReturning: true })],
      }),
    );

    const parent = await db.query<{ first_name: string; last_name: string }>(
      `select first_name, last_name from public.parents`,
    );
    expect(parent.rows).toEqual([{ first_name: "Mariam", last_name: "Haddad" }]);

    // The child is NOT silently attached to the existing student record.
    expect(await count(db, "public.students")).toBe(2);

    const flagged = await db.query<{ review_reasons: string[] }>(
      `select review_reasons from public.registrations where needs_review`,
    );
    expect(flagged.rows).toHaveLength(1);
    expect(flagged.rows[0].review_reasons).toEqual(
      expect.arrayContaining(["guardian_details_differ", "returning_student_not_matched", "possible_duplicate_student"]),
    );

    const submitted = await db.query<{ submitted_contact: { primaryGuardian: { firstName: string } } }>(
      `select submitted_contact from public.registration_submissions order by id desc limit 1`,
    );
    expect(submitted.rows[0].submitted_contact.primaryGuardian.firstName).toBe("Someone");
  });

  it("flags a 'returning' student it cannot match", async () => {
    await submitRegistration(db, familyPayload({ students: [student({ isReturning: true })] }));
    const flagged = await db.query<{ review_reasons: string[] }>(`select review_reasons from public.registrations`);
    expect(flagged.rows[0].review_reasons).toEqual(["returning_student_not_matched"]);
  });

  it("never stores health notes in the submission snapshot", async () => {
    await submitRegistration(
      db,
      familyPayload({ students: [student({ specialConsiderations: "Asthma inhaler in backpack" })] }),
    );
    const snapshot = await db.query<{ text: string }>(
      `select (submitted_contact::text || result::text) as text from public.registration_submissions`,
    );
    expect(snapshot.rows[0].text).not.toContain("Asthma");
  });

  it("refuses submissions when no school year is open", async () => {
    await db.exec(`update public.school_years set registration_open = false`);
    await expect(submitRegistration(db, familyPayload())).rejects.toThrow(/registration_closed/);
  });

  it("validates the payload inside the database as a last line of defence", async () => {
    const cases = [
      familyPayload({ students: [] }),
      familyPayload({ primaryGuardian: { ...familyPayload().primaryGuardian, email: "not-an-email" } }),
      familyPayload({ acknowledgments: { accuracy: true, contact: false, policies: true } }),
      familyPayload({ students: [student({ dateOfBirth: "2099-01-01" })] }),
      familyPayload({ students: [student({ arabicLevel: "fluent" })] }),
    ];
    for (const payload of cases) {
      await expect(submitRegistration(db, payload)).rejects.toThrow(/invalid_payload/);
    }
    expect(await count(db, "public.students")).toBe(0);
  });

  it("enforces one account per email address at the database level", async () => {
    await submitRegistration(db, familyPayload());
    await expect(
      db.query(`insert into public.parents (first_name, last_name, email) values ('X', 'Y', ' Mariam.Haddad@example.com')`),
    ).rejects.toThrow(/parents_email_normalized_key/);
  });
});

describe("consume_registration_rate_limit", () => {
  it("allows requests up to the limit within a window", async () => {
    const key = "a".repeat(64);
    const results: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      const r = await db.query<{ ok: boolean }>(
        "select public.consume_registration_rate_limit($1, 3, 600) as ok",
        [key],
      );
      results.push(r.rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
