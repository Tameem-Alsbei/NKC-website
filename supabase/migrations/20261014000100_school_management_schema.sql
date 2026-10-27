-- =============================================================================
-- School management schema.
--
-- Evolves the baseline tables into a normalized model and adds the tables
-- needed by the admin dashboard. Existing rows are preserved and backfilled:
--   * registrations.school_year (text)  -> school_years + registrations.school_year_id
--   * registrations.group_id            -> student_group_assignments
--   * students.health_information and
--     students.special_considerations   -> student_health_notes (restricted table)
--   * every existing parent gets a household; students join their parent's household
--
-- If a constraint below fails, inspect the offending rows (the error names the
-- constraint) and correct them, then re-run. Nothing is silently rewritten.
-- =============================================================================

create schema if not exists private;

-- Helper used only during this migration: drop every foreign key on a column so
-- it can be recreated with an explicit name and ON DELETE behaviour.
create or replace function pg_temp.drop_foreign_keys(p_table regclass, p_column text)
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = p_table and c.contype = 'f' and a.attname = p_column
  loop
    execute format('alter table %s drop constraint %I', p_table, r.conname);
  end loop;
end;
$$;

-- Keeps updated_at current on every UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- School years
-- -----------------------------------------------------------------------------
create table if not exists public.school_years (
  id bigint generated always as identity primary key,
  label text not null unique check (char_length(label) between 4 and 20),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  registration_open boolean not null default false,
  -- Optional default amount due per registration. NULL until the school sets
  -- tuition; admins can still record an amount per registration.
  default_amount_due numeric(10, 2) check (default_amount_due >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_years_dates_ordered check (ends_on is null or starts_on is null or ends_on > starts_on)
);

-- At most one "current" school year.
create unique index if not exists school_years_single_current
  on public.school_years (is_current) where is_current;

-- Only on the first run: later runs no longer have the old text column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name = 'school_year'
  ) then
    insert into public.school_years (label)
    select distinct btrim(school_year)
    from public.registrations
    where school_year is not null and btrim(school_year) <> ''
    on conflict (label) do nothing;
  end if;
end;
$$;

-- The app previously hard-coded 2026-2027 as the open registration year.
insert into public.school_years (label) values ('2026-2027')
on conflict (label) do nothing;

update public.school_years
set is_current = true, registration_open = true
where label = '2026-2027'
  and not exists (select 1 from public.school_years where is_current);

drop trigger if exists school_years_set_updated_at on public.school_years;
create trigger school_years_set_updated_at
  before update on public.school_years
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Households (families)
-- -----------------------------------------------------------------------------
create table if not exists public.households (
  id bigint generated always as identity primary key,
  display_name text not null check (char_length(display_name) between 1 and 120),
  emergency_contact_name text check (char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text check (char_length(emergency_contact_phone) <= 40),
  emergency_contact_relationship text check (char_length(emergency_contact_relationship) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
  before update on public.households
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Parents / guardians
-- -----------------------------------------------------------------------------
alter table public.parents
  add column if not exists household_id bigint,
  alter column email drop not null;

select pg_temp.drop_foreign_keys('public.parents', 'household_id');
alter table public.parents
  add constraint parents_household_id_fkey
  foreign key (household_id) references public.households (id) on delete set null;

-- Normalized values used for de-duplication and search.
alter table public.parents
  add column if not exists email_normalized text
    generated always as (nullif(lower(btrim(email)), '')) stored,
  add column if not exists phone_normalized text
    generated always as (nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')) stored;

do $$
begin
  if exists (
    select email_normalized from public.parents
    where email_normalized is not null
    group by email_normalized having count(*) > 1
  ) then
    raise exception 'Duplicate parent emails exist. Merge those parent records before applying this migration.';
  end if;
end;
$$;

create unique index if not exists parents_email_normalized_key
  on public.parents (email_normalized) where email_normalized is not null;
create index if not exists parents_household_id_idx on public.parents (household_id);
create index if not exists parents_name_idx on public.parents (lower(last_name), lower(first_name));

alter table public.parents
  drop constraint if exists parents_name_length,
  add constraint parents_name_length
    check (char_length(first_name) between 1 and 80 and char_length(last_name) between 1 and 80),
  drop constraint if exists parents_email_length,
  add constraint parents_email_length check (char_length(email) <= 254),
  drop constraint if exists parents_phone_length,
  add constraint parents_phone_length check (char_length(phone) <= 40);

drop trigger if exists parents_set_updated_at on public.parents;
create trigger parents_set_updated_at
  before update on public.parents
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Students
-- -----------------------------------------------------------------------------
alter table public.students
  add column if not exists household_id bigint,
  add column if not exists studied_arabic_before boolean;

select pg_temp.drop_foreign_keys('public.students', 'household_id');
alter table public.students
  add constraint students_household_id_fkey
  foreign key (household_id) references public.households (id) on delete set null;

alter table public.students
  drop constraint if exists students_grade_check,
  add constraint students_grade_check
    check (grade in ('Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12')),
  drop constraint if exists students_arabic_level_check,
  add constraint students_arabic_level_check
    check (arabic_level is null or arabic_level in ('beginner', 'intermediate', 'advanced')),
  drop constraint if exists students_name_length,
  add constraint students_name_length
    check (char_length(first_name) between 1 and 80 and char_length(last_name) between 1 and 80);

create index if not exists students_name_idx on public.students (lower(last_name), lower(first_name));
create index if not exists students_household_id_idx on public.students (household_id);

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

-- Health and special-consideration notes live in their own table so that they
-- can have stricter access rules than the rest of the student profile.
create table if not exists public.student_health_notes (
  student_id bigint primary key references public.students (id) on delete cascade,
  special_considerations text not null check (char_length(special_considerations) between 1 and 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

drop trigger if exists student_health_notes_set_updated_at on public.student_health_notes;
create trigger student_health_notes_set_updated_at
  before update on public.student_health_notes
  for each row execute function private.set_updated_at();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'health_information'
  ) then
    insert into public.student_health_notes (student_id, special_considerations)
    select id,
           left(concat_ws(E'\n', nullif(btrim(health_information), ''), nullif(btrim(special_considerations), '')), 1000)
    from public.students
    where nullif(btrim(coalesce(health_information, '')), '') is not null
       or nullif(btrim(coalesce(special_considerations, '')), '') is not null
    on conflict (student_id) do nothing;

    alter table public.students drop column health_information;
    alter table public.students drop column if exists special_considerations;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Student <-> guardian relationships
-- -----------------------------------------------------------------------------
alter table public.student_parents
  add column if not exists is_primary_contact boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

select pg_temp.drop_foreign_keys('public.student_parents', 'student_id');
select pg_temp.drop_foreign_keys('public.student_parents', 'parent_id');
alter table public.student_parents
  add constraint student_parents_student_id_fkey
    foreign key (student_id) references public.students (id) on delete cascade,
  add constraint student_parents_parent_id_fkey
    foreign key (parent_id) references public.parents (id) on delete cascade,
  drop constraint if exists student_parents_relationship_check,
  add constraint student_parents_relationship_check
    check (relationship in ('mother', 'father', 'parent', 'guardian', 'grandparent', 'other'));

create index if not exists student_parents_parent_id_idx on public.student_parents (parent_id);

-- Backfill households: one per existing parent; students join the household of
-- their lowest-id guardian.
do $$
declare
  p record;
  v_household_id bigint;
begin
  for p in select id, last_name from public.parents where household_id is null order by id loop
    insert into public.households (display_name)
    values (left(p.last_name || ' family', 120))
    returning id into v_household_id;
    update public.parents set household_id = v_household_id where id = p.id;
  end loop;

  update public.students s
  set household_id = (
    select pa.household_id
    from public.student_parents sp
    join public.parents pa on pa.id = sp.parent_id
    where sp.student_id = s.id
    order by pa.id
    limit 1
  )
  where s.household_id is null;

  -- Each student's lowest-id guardian becomes the primary contact if none is set.
  update public.student_parents sp
  set is_primary_contact = true
  where sp.parent_id = (
      select min(x.parent_id) from public.student_parents x where x.student_id = sp.student_id
    )
    and not exists (
      select 1 from public.student_parents y where y.student_id = sp.student_id and y.is_primary_contact
    );
end;
$$;

-- -----------------------------------------------------------------------------
-- Groups / classes
-- -----------------------------------------------------------------------------
alter table public.groups
  add column if not exists school_year_id bigint,
  add column if not exists arabic_level text,
  add column if not exists teacher_name text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now(),
  alter column minimum_grade drop not null,
  alter column maximum_grade drop not null;

update public.groups
set school_year_id = (select id from public.school_years where is_current limit 1)
where school_year_id is null;

alter table public.groups alter column school_year_id set not null;

select pg_temp.drop_foreign_keys('public.groups', 'school_year_id');
alter table public.groups
  add constraint groups_school_year_id_fkey
    foreign key (school_year_id) references public.school_years (id) on delete restrict,
  drop constraint if exists groups_capacity_check,
  add constraint groups_capacity_check check (capacity between 1 and 500),
  drop constraint if exists groups_arabic_level_check,
  add constraint groups_arabic_level_check
    check (arabic_level is null or arabic_level in ('beginner', 'intermediate', 'advanced')),
  drop constraint if exists groups_grade_check,
  add constraint groups_grade_check check (
    (minimum_grade is null or minimum_grade in ('Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'))
    and (maximum_grade is null or maximum_grade in ('Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'))
  ),
  drop constraint if exists groups_text_length,
  add constraint groups_text_length check (
    char_length(name) between 1 and 80
    and char_length(teacher_name) <= 120
    and char_length(notes) <= 2000
  );

create unique index if not exists groups_school_year_name_key on public.groups (school_year_id, lower(name));

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Registration submissions (one row per family form submission)
-- -----------------------------------------------------------------------------
create table if not exists public.registration_submissions (
  id bigint generated always as identity primary key,
  -- Generated by the browser for each form session; makes retries idempotent.
  idempotency_key uuid not null unique,
  household_id bigint references public.households (id) on delete set null,
  primary_parent_id bigint references public.parents (id) on delete set null,
  -- Guardian and emergency-contact details exactly as submitted, so admins can
  -- reconcile them when they differ from existing records. Never contains
  -- health information.
  submitted_contact jsonb not null default '{}'::jsonb,
  -- The response returned to the family (reference codes, first names).
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Registrations
-- -----------------------------------------------------------------------------
alter table public.registrations
  add column if not exists school_year_id bigint,
  add column if not exists reference_code text,
  add column if not exists grade text,
  add column if not exists submission_id bigint,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reasons text[] not null default '{}',
  add column if not exists acknowledgments jsonb not null default '{}'::jsonb,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists amount_due numeric(10, 2),
  add column if not exists payment_status text not null default 'not_paid',
  add column if not exists payment_note text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name = 'school_year'
  ) then
    update public.registrations r
    set school_year_id = sy.id
    from public.school_years sy
    where sy.label = btrim(r.school_year) and r.school_year_id is null;

    alter table public.registrations drop column school_year;
  end if;
end;
$$;

update public.registrations r
set grade = s.grade
from public.students s
where s.id = r.student_id and r.grade is null;

update public.registrations
set reference_code = 'NKC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where reference_code is null;

alter table public.registrations
  alter column school_year_id set not null,
  alter column reference_code set not null,
  alter column grade set not null;

select pg_temp.drop_foreign_keys('public.registrations', 'student_id');
select pg_temp.drop_foreign_keys('public.registrations', 'school_year_id');
select pg_temp.drop_foreign_keys('public.registrations', 'submission_id');
select pg_temp.drop_foreign_keys('public.registrations', 'status_changed_by');

alter table public.registrations
  add constraint registrations_student_id_fkey
    foreign key (student_id) references public.students (id) on delete restrict,
  add constraint registrations_school_year_id_fkey
    foreign key (school_year_id) references public.school_years (id) on delete restrict,
  add constraint registrations_submission_id_fkey
    foreign key (submission_id) references public.registration_submissions (id) on delete set null,
  add constraint registrations_status_changed_by_fkey
    foreign key (status_changed_by) references auth.users (id) on delete set null,
  drop constraint if exists registrations_status_check,
  add constraint registrations_status_check
    check (status in ('pending', 'under_review', 'confirmed', 'waitlisted', 'withdrawn', 'rejected')),
  drop constraint if exists registrations_payment_status_check,
  add constraint registrations_payment_status_check
    check (payment_status in ('not_paid', 'partially_paid', 'paid', 'waived')),
  drop constraint if exists registrations_amount_due_check,
  add constraint registrations_amount_due_check check (amount_due is null or amount_due >= 0),
  drop constraint if exists registrations_grade_check,
  add constraint registrations_grade_check
    check (grade in ('Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12')),
  drop constraint if exists registrations_payment_note_length,
  add constraint registrations_payment_note_length check (char_length(payment_note) <= 1000);

create unique index if not exists registrations_reference_code_key on public.registrations (reference_code);
-- A student can be registered at most once per school year.
create unique index if not exists registrations_student_year_key on public.registrations (student_id, school_year_id);
create index if not exists registrations_year_status_idx on public.registrations (school_year_id, status);
create index if not exists registrations_year_payment_idx on public.registrations (school_year_id, payment_status);
create index if not exists registrations_registered_at_idx on public.registrations (registered_at desc);

drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at
  before update on public.registrations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Group assignments (one group per registration, i.e. per student per year)
-- -----------------------------------------------------------------------------
create table if not exists public.student_group_assignments (
  registration_id bigint primary key references public.registrations (id) on delete cascade,
  group_id bigint not null references public.groups (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null
);

create index if not exists student_group_assignments_group_id_idx
  on public.student_group_assignments (group_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'registrations' and column_name = 'group_id'
  ) then
    -- Only carry over assignments whose group belongs to the registration's
    -- school year; anything else must be re-assigned in the dashboard.
    insert into public.student_group_assignments (registration_id, group_id)
    select r.id, r.group_id
    from public.registrations r
    join public.groups g on g.id = r.group_id and g.school_year_id = r.school_year_id
    where r.group_id is not null
    on conflict (registration_id) do nothing;

    alter table public.registrations drop column group_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Payments (ledger of amounts received; no card or bank details are stored)
-- -----------------------------------------------------------------------------
alter table public.payments drop column if exists status;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'transaction_id'
  ) then
    alter table public.payments rename column transaction_id to receipt_reference;
  end if;
end;
$$;

alter table public.payments
  add column if not exists receipt_reference text,
  add column if not exists note text,
  add column if not exists recorded_by uuid;

update public.payments set paid_at = created_at where paid_at is null;

alter table public.payments
  alter column paid_at set not null,
  alter column paid_at set default now();

-- Only on the first run: afterwards the dashboard views depend on this column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'amount'
      and (numeric_precision is distinct from 10 or numeric_scale is distinct from 2)
  ) then
    alter table public.payments alter column amount type numeric(10, 2);
  end if;
end;
$$;

select pg_temp.drop_foreign_keys('public.payments', 'registration_id');
select pg_temp.drop_foreign_keys('public.payments', 'recorded_by');
alter table public.payments
  add constraint payments_registration_id_fkey
    foreign key (registration_id) references public.registrations (id) on delete restrict,
  add constraint payments_recorded_by_fkey
    foreign key (recorded_by) references auth.users (id) on delete set null,
  drop constraint if exists payments_amount_check,
  add constraint payments_amount_check check (amount > 0 and amount < 100000),
  drop constraint if exists payments_method_check,
  add constraint payments_method_check
    check (payment_method is null or payment_method in ('cash', 'check', 'card_in_person', 'online', 'bank_transfer', 'other')),
  drop constraint if exists payments_text_length,
  add constraint payments_text_length
    check (char_length(receipt_reference) <= 80 and char_length(note) <= 1000);

create index if not exists payments_registration_id_idx on public.payments (registration_id);

-- -----------------------------------------------------------------------------
-- Administrators
-- -----------------------------------------------------------------------------
-- Signing in with Supabase Auth is NOT enough to use the dashboard: a user must
-- also have an active row here. Rows are created manually by an existing
-- administrator (see README "Create the first administrator").
--   admin -> full access, including health/special-consideration notes
--   staff -> manage registrations, groups and payments; no health notes
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role text not null default 'staff' check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
  before update on public.admin_profiles
  for each row execute function private.set_updated_at();

create table if not exists public.admin_notes (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete cascade,
  registration_id bigint references public.registrations (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_notes_student_id_idx on public.admin_notes (student_id, created_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text not null,
  changed_fields text[],
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_record_idx on public.audit_logs (table_name, record_id);

-- -----------------------------------------------------------------------------
-- Abuse protection for the public registration endpoint
-- -----------------------------------------------------------------------------
-- key_hash is a salted SHA-256 of the client IP computed by the server; raw IP
-- addresses are never stored.
create table if not exists public.registration_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, window_start)
);

create index if not exists registration_rate_limits_window_idx
  on public.registration_rate_limits (window_start);
