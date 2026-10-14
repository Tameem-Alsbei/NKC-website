import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { count, familyPayload, student, submitRegistration } from "./fixtures";
import {
  applyMigrations,
  asRole,
  createAdmin,
  createAuthUser,
  createMigratedDb,
  createSupabaseLikeDb,
  migrationFiles,
} from "./harness";

const PRIVATE_TABLES = [
  "students",
  "parents",
  "households",
  "student_parents",
  "student_health_notes",
  "registrations",
  "registration_submissions",
  "payments",
  "groups",
  "student_group_assignments",
  "admin_notes",
  "admin_profiles",
  "audit_logs",
  "school_years",
  "registration_rate_limits",
  "admin_registration_list",
  "admin_family_list",
  "admin_group_overview",
];

let db: PGlite;
let adminId: string;
let staffId: string;

beforeEach(async () => {
  db = await createMigratedDb();
  adminId = await createAdmin(db, "director@example.com", "admin");
  staffId = await createAdmin(db, "office@example.com", "staff");
  await submitRegistration(
    db,
    familyPayload({ students: [student({ specialConsiderations: "Uses an inhaler before exercise." })] }),
  );
});

async function registrationId(): Promise<number> {
  const r = await db.query<{ id: number }>("select id from public.registrations limit 1");
  return r.rows[0].id;
}

describe("public (anon) access", () => {
  it("cannot read any private table or admin view", async () => {
    for (const table of PRIVATE_TABLES) {
      await expect(
        asRole(db, "anon", () => db.query(`select * from public.${table} limit 1`)),
        table,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("cannot write records directly", async () => {
    await expect(
      asRole(db, "anon", () =>
        db.query(
          `insert into public.students (first_name, last_name, date_of_birth, grade) values ('Bot', 'Test', '2016-01-01', '4')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot call the registration RPC or rate limiter directly", async () => {
    await expect(
      asRole(db, "anon", () =>
        db.query("select public.submit_family_registration('{}'::jsonb, gen_random_uuid())"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db, "anon", () => db.query("select public.consume_registration_rate_limit('x', 1, 1)")),
    ).rejects.toThrow(/permission denied/);
  });

  it("can only learn which school year is open", async () => {
    const result = await asRole(db, "anon", () =>
      db.query<{ y: { label: string } }>("select public.get_open_school_year() as y"),
    );
    expect(result.rows[0].y).toEqual({ label: "2026-2027" });
  });
});

describe("signed-in users without an admin profile", () => {
  it("see no records and cannot change anything", async () => {
    const userId = await createAuthUser(db, "parent@example.com");

    await asRole(
      db,
      "authenticated",
      async () => {
        for (const table of ["students", "parents", "registrations", "student_health_notes", "admin_registration_list"]) {
          const r = await db.query(`select * from public.${table}`);
          expect(r.rows, table).toHaveLength(0);
        }
        const updated = await db.query(`update public.registrations set status = 'confirmed' returning id`);
        expect(updated.rows).toHaveLength(0);
        await expect(
          db.query(`insert into public.admin_profiles (user_id, full_name, role) values ($1, 'Me', 'admin')`, [userId]),
        ).rejects.toThrow(/permission denied/);
        await expect(db.query("select public.admin_dashboard_stats(1)")).rejects.toThrow(/forbidden/);
      },
      userId,
    );
  });

  it("lose access when their admin profile is deactivated", async () => {
    await db.query("update public.admin_profiles set is_active = false where user_id = $1", [staffId]);
    const rows = await asRole(db, "authenticated", () => db.query("select * from public.students"), staffId);
    expect(rows.rows).toHaveLength(0);
  });
});

describe("staff administrators", () => {
  it("can manage registrations but cannot read health notes", async () => {
    await asRole(
      db,
      "authenticated",
      async () => {
        expect((await db.query("select * from public.admin_registration_list")).rows).toHaveLength(1);
        expect((await db.query("select * from public.students")).rows).toHaveLength(1);
        expect((await db.query("select * from public.student_health_notes")).rows).toHaveLength(0);

        const updated = await db.query(
          `update public.registrations set status = 'confirmed' returning status, status_changed_by`,
        );
        expect(updated.rows).toEqual([{ status: "confirmed", status_changed_by: staffId }]);
      },
      staffId,
    );
  });

  it("cannot delete students or registrations", async () => {
    await asRole(
      db,
      "authenticated",
      async () => {
        const deleted = await db.query("delete from public.registrations returning id");
        expect(deleted.rows).toHaveLength(0);
      },
      staffId,
    );
    expect(await count(db, "public.registrations")).toBe(1);
  });
});

describe("full administrators", () => {
  it("can read and update health notes, which are audited without their contents", async () => {
    await asRole(
      db,
      "authenticated",
      async () => {
        const notes = await db.query<{ special_considerations: string }>(
          "select special_considerations from public.student_health_notes",
        );
        expect(notes.rows[0].special_considerations).toContain("inhaler");
        await db.query("update public.student_health_notes set special_considerations = 'Updated note'");
      },
      adminId,
    );

    const audit = await db.query<{ actor_id: string; old_values: unknown; new_values: unknown; changed_fields: string[] }>(
      "select actor_id, old_values, new_values, changed_fields from public.audit_logs where table_name = 'student_health_notes'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ actor_id: adminId, old_values: null, new_values: null });
    expect(audit.rows[0].changed_fields).toContain("special_considerations");
  });
});

describe("audit log", () => {
  it("records who changed a registration and what changed", async () => {
    const id = await registrationId();
    await asRole(
      db,
      "authenticated",
      () => db.query("update public.registrations set status = 'under_review' where id = $1", [id]),
      staffId,
    );

    const audit = await db.query<{ actor_id: string; changed_fields: string[]; old_values: object; new_values: object }>(
      "select actor_id, changed_fields, old_values, new_values from public.audit_logs where table_name = 'registrations'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor_id).toBe(staffId);
    expect(audit.rows[0].changed_fields).toEqual(
      expect.arrayContaining(["status", "status_changed_at", "status_changed_by"]),
    );
    expect(audit.rows[0].old_values).toMatchObject({ status: "pending" });
    expect(audit.rows[0].new_values).toMatchObject({ status: "under_review" });
  });

  it("does not record public registrations made by the server", async () => {
    expect(await count(db, "public.audit_logs")).toBe(0);
  });

  it("cannot be written or altered by administrators", async () => {
    await asRole(
      db,
      "authenticated",
      async () => {
        await expect(
          db.query("insert into public.audit_logs (action, table_name, record_id) values ('update', 'x', '1')"),
        ).rejects.toThrow(/permission denied/);
      },
      adminId,
    );
  });
});

describe("payments", () => {
  it("derives payment status from the ledger and amount due", async () => {
    const id = await registrationId();
    const status = async () =>
      (await db.query<{ payment_status: string }>("select payment_status from public.registrations where id = $1", [id]))
        .rows[0].payment_status;

    await asRole(
      db,
      "authenticated",
      async () => {
        await db.query("update public.registrations set amount_due = 300 where id = $1", [id]);
        expect(await status()).toBe("not_paid");
        await db.query("insert into public.payments (registration_id, amount, payment_method) values ($1, 100, 'cash')", [id]);
        expect(await status()).toBe("partially_paid");
        await db.query("insert into public.payments (registration_id, amount, payment_method) values ($1, 200, 'check')", [id]);
        expect(await status()).toBe("paid");

        // Staff can record but not delete payments.
        const deleted = await db.query("delete from public.payments returning id");
        expect(deleted.rows).toHaveLength(0);
      },
      staffId,
    );

    const recordedBy = await db.query<{ recorded_by: string }>("select distinct recorded_by from public.payments");
    expect(recordedBy.rows).toEqual([{ recorded_by: staffId }]);
  });

  it("keeps a waived status regardless of payments", async () => {
    const id = await registrationId();
    await asRole(
      db,
      "authenticated",
      async () => {
        await db.query("update public.registrations set payment_status = 'waived', amount_due = 300 where id = $1", [id]);
        await db.query("insert into public.payments (registration_id, amount) values ($1, 50)", [id]);
      },
      adminId,
    );
    const r = await db.query<{ payment_status: string }>("select payment_status from public.registrations");
    expect(r.rows[0].payment_status).toBe("waived");
  });
});

describe("groups", () => {
  async function createGroup(capacity: number, yearLabel = "2026-2027"): Promise<number> {
    const r = await db.query<{ id: number }>(
      `insert into public.groups (school_year_id, name, capacity)
       select id, 'Group ' || floor(random() * 100000)::text, $1 from public.school_years where label = $2
       returning id`,
      [capacity, yearLabel],
    );
    return r.rows[0].id;
  }

  it("enforces capacity and frees the seat when a student withdraws", async () => {
    await submitRegistration(db, familyPayload({ students: [student({ firstName: "Yusuf", dateOfBirth: "2018-02-02" })] }));
    const ids = (await db.query<{ id: number }>("select id from public.registrations order by id")).rows.map((r) => r.id);
    const groupId = await createGroup(1);

    await asRole(
      db,
      "authenticated",
      async () => {
        await db.query("insert into public.student_group_assignments (registration_id, group_id) values ($1, $2)", [ids[0], groupId]);
        await expect(
          db.query("insert into public.student_group_assignments (registration_id, group_id) values ($1, $2)", [ids[1], groupId]),
        ).rejects.toThrow(/group_full/);

        await db.query("update public.registrations set status = 'withdrawn' where id = $1", [ids[0]]);
        await db.query("insert into public.student_group_assignments (registration_id, group_id) values ($1, $2)", [ids[1], groupId]);
      },
      staffId,
    );

    const assigned = await db.query<{ registration_id: number; assigned_by: string }>(
      "select registration_id, assigned_by from public.student_group_assignments",
    );
    expect(assigned.rows).toEqual([{ registration_id: ids[1], assigned_by: staffId }]);
  });

  it("only allows groups from the registration's school year", async () => {
    await db.query("insert into public.school_years (label) values ('2027-2028')");
    const otherYearGroup = await createGroup(10, "2027-2028");
    const id = await registrationId();
    await expect(
      asRole(
        db,
        "authenticated",
        () => db.query("insert into public.student_group_assignments (registration_id, group_id) values ($1, $2)", [id, otherYearGroup]),
        staffId,
      ),
    ).rejects.toThrow(/group_year_mismatch/);
  });
});

describe("dashboard stats", () => {
  it("summarizes the selected school year for administrators", async () => {
    const yearId = (await db.query<{ id: number }>("select id from public.school_years where is_current")).rows[0].id;
    const stats = await asRole(
      db,
      "authenticated",
      () => db.query<{ s: Record<string, unknown> }>("select public.admin_dashboard_stats($1) as s", [yearId]),
      staffId,
    );
    expect(stats.rows[0].s).toMatchObject({
      totalRegistrations: 1,
      newStudents: 1,
      unassigned: 1,
      byStatus: { pending: 1 },
      byPaymentStatus: { not_paid: 1 },
    });
  });
});

describe("migrating the existing schema", () => {
  it("drops pre-existing permissive policies so the public cannot read data", async () => {
    const legacy = await createSupabaseLikeDb();
    const files = migrationFiles();
    await applyMigrations(legacy, files.slice(0, 1));
    await legacy.exec(`
      alter table public.students enable row level security;
      create policy "temporary test access" on public.students for all to anon using (true) with check (true);
      insert into public.students (first_name, last_name, date_of_birth, grade) values ('Test', 'Student', '2016-05-20', '4');
    `);
    expect((await asRole(legacy, "anon", () => legacy.query("select * from public.students"))).rows).toHaveLength(1);

    await applyMigrations(legacy, files.slice(1));

    await expect(asRole(legacy, "anon", () => legacy.query("select * from public.students"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("preserves and backfills existing rows", async () => {
    const legacy = await createSupabaseLikeDb();
    const files = migrationFiles();
    await applyMigrations(legacy, files.slice(0, 1));
    await legacy.exec(`
      insert into public.students (id, first_name, last_name, date_of_birth, grade, arabic_level, health_information, special_considerations)
        values (1, 'Sara', 'Ali', '2016-05-20', '4', 'beginner', 'Nut allergy', 'Needs extra time');
      insert into public.parents (id, first_name, last_name, email, phone) values (1, 'Huda', 'Ali', 'Huda@Example.com', '555-0100');
      insert into public.student_parents (student_id, parent_id, relationship) values (1, 1, 'parent');
      insert into public.registrations (id, student_id, school_year, status, is_returning) values (1, 1, '2025-2026', 'pending', true);
    `);

    await applyMigrations(legacy, files.slice(1));

    const row = await legacy.query<Record<string, unknown>>(`
      select r.grade, r.reference_code, y.label, s.household_id is not null as has_household,
             p.household_id = s.household_id as same_household, p.email_normalized,
             sp.is_primary_contact, h.special_considerations
      from public.registrations r
      join public.school_years y on y.id = r.school_year_id
      join public.students s on s.id = r.student_id
      join public.student_parents sp on sp.student_id = s.id
      join public.parents p on p.id = sp.parent_id
      left join public.student_health_notes h on h.student_id = s.id
    `);
    expect(row.rows[0]).toMatchObject({
      grade: "4",
      label: "2025-2026",
      has_household: true,
      same_household: true,
      email_normalized: "huda@example.com",
      is_primary_contact: true,
      special_considerations: "Nut allergy\nNeeds extra time",
    });
    expect(row.rows[0].reference_code).toMatch(/^NKC-[0-9A-F]{8}$/);

    const columns = await legacy.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'students'`,
    );
    expect(columns.rows.map((c) => c.column_name)).not.toContain("health_information");

    const current = await legacy.query<{ label: string }>("select label from public.school_years where is_current");
    expect(current.rows).toEqual([{ label: "2026-2027" }]);
  });
});
