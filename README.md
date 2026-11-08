# Noor Kids Club: Registration and Management

The website and administrative dashboard for **Noor Kids Club**, a Saturday Islamic youth program (Saturdays, 2:30–5:30 PM, at NICC in Dublin, Ohio). It replaces the Google Forms + spreadsheet workflow:

- **Families** register one or more children in a single, guided online form.
- **Administrators** sign in to a private dashboard to review registrations, manage families, place children in **color groups** and **Quran levels/teachers**, track payments, add internal notes, manage the rotating theme and export lists.
- Children's and families' personal information is protected by server-side checks **and** PostgreSQL Row Level Security.

## Technology

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`) |
| UI | React 19, Tailwind CSS 4, Fredoka + Nunito fonts |
| Language | TypeScript (strict) |
| Database & auth | Supabase (PostgreSQL, Auth, Row Level Security) via `@supabase/supabase-js` and `@supabase/ssr` |
| Validation | [Zod](https://zod.dev) 4: one schema shared by the browser and the server |
| Tests | Vitest, plus [PGlite](https://pglite.dev) (real PostgreSQL in-process) for database tests |
| Hosting | Vercel |

## Where things live

```
lib/config/program.ts       Program name, schedule, tuition, contact, location, activities,
                            FAQ, consent wording, brand colors, logo, theme visibility
lib/registration/options.ts Grades, Quran levels, Quran-ability choices, statuses, labels
public/brand/               Official logo (noor-kids-club-logo.jpg)
app/icon.png, apple-icon.png  Favicons: the full logo letterboxed on white (not cropped)
components/site/logo.tsx    The one reusable logo component

app/page.tsx                Public landing page
app/register/               Family registration (Family, Children, Learning Background,
                            Additional Information, Review)
app/api/register/route.ts   Public registration endpoint (validation, abuse protection, atomic RPC)
app/admin/login/            Staff sign-in (no public sign-up)
app/admin/(dashboard)/      Overview, Students, Families, Color groups, Quran, Themes, Activity log
app/api/admin/export/       CSV export (students, color-group rosters, teacher rosters)
lib/admin/                  Dashboard queries, filters, assignment actions, audit formatting
lib/auth/                   Admin authorization rules
lib/email/                  Email-ready confirmation template (not sent yet: no provider configured)
supabase/migrations/        Every schema, function and RLS change, in order
tests/                      Unit tests and database tests
```

To change program details (tuition label, phone, FAQ answers, consent wording), edit **`lib/config/program.ts`** only.

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
| `NEXT_PUBLIC_SITE_URL` | Optional | No: absolute URL for social previews (Vercel's domain is used if unset) |

`.env*` files are git-ignored; only `.env.example` (names, no values) is committed. **On Vercel, add the same variables under Project → Settings → Environment Variables and redeploy.** Without them the site shows "registration closed" and staff sign-in fails.

## Supabase setup

1. **Apply the migrations** (below).
2. **Disable public sign-ups:** Authentication → Sign In / Providers → turn off *Allow new users to sign up*.
3. Authentication → URL Configuration: set the Site URL to the production URL.
4. Create the first administrator (below).

### Applying database migrations

Apply the files in `supabase/migrations/` **in filename order**. Every file is safe to run more than once.

| File | What it does |
| --- | --- |
| `20261014000000_baseline_existing_schema.sql` | Tables that existed before migrations were tracked |
| `20261014000100_school_management_schema.sql` | School years, households, health notes, payments, admin tables; backfills old rows |
| `20261014000200_functions_and_registration_rpc.sql` | Audit triggers, payment rules, atomic registration RPC, rate limiter |
| `20261014000300_admin_views_and_security.sql` | Dashboard views, stats, **RLS policies and privileges** |
| `20261108000000_noor_program_structure.sql` | Gender, Quran background, **color groups**, **Quran levels/teachers/assignments**, **rotating themes**, updated RPC, views, stats and RLS |

> **Existing project:** if you already ran the first four files, run **only `20261108000000_noor_program_structure.sql`** (Supabase → SQL Editor → paste → Run). Back up first (Database → Backups).

How existing data is handled by the newest migration:

- Existing students get `gender = NULL`. Set it on each student's page so they can be placed in color groups.
- `students.arabic_level` (from the earlier form) is kept as legacy data but is no longer collected or shown.
- The earlier "Groups & classes" tables (`groups`, `student_group_assignments`) and their rows are **kept untouched** but no longer used by the dashboard. Color groups and Quran assignments replace them. They can be dropped in a later migration once nobody needs that data.

CLI alternative:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Creating the first administrator

1. Authentication → Users → **Add user → Create new user**, with *Auto Confirm User* ticked.
2. Copy the user's UID and run:

```sql
insert into public.admin_profiles (user_id, full_name, role)
values ('<user-uid>', 'Full Name', 'admin');   -- or 'staff'
```

- **admin**: everything, including health notes, themes, deleting payments.
- **staff**: registrations, families, color groups, Quran assignments, teachers and payments. **No** health notes or themes.

Deactivate access with `update public.admin_profiles set is_active = false where user_id = '…';`.

### School years and tuition

Registration is open for the school year with `is_current = true` and `registration_open = true` (2026-2027 is created open). Tuition is shown on the site as **$185** from `lib/config/program.ts`. The amount due on each registration comes from `school_years.default_amount_due`, which is **left empty until the billing period is confirmed**. When it is:

```sql
update public.school_years set default_amount_due = 185 where label = '2026-2027';
```

and set `tuition.periodLabel` in `lib/config/program.ts` (for example `"per child, per year"`).

## How students are organized

Every student has **two separate placements per school year**, stored in different tables:

**Color group** (`color_groups`, `color_group_assignments`)
- Red, Green, Orange, Blue and Yellow, each with a stored display color.
- Each group has optional placement guidance (age range, boys/girls, notes) that administrators edit on the Color groups page.
- The dashboard **suggests** a group when exactly one group fits a child's age and gender. Nothing is assigned automatically; an administrator confirms every placement.
- Withdrawn or rejected students are removed from their color group.

**Quran level and teacher** (`quran_levels`, `teachers`, `teacher_quran_levels`, `quran_assignments`)
- Levels, in order: **4 – Hifz, 3 – Tajweed, 2 – Tilawah, 1 – Nooraniah**.
- Any number of teachers per level, and a teacher may teach several levels. Teacher names are database records, managed on Quran → Manage teachers.
- A student has one active Quran assignment per school year (level, optional teacher, dates, note).
- **A teacher must teach the chosen level.** This is enforced by a composite foreign key in the database, and the dashboard only offers matching teachers.
- Changing a level or teacher **closes the current assignment and opens a new one**, so history is kept; the dashboard asks for confirmation first.
- Teachers are deactivated, never deleted. A level link with history is deactivated rather than removed.

Families describe their child's Quran reading when registering; administrators make the final level and teacher decision.

## Rotating six-year theme

`program_themes` has six slots (cycle positions 1–6) with name, description, main value, accent color, optional dates and an active flag. Full administrators fill them in on **Themes** and choose the active one. The homepage shows the active theme only once it has a name and main value, and only through a narrow public function. Until then the section stays hidden. Turn the homepage section off entirely with `themeSettings.showOnHomepage` in `lib/config/program.ts`.

## Scripts

```bash
npm run lint        # ESLint
npm run typecheck   # next typegen + tsc --noEmit
npm test            # unit tests + database tests (PGlite, no Supabase needed)
npm run build       # production build
npm run check       # all of the above
```

Database tests apply every migration (twice, to prove they are re-runnable) to an in-memory PostgreSQL with Supabase-like roles and check:

- atomic multi-child registration and idempotent retries
- parent de-duplication and returning-student matching
- the four Quran levels, teacher/level compatibility, assignment history, inactive teachers
- color groups kept separate from Quran assignments, and dashboard counts
- themes hidden until real content exists
- RLS on every table, and the public having no data access

## Deploying to Vercel

1. Import the GitHub repository in Vercel (preset: Next.js).
2. Add the environment variables (Production and Preview). Mark the secret ones as sensitive.
3. Apply the migrations to the production Supabase project.
4. Deploy, then set the Supabase Site URL to the deployed domain.
5. Smoke test: open `/`, check `/register`, sign in at `/admin/login`.

## Security and data handling

- The publishable key gives the public **no table access**. The only public functions return the open school-year label and the published theme.
- Admin access requires an active `admin_profiles` row. It is checked in the dashboard layout, in every Server Action and the export route, and again by RLS.
- Health/special-consideration notes are readable only by `admin`-role users, never exported, never logged and never copied into the audit log.
- The service-role key is used only in `lib/supabase/service.ts` (`server-only`).
- Parents never see raw database errors; server logs contain error codes only.
- CSV exports neutralize spreadsheet formulas and exclude health data.
- Payment tracking only: no card or bank numbers are stored.
- Every administrative change (including color-group and Quran changes) is recorded in `audit_logs`.

## Remaining program-specific configuration

Nothing below was invented; each item is hidden or shown as a neutral placeholder until supplied. Edit `lib/config/program.ts` unless noted.

| Item | Current state |
| --- | --- |
| Tuition billing period (`tuition.periodLabel`) | `null`: the site shows "$185" with no period |
| Default amount due per registration | Database `school_years.default_amount_due` is empty (see above) |
| Public phone number (`contact.phone`) | `null`: not shown |
| Full venue name (`location.venueFullName`) | `null`: "NICC" is shown |
| Registration deadline | `null`: not shown |
| Program policy wording (`acknowledgments` → `policies`) | Placeholder text, flagged `needsProgramWording`. Replace, then bump `CONSENT_VERSION` |
| FAQ answers for "What should my child bring?" and "Refund policy" | `null`: hidden until answered |
| Six rotating themes | Empty slots, entered in the dashboard |
| Color-group age/gender guidance | Empty, entered in the dashboard |
| Quran teachers | None yet, added in the dashboard |
| Email provider for confirmations | Not configured. Template ready in `lib/email/registration-confirmation.ts` |
