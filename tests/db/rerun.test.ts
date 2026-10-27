import { describe, expect, it } from "vitest";
import { count, familyPayload, submitRegistration } from "./fixtures";
import { applyMigrations, asRole, createMigratedDb } from "./harness";

describe("re-running migrations", () => {
  it("is safe when every migration is applied a second time", async () => {
    const db = await createMigratedDb();
    await submitRegistration(db, familyPayload());

    await applyMigrations(db);

    expect(await count(db, "public.registrations")).toBe(1);
    expect(await count(db, "public.school_years", "is_current and registration_open")).toBe(1);
    await expect(asRole(db, "anon", () => db.query("select * from public.students"))).rejects.toThrow(/permission denied/);
    await submitRegistration(db, familyPayload({ primaryGuardian: { ...familyPayload().primaryGuardian, email: "second@example.com" } }));
    expect(await count(db, "public.registrations")).toBe(2);
  });
});
