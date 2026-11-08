import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { count, familyPayload, student, submitRegistration } from "./fixtures";
import { asRole, createAdmin, createMigratedDb } from "./harness";

let db: PGlite;
let adminId: string;
let staffId: string;
let yearId: number;
let studentId: number;
let registrationId: number;

async function createTeacher(name: string, levels: number[], active = true): Promise<number> {
  const teacher = await db.query<{ id: number }>(
    "insert into public.teachers (full_name, is_active) values ($1, $2) returning id",
    [name, active],
  );
  for (const level of levels) {
    await db.query("insert into public.teacher_quran_levels (teacher_id, quran_level_id) values ($1, $2)", [
      teacher.rows[0].id,
      level,
    ]);
  }
  return teacher.rows[0].id;
}

/** Calls admin_set_quran_assignment as the staff user. */
function setQuran(level: number | null, teacherId: number | null, user = staffId) {
  return asRole(
    db,
    "authenticated",
    () =>
      db.query<{ id: number | null }>("select public.admin_set_quran_assignment($1, $2, $3::smallint, $4, null) as id", [
        studentId,
        yearId,
        level,
        teacherId,
      ]),
    user,
  );
}

beforeEach(async () => {
  db = await createMigratedDb();
  adminId = await createAdmin(db, "director@example.com", "admin");
  staffId = await createAdmin(db, "office@example.com", "staff");
  await submitRegistration(db, familyPayload());
  const row = await db.query<{ student_id: number; school_year_id: number; id: number }>(
    "select id, student_id, school_year_id from public.registrations limit 1",
  );
  ({ student_id: studentId, school_year_id: yearId, id: registrationId } = row.rows[0]);
});

describe("seed data", () => {
  it("creates the four Quran levels with their exact names and order", async () => {
    const levels = await db.query<{ id: number; name: string }>("select id, name from public.quran_levels order by sort_order");
    expect(levels.rows).toEqual([
      { id: 4, name: "Hifz" },
      { id: 3, name: "Tajweed" },
      { id: 2, name: "Tilawah" },
      { id: 1, name: "Nooraniah" },
    ]);
  });

  it("creates the five color groups with stored colors and no criteria", async () => {
    const groups = await db.query<{ name: string; color_hex: string; min_age: number | null; gender: string }>(
      "select name, color_hex, min_age, gender from public.color_groups order by sort_order",
    );
    expect(groups.rows.map((g) => g.name)).toEqual(["Red", "Green", "Orange", "Blue", "Yellow"]);
    expect(groups.rows.every((g) => /^#[0-9a-f]{6}$/.test(g.color_hex) && g.min_age === null && g.gender === "any")).toBe(true);
  });

  it("creates six empty theme slots and shows nothing publicly", async () => {
    expect(await count(db, "public.program_themes", "name is null")).toBe(6);
    const theme = await asRole(db, "anon", () => db.query<{ t: unknown }>("select public.get_active_theme() as t"));
    expect(theme.rows[0].t).toBeNull();
  });
});

describe("registration", () => {
  it("stores gender and the parent-reported Quran background", async () => {
    await submitRegistration(
      db,
      familyPayload({
        primaryGuardian: { ...familyPayload().primaryGuardian, email: "other@example.com" },
        students: [student({ firstName: "Yusuf", gender: "male", quranAbility: "memorizing", quranNotes: "Juz Amma" })],
      }),
    );
    const row = await db.query<{ gender: string; reported_quran_ability: string; quran_background_notes: string }>(
      `select s.gender, r.reported_quran_ability, r.quran_background_notes
       from public.registrations r join public.students s on s.id = r.student_id where s.first_name = 'Yusuf'`,
    );
    expect(row.rows[0]).toEqual({ gender: "male", reported_quran_ability: "memorizing", quran_background_notes: "Juz Amma" });
  });

  it("requires gender and Quran ability", async () => {
    const email = { ...familyPayload().primaryGuardian, email: "x@example.com" };
    await expect(
      submitRegistration(db, familyPayload({ primaryGuardian: email, students: [student({ gender: "" })] })),
    ).rejects.toThrow(/invalid_payload/);
    await expect(
      submitRegistration(db, familyPayload({ primaryGuardian: email, students: [student({ quranAbility: "expert" })] })),
    ).rejects.toThrow(/invalid_payload/);
  });
});

describe("Quran assignments", () => {
  it("rejects a teacher who does not teach the selected level", async () => {
    const hifzTeacher = await createTeacher("Teacher One", [4]);
    await expect(setQuran(3, hifzTeacher)).rejects.toThrow(/quran_assignments_teacher_level_fkey|teacher_not_available/);
    expect(await count(db, "public.quran_assignments")).toBe(0);
  });

  it("cannot be edited into an incompatible level directly either", async () => {
    const hifzTeacher = await createTeacher("Teacher One", [4]);
    await setQuran(4, hifzTeacher);
    await expect(
      asRole(db, "authenticated", () => db.query("update public.quran_assignments set quran_level_id = 1"), staffId),
    ).rejects.toThrow(/quran_assignments_teacher_level_fkey|teacher_not_available/);
  });

  it("keeps history: each change closes the current assignment and opens a new one", async () => {
    const teacherA = await createTeacher("Teacher A", [4]);
    const teacherB = await createTeacher("Teacher B", [4, 3]);

    await setQuran(1, null); // level only, no teacher yet
    await setQuran(4, teacherA); // move level and teacher
    const unchanged = await setQuran(4, teacherA); // no-op
    await setQuran(4, teacherB); // move teacher within level

    const rows = await db.query<{ quran_level_id: number; teacher_id: number | null; status: string }>(
      "select quran_level_id, teacher_id, status from public.quran_assignments order by id",
    );
    expect(rows.rows).toEqual([
      { quran_level_id: 1, teacher_id: null, status: "ended" },
      { quran_level_id: 4, teacher_id: teacherA, status: "ended" },
      { quran_level_id: 4, teacher_id: teacherB, status: "active" },
    ]);
    expect(unchanged.rows[0].id).not.toBeNull();
    expect(await count(db, "public.audit_logs", "table_name = 'quran_assignments'")).toBeGreaterThanOrEqual(5);
  });

  it("refuses new assignments to inactive teachers but keeps their history", async () => {
    const teacher = await createTeacher("Teacher A", [2]);
    await setQuran(2, teacher);
    await db.query("update public.teachers set is_active = false where id = $1", [teacher]);

    await setQuran(1, null);
    await expect(setQuran(2, teacher)).rejects.toThrow(/teacher_not_available_for_level/);
    expect(await count(db, "public.quran_assignments", `teacher_id = ${teacher}`)).toBe(1);
    // Teachers are never deleted: there is no DELETE policy, so nothing is removed.
    const deleted = await asRole(db, "authenticated", () => db.query("delete from public.teachers returning id"), staffId);
    expect(deleted.rows).toHaveLength(0);
    expect(await count(db, "public.teachers")).toBe(1);
  });

  it("needs an active registration for the school year", async () => {
    await db.query("update public.registrations set status = 'withdrawn'");
    await expect(setQuran(1, null)).rejects.toThrow(/no_active_registration/);
  });
});

describe("color groups", () => {
  async function assignColor(slug: string) {
    return asRole(
      db,
      "authenticated",
      () =>
        db.query(
          `insert into public.color_group_assignments (registration_id, color_group_id)
           select $1, id from public.color_groups where slug = $2
           on conflict (registration_id) do update set color_group_id = excluded.color_group_id`,
          [registrationId, slug],
        ),
      staffId,
    );
  }

  it("are stored separately from Quran assignments and counted in the dashboard", async () => {
    const teacher = await createTeacher("Teacher A", [3]);
    await assignColor("red");
    await assignColor("blue"); // move
    await setQuran(3, null);

    const stats = await asRole(
      db,
      "authenticated",
      () => db.query<{ s: Record<string, unknown> }>("select public.admin_dashboard_stats($1) as s", [yearId]),
      staffId,
    );
    expect(stats.rows[0].s).toMatchObject({
      activeStudents: 1,
      unassignedColorGroup: 0,
      unassignedQuranLevel: 0,
      levelWithoutTeacher: 1,
      byColorGroup: { blue: 1 },
      byQuranLevel: { "3": 1 },
    });

    await setQuran(3, teacher);
    const view = await asRole(
      db,
      "authenticated",
      () =>
        db.query<{ color_group_name: string; quran_level_name: string; teacher_name: string }>(
          "select color_group_name, quran_level_name, teacher_name from public.admin_registration_list",
        ),
      staffId,
    );
    expect(view.rows).toEqual([{ color_group_name: "Blue", quran_level_name: "Tajweed", teacher_name: "Teacher A" }]);
  });

  it("are cleared, and the Quran assignment closed, when a student withdraws", async () => {
    await assignColor("green");
    await setQuran(1, null);
    await asRole(db, "authenticated", () => db.query("update public.registrations set status = 'withdrawn'"), staffId);
    expect(await count(db, "public.color_group_assignments")).toBe(0);
    expect(await count(db, "public.quran_assignments", "status = 'ended'")).toBe(1);
  });

  it("let administrators record placement criteria", async () => {
    await asRole(
      db,
      "authenticated",
      () => db.query("update public.color_groups set min_age = 6, max_age = 8, gender = 'female' where slug = 'red'"),
      staffId,
    );
    const red = await db.query<{ min_age: number; gender: string }>("select min_age, gender from public.color_groups where slug = 'red'");
    expect(red.rows[0]).toEqual({ min_age: 6, gender: "female" });
  });
});

describe("themes", () => {
  it("only full admins can activate a theme, and only once it has content", async () => {
    const slot = (await db.query<{ id: number }>("select id from public.program_themes where cycle_position = 1")).rows[0].id;

    await expect(
      asRole(db, "authenticated", () => db.query("select public.admin_set_active_theme($1)", [slot]), staffId),
    ).rejects.toThrow(/forbidden/);
    await expect(
      asRole(db, "authenticated", () => db.query("select public.admin_set_active_theme($1)", [slot]), adminId),
    ).rejects.toThrow(/program_themes_active_needs_content/);

    await asRole(
      db,
      "authenticated",
      async () => {
        await db.query("update public.program_themes set name = 'Theme name', main_value = 'Value' where id = $1", [slot]);
        await db.query("select public.admin_set_active_theme($1)", [slot]);
      },
      adminId,
    );
    const theme = await asRole(db, "anon", () => db.query<{ t: { name: string } }>("select public.get_active_theme() as t"));
    expect(theme.rows[0].t).toMatchObject({ name: "Theme name", mainValue: "Value", cyclePosition: 1 });
  });
});

describe("access control for the new tables", () => {
  it("hides teachers, assignments and groups from the public and from non-admins", async () => {
    for (const table of ["teachers", "teacher_quran_levels", "quran_assignments", "quran_levels", "color_groups", "color_group_assignments", "program_themes"]) {
      await expect(asRole(db, "anon", () => db.query(`select * from public.${table}`)), table).rejects.toThrow(/permission denied/);
    }
    await expect(
      asRole(db, "anon", () => db.query("select public.admin_set_quran_assignment(1, 1, 1::smallint, null, null)")),
    ).rejects.toThrow(/permission denied/);
  });
});
