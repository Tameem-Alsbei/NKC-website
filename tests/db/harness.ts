import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

/**
 * Minimal stand-in for the parts of Supabase that the migrations rely on:
 * the anon/authenticated/service_role roles, the auth schema with auth.uid(),
 * and Supabase's default grants (which hand every new public table to anon and
 * authenticated, relying on RLS for protection).
 */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(
      coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      ),
      ''
    )::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export async function createSupabaseLikeDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  return db;
}

export async function applyMigrations(db: PGlite, files = migrationFiles()): Promise<void> {
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
}

let migratedSnapshot: Promise<File | Blob> | null = null;

/**
 * A fresh database with every migration applied. Migrations run once per test
 * file; each call then starts from a copy of that snapshot.
 */
export async function createMigratedDb(): Promise<PGlite> {
  migratedSnapshot ??= (async () => {
    const template = await createSupabaseLikeDb();
    await applyMigrations(template);
    const snapshot = await template.dumpDataDir("none");
    await template.close();
    return snapshot;
  })();
  return new PGlite({ loadDataDir: await migratedSnapshot });
}

export type DbRole = "anon" | "authenticated" | "service_role";

/**
 * Runs `fn` as a Supabase API role. For `authenticated`, `userId` becomes the
 * JWT subject returned by auth.uid(), just like a request through PostgREST.
 */
export async function asRole<T>(
  db: PGlite,
  role: DbRole,
  fn: () => Promise<T>,
  userId?: string,
): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    userId ? JSON.stringify({ sub: userId, role }) : "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

export async function createAuthUser(db: PGlite, email: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [email],
  );
  return result.rows[0].id;
}

export async function createAdmin(
  db: PGlite,
  email: string,
  role: "admin" | "staff",
): Promise<string> {
  const userId = await createAuthUser(db, email);
  await db.query(
    `insert into public.admin_profiles (user_id, full_name, role) values ($1, $2, $3)`,
    [userId, email.split("@")[0], role],
  );
  return userId;
}
