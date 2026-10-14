# NKC Student Registration and Management System

A web application for the NKC weekend Arabic school. It replaces the Google Forms + spreadsheet workflow:

- **Families** register one or more children in a single, guided online form.
- **School administrators** sign in to a private dashboard to review registrations, manage families and guardians, place students in groups, track payments, add internal notes and export lists.
- Children's and families' personal information is protected by server-side checks **and** PostgreSQL Row Level Security.

## Technology

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript (strict) |
| Database & auth | Supabase (PostgreSQL, Auth, Row Level Security) via `@supabase/supabase-js` and `@supabase/ssr` |
| Validation | [Zod](https://zod.dev) 4: one schema shared by the browser and the server |
| Tests | Vitest, plus [PGlite](https://pglite.dev) (real PostgreSQL in-process) for database tests |
| Hosting | Vercel (recommended) |

## Project layout

```
app/
  page.tsx                  Public landing page
  register/                 Multi-step family registration form (client) + page (server)
  api/register/route.ts     Public registration endpoint (validation, abuse protection, atomic RPC)
  admin/login/              Staff sign-in (no public sign-up)
  admin/(dashboard)/        Protected dashboard: overview, students, families, groups, activity log
  api/admin/export/         CSV export (admins only)
components/                 UI building blocks (ui/, site/, admin/)
lib/
  config/school.ts          School-specific copy, contact details and consent wording (placeholders)
  registration/             Options, Zod schemas, form state, error messages, rate limiting
  auth/                     Admin authorization (pure rules + server helpers)
  admin/                    Dashboard queries, filters, audit-log formatting, action helpers
  supabase/                 Server, service-role and proxy clients
  database.types.ts         Database types
proxy.ts                    Refreshes the auth session and redirects signed-out visitors away from /admin
supabase/migrations/        Every schema, function and RLS change, in order
tests/                      Unit tests and database tests
```

## Local setup

Requirements: Node.js 20.9+ (developed on Node 24) and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Name | Where it's used | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server (publishable/anon key) | No: RLS gives anonymous users no data |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (`lib/supabase/service.ts`) | **Yes**: bypasses RLS. Never prefix with `NEXT_PUBLIC_` |
| `RATE_LIMIT_SECRET` | Server only, optional | Yes: key used to hash client IPs (falls back to the service key) |

`.env*` files are git-ignored; only `.env.example` (names, no values) is committed.

## Supabase setup

1. **Apply the migrations** (below). They create every table, function, view and RLS policy.
2. **Disable public sign-ups:** Supabase Dashboard → Authentication → Sign In / Providers → turn off *Allow new users to sign up*. Staff accounts are created by an administrator (below). Even if someone did create an account, they would see nothing without an `admin_profiles` row.
3. Under **Authentication → URL Configuration**, set the Site URL to your production URL.
4. Set the current school year (see "School years" below).

### Applying database migrations

Migrations live in `supabase/migrations/` and must be applied **in filename order**:

| File | What it does |
| --- | --- |
| `20261014000000_baseline_existing_schema.sql` | The tables that existed before migrations were tracked (no-op on the existing project) |
| `20261014000100_school_management_schema.sql` | School years, households, health notes, groups, assignments, payments, admin tables; backfills existing rows |
| `20261014000200_functions_and_registration_rpc.sql` | Audit triggers, payment/group rules, the atomic `submit_family_registration` RPC, rate limiter |
| `20261014000300_admin_views_and_security.sql` | Dashboard views, stats function, **RLS policies and privileges** |

**Option A: Supabase CLI** (recommended for ongoing work)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option B: SQL Editor.** Open each file in order, paste it into Supabase → SQL Editor and run it.

> **Back up first.** Supabase → Database → Backups, or export the tables as CSV. The schema migration moves `students.health_information` / `special_considerations` into `student_health_notes`, converts `registrations.school_year` to a `school_year_id` and moves `registrations.group_id` into `student_group_assignments`. Existing rows are preserved. If a constraint fails, the error names it. Fix the offending rows and re-run. The migration also **drops any existing RLS policies** on these tables, so access is exactly what migration 4 defines.

After schema changes, regenerate types (optional but recommended):

```bash
npx supabase gen types typescript --linked > lib/database.types.ts
```

The hand-maintained types also export the `TableRow`/`ViewRow` helpers at the bottom of the file; keep those when regenerating.

### Creating the first administrator

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**. Enter the staff member's email and a strong password, and tick *Auto Confirm User*.
2. Copy the new user's **UID** and run in the SQL Editor:

```sql
insert into public.admin_profiles (user_id, full_name, role)
values ('<user-uid>', 'Full Name', 'admin');   -- or 'staff'
```

Roles:

- **admin**: full access, including health/special-consideration notes, deleting payments and groups, managing school years.
- **staff**: manage registrations, families, groups and payments. **Cannot** see health notes.

To remove access, set `is_active = false` on their profile (and/or delete the auth user). There is deliberately no UI for granting admin access.

### School years

The public form registers families for the school year where `is_current = true` **and** `registration_open = true`. The migration creates `2026-2027` as current and open. To roll over:

```sql
update public.school_years set is_current = false, registration_open = false;
insert into public.school_years (label, is_current, registration_open, default_amount_due)
values ('2027-2028', true, true, null);   -- set default_amount_due once tuition is decided
```

Set `registration_open = false` to close registration; the site then shows a "registration closed" message.

## Scripts

```bash
npm run lint        # ESLint
npm run typecheck   # next typegen + tsc --noEmit
npm test            # Vitest: unit tests + database tests (PGlite, no Supabase needed)
npm run build       # production build
npm run check       # all of the above
```

The database tests (`tests/db`) apply every migration to an in-memory PostgreSQL with Supabase-like roles (`anon`, `authenticated`, `service_role`) and an `auth.uid()` stand-in, then check:

- atomic multi-child registration (a failure on the last child leaves nothing behind)
- idempotent retries and duplicate-registration protection
- parent de-duplication by email
- returning-student matching, and review flags when identity is uncertain
- RLS: the public cannot read anything, signed-in non-admins see nothing, staff cannot read health notes
- audit logging, payment-status derivation, and group capacity/year rules
- migrating legacy data, including dropping old permissive policies

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js).
2. Add the environment variables above in **Project → Settings → Environment Variables** (Production and Preview). Mark `SUPABASE_SERVICE_ROLE_KEY` and `RATE_LIMIT_SECRET` as sensitive.
3. Apply the migrations to the production Supabase project *before* the first deploy.
4. Deploy. After it's live, set Supabase **Site URL** to the Vercel/custom domain.
5. Smoke test: open `/`, submit a test registration, sign in at `/admin/login`, find the test student, then withdraw it.

## Database model

```
school_years ─┐
              ├─< registrations >── students >── households ──< parents
groups ───────┘        │   │            │                          │
   └──< student_group_assignments       └──< student_parents >─────┘
                       │
                       ├──< payments
                       └── registration_submissions (one per form submission)
students ──1:1── student_health_notes (restricted)     students ──< admin_notes
admin_profiles (auth.users → role)                       audit_logs (every admin change)
```

- **households**: a family. Holds the emergency contact. Parents and students belong to one household.
- **parents**: guardians. Unique by normalized email (`email_normalized`), so a returning parent is never duplicated. A child can have several guardians and a guardian several children through **student_parents** (with `relationship` and `is_primary_contact`).
- **registrations**: one per student per school year (unique). Carries status, grade for that year, a random reference code (`NKC-XXXXXXXX`), review flags, acknowledgments, amount due and payment status.
- **payments**: a ledger of amounts received (method, date, receipt/check number). `payment_status` is derived automatically from the ledger and the amount due, except **waived**, which an admin sets.
- **groups** belong to a school year and have a capacity; **student_group_assignments** places one registration in one group (same-year and capacity rules enforced in the database). Withdrawn or rejected students are removed from their group automatically.
- **student_health_notes**: health/allergy/special considerations, kept apart so only full admins can read it.
- **audit_logs**: written by triggers for every insert/update/delete made by a signed-in admin: who, when, which fields, old → new values (never health-note contents).
- IDs are `bigint` identities, matching the tables that existed before this work.

### How a registration is saved

`POST /api/register`:

1. Validates the body with the same Zod schema as the form.
2. Rejects bots: a hidden honeypot field, a minimum fill time, and a per-IP rate limit (5 per 10 minutes, IPs stored only as keyed hashes).
3. Calls `submit_family_registration` with the service role. That PostgreSQL function runs as **one transaction**: it locks on the submission key and guardian email, re-validates everything, matches or creates the household, guardians and students, and creates every registration. Either the whole family is saved or nothing is.

Identity rules: a parent is matched by email, but their stored details are never overwritten by a public form. If the name differs, the registration is flagged *Needs review* and the submitted details are kept for an admin to compare. A child is reused only if the guardian matched cleanly and a child with the same name and date of birth exists in that family; otherwise a new record is created and possible duplicates are flagged. Nothing is merged silently.

Retries (double clicks, network errors) reuse the same idempotency key, so they return the original result instead of creating duplicates.

## Security and data handling

- **No public data access.** The `anon` role has no table privileges at all; the only public database function returns the open school-year label. Public registration goes only through the server endpoint.
- **Admins are explicit.** Supabase Auth proves who someone is; an active `admin_profiles` row decides whether they may use the dashboard. This is checked in the dashboard layout, in **every** Server Action and the export route, and again by RLS in the database.
- **Health information** (special considerations) is only readable by `admin`-role users (RLS on `student_health_notes`), never included in CSV exports, never written to the audit log and never logged by the server. The form asks only for what teachers need to know and says who can see it.
- **Service-role key** is used only in `lib/supabase/service.ts` (`server-only`), for the registration RPC and rate limiter.
- **Errors**: parents see friendly messages only; raw database errors are never returned. Server logs contain error codes, never request bodies.
- **CSV exports** escape cells starting with `= + - @` (formula injection) and exclude health data.
- **Payments**: tracking only. No card or bank numbers are stored (the form warns against entering them).
- **Headers**: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HSTS, `nosniff`, a strict referrer policy; the admin area is `noindex` and `no-store`.
- The old `/test-db` page (public reads and test inserts) has been removed.

## Remaining school-specific configuration

These are intentionally left as placeholders. Nothing was invented. Edit `lib/config/school.ts`:

| Setting | Current value | Where it appears |
| --- | --- | --- |
| `school.name` | "NKC Arabic School" (confirm official name) | Header, titles, footer |
| `school.schedule` | `null` | Landing page "Important information" |
| `school.ageRange` | `null` | Landing page "Who we serve" |
| `school.contact.email` / `phone` / `address` | `null` | Landing page contact section |
| `school.registration.tuitionSummary` | `null` | Landing page, confirmation page |
| `school.registration.deadline` | `null` | Landing page |
| `acknowledgments` → `policies` | Placeholder text, flagged `needsSchoolWording` | Registration consent step. **Replace with school-approved wording** and bump `CONSENT_VERSION` |
| Tuition amount | `school_years.default_amount_due` is `NULL` | Set in the database once fees are decided |
| Payment methods | cash, check, card in person, online, bank transfer, other | `lib/registration/options.ts` + `payments_method_check` constraint |

Also review the generic program copy on the landing page (`app/page.tsx`) with school leadership.
