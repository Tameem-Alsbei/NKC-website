-- =============================================================================
-- Noor Kids Club program structure.
--
-- Adds, without removing existing data:
--   * students.gender (needed for color-group placement)
--   * parent-reported Quran ability and background on each registration
--   * color groups (Red, Green, Orange, Blue, Yellow) with configurable
--     age/gender criteria, and one color-group assignment per registration
--   * Quran levels (4 - Hifz, 3 - Tajweed, 2 - Tilawah, 1 - Nooraniah),
--     teachers, teacher-level links and historical Quran assignments
--   * the six-year rotating program theme
--
-- Color groups and Quran assignments are deliberately separate tables.
--
-- Existing data:
--   * Existing students get gender = NULL until an administrator sets it.
--   * students.arabic_level is kept as legacy data (no longer collected).
--   * The earlier "groups" / student_group_assignments tables and their rows
--     are kept untouched as legacy data; the dashboard no longer uses them.
--
-- Safe to run more than once.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Students and registrations
-- -----------------------------------------------------------------------------
alter table public.students add column if not exists gender text;
alter table public.students
  drop constraint if exists students_gender_check,
  add constraint students_gender_check check (gender is null or gender in ('male', 'female'));

alter table public.registrations
  add column if not exists reported_quran_ability text,
  add column if not exists quran_background_notes text;
alter table public.registrations
  drop constraint if exists registrations_reported_quran_ability_check,
  add constraint registrations_reported_quran_ability_check check (
    reported_quran_ability is null
    or reported_quran_ability in ('not_started', 'learning_letters', 'reading_with_help', 'reading_fluently', 'memorizing')
  ),
  drop constraint if exists registrations_quran_background_notes_length,
  add constraint registrations_quran_background_notes_length check (char_length(quran_background_notes) <= 1000);

-- -----------------------------------------------------------------------------
-- Color groups
-- -----------------------------------------------------------------------------
create table if not exists public.color_groups (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z]+$'),
  name text not null check (char_length(name) between 1 and 40),
  -- Display colors are stored as data so the UI never guesses from the name.
  color_hex text not null check (color_hex ~ '^#[0-9a-f]{6}$'),
  text_color_hex text not null check (text_color_hex ~ '^#[0-9a-f]{6}$'),
  sort_order smallint not null default 0,
  -- Placement guidance set by administrators (never applied automatically).
  min_age smallint check (min_age between 2 and 25),
  max_age smallint check (max_age between 2 and 25),
  gender text not null default 'any' check (gender in ('male', 'female', 'any')),
  criteria_note text check (char_length(criteria_note) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint color_groups_age_range check (min_age is null or max_age is null or min_age <= max_age)
);

insert into public.color_groups (slug, name, color_hex, text_color_hex, sort_order) values
  ('red', 'Red', '#c62828', '#ffffff', 1),
  ('green', 'Green', '#2c8049', '#ffffff', 2),
  ('orange', 'Orange', '#e08a28', '#061a35', 3),
  ('blue', 'Blue', '#1f5aa6', '#ffffff', 4),
  ('yellow', 'Yellow', '#f2c230', '#061a35', 5)
on conflict (slug) do nothing;

drop trigger if exists color_groups_set_updated_at on public.color_groups;
create trigger color_groups_set_updated_at
  before update on public.color_groups
  for each row execute function private.set_updated_at();

-- One color group per registration (i.e. per student per school year).
create table if not exists public.color_group_assignments (
  registration_id bigint primary key references public.registrations (id) on delete cascade,
  color_group_id bigint not null references public.color_groups (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null
);

create index if not exists color_group_assignments_group_idx on public.color_group_assignments (color_group_id);

-- -----------------------------------------------------------------------------
-- Quran levels, teachers and assignments
-- -----------------------------------------------------------------------------
-- The id IS the level number shown to families ("4 - Hifz").
create table if not exists public.quran_levels (
  id smallint primary key check (id between 1 and 20),
  name text not null unique check (char_length(name) between 1 and 40),
  sort_order smallint not null,
  created_at timestamptz not null default now()
);

insert into public.quran_levels (id, name, sort_order) values
  (4, 'Hifz', 1),
  (3, 'Tajweed', 2),
  (2, 'Tilawah', 3),
  (1, 'Nooraniah', 4)
on conflict (id) do nothing;

create table if not exists public.teachers (
  id bigint generated always as identity primary key,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text check (char_length(email) <= 254),
  notes text check (char_length(notes) <= 1000),
  -- Teachers are deactivated, never deleted, so assignment history survives.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists teachers_set_updated_at on public.teachers;
create trigger teachers_set_updated_at
  before update on public.teachers
  for each row execute function private.set_updated_at();

-- Which levels each teacher teaches (any number of teachers per level and
-- levels per teacher). Each row is one teacher-level roster.
create table if not exists public.teacher_quran_levels (
  teacher_id bigint not null references public.teachers (id) on delete restrict,
  quran_level_id smallint not null references public.quran_levels (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (teacher_id, quran_level_id)
);

create index if not exists teacher_quran_levels_level_idx on public.teacher_quran_levels (quran_level_id);

create table if not exists public.quran_assignments (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students (id) on delete restrict,
  school_year_id bigint not null references public.school_years (id) on delete restrict,
  quran_level_id smallint not null references public.quran_levels (id) on delete restrict,
  teacher_id bigint references public.teachers (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_on date not null default current_date,
  ended_on date,
  note text check (char_length(note) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The database itself guarantees a teacher actually teaches the level.
  -- (MATCH SIMPLE: not checked while teacher_id is NULL, i.e. no teacher yet.)
  constraint quran_assignments_teacher_level_fkey
    foreign key (teacher_id, quran_level_id) references public.teacher_quran_levels (teacher_id, quran_level_id),
  constraint quran_assignments_dates check (
    (status = 'active' and ended_on is null) or (status = 'ended' and ended_on is not null and ended_on >= started_on)
  )
);

-- At most one active Quran assignment per student per school year.
create unique index if not exists quran_assignments_one_active
  on public.quran_assignments (student_id, school_year_id) where status = 'active';
create index if not exists quran_assignments_roster_idx
  on public.quran_assignments (school_year_id, quran_level_id, teacher_id) where status = 'active';
create index if not exists quran_assignments_student_idx on public.quran_assignments (student_id);

drop trigger if exists quran_assignments_set_updated_at on public.quran_assignments;
create trigger quran_assignments_set_updated_at
  before update on public.quran_assignments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rotating six-year theme
-- -----------------------------------------------------------------------------
-- Six empty slots are created; administrators fill them in. Nothing is shown
-- publicly until a slot has a name and value and is marked active.
create table if not exists public.program_themes (
  id bigint generated always as identity primary key,
  cycle_position smallint not null unique check (cycle_position between 1 and 6),
  name text check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 600),
  main_value text check (char_length(main_value) <= 120),
  color_hex text check (color_hex ~ '^#[0-9a-f]{6}$'),
  is_active boolean not null default false,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_themes_active_needs_content check (not is_active or (name is not null and main_value is not null)),
  constraint program_themes_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create unique index if not exists program_themes_single_active on public.program_themes (is_active) where is_active;

insert into public.program_themes (cycle_position)
select generate_series(1, 6)
on conflict (cycle_position) do nothing;

drop trigger if exists program_themes_set_updated_at on public.program_themes;
create trigger program_themes_set_updated_at
  before update on public.program_themes
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rules enforced by triggers
-- -----------------------------------------------------------------------------
create or replace function private.validate_color_group_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.color_groups where id = new.color_group_id and is_active) then
    raise exception 'color_group_inactive' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.registrations
    where id = new.registration_id and status in ('withdrawn', 'rejected')
  ) then
    raise exception 'registration_inactive' using errcode = 'P0001';
  end if;
  new.assigned_at := now();
  new.assigned_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists color_group_assignments_validate on public.color_group_assignments;
create trigger color_group_assignments_validate
  before insert or update on public.color_group_assignments
  for each row execute function private.validate_color_group_assignment();

-- New active assignments need an active teacher who actively teaches the level.
create or replace function private.validate_quran_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and new.teacher_id is not null and (
    tg_op = 'INSERT'
    or new.teacher_id is distinct from old.teacher_id
    or new.quran_level_id is distinct from old.quran_level_id
  ) then
    if not exists (
      select 1
      from public.teacher_quran_levels tl
      join public.teachers t on t.id = tl.teacher_id
      where tl.teacher_id = new.teacher_id
        and tl.quran_level_id = new.quran_level_id
        and tl.is_active
        and t.is_active
    ) then
      raise exception 'teacher_not_available_for_level' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quran_assignments_validate on public.quran_assignments;
create trigger quran_assignments_validate
  before insert or update on public.quran_assignments
  for each row execute function private.validate_quran_assignment();

-- Withdrawn or rejected students leave their groups. Their Quran assignment
-- is closed (kept as history) rather than deleted.
create or replace function private.registrations_after_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('withdrawn', 'rejected') and old.status is distinct from new.status then
    delete from public.student_group_assignments where registration_id = new.id;
    delete from public.color_group_assignments where registration_id = new.id;
    update public.quran_assignments
    set status = 'ended', ended_on = greatest(current_date, started_on)
    where student_id = new.student_id and school_year_id = new.school_year_id and status = 'active';
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit logging for the new tables
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('color_groups', 'id'),
      ('color_group_assignments', 'registration_id'),
      ('teachers', 'id'),
      ('teacher_quran_levels', 'teacher_id,quran_level_id'),
      ('quran_assignments', 'id'),
      ('program_themes', 'id')
    ) as v(table_name, key_columns)
  loop
    execute format('drop trigger if exists audit_changes on public.%I', t.table_name);
    execute format(
      'create trigger audit_changes after insert or update or delete on public.%I
         for each row execute function private.audit_change(%s)',
      t.table_name,
      (select string_agg(quote_literal(k), ', ') from unnest(string_to_array(t.key_columns, ',')) k)
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registration RPC: now records gender and parent-reported Quran background.
-- (Same atomic workflow as before; see migration 20261014000200 for details.)
-- -----------------------------------------------------------------------------
create or replace function public.submit_family_registration(
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_grades constant text[] := array['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  c_levels constant text[] := array['beginner', 'intermediate', 'advanced'];
  c_genders constant text[] := array['male', 'female'];
  c_abilities constant text[] := array['not_started', 'learning_letters', 'reading_with_help', 'reading_fluently', 'memorizing'];
  c_relationships constant text[] := array['mother', 'father', 'parent', 'guardian', 'grandparent', 'other'];
  c_email_pattern constant text := '^[^@\s]+@[^@\s]+\.[^@\s]+$';

  v_existing jsonb;
  v_year record;
  v_primary jsonb := p_payload -> 'primaryGuardian';
  v_secondary jsonb := p_payload -> 'secondaryGuardian';
  v_emergency jsonb := p_payload -> 'emergencyContact';
  v_acknowledgments jsonb := p_payload -> 'acknowledgments';
  v_student jsonb;

  v_primary_first text := private.clean_text(v_primary ->> 'firstName');
  v_primary_last text := private.clean_text(v_primary ->> 'lastName');
  v_primary_email text := lower(private.clean_text(v_primary ->> 'email'));
  v_primary_phone text := private.clean_text(v_primary ->> 'phone');
  v_primary_relationship text := coalesce(private.clean_text(v_primary ->> 'relationship'), 'parent');
  v_emergency_name text := private.clean_text(v_emergency ->> 'name');
  v_emergency_phone text := private.clean_text(v_emergency ->> 'phone');
  v_emergency_relationship text := private.clean_text(v_emergency ->> 'relationship');

  v_secondary_first text;
  v_secondary_last text;
  v_secondary_email text;
  v_secondary_phone text;
  v_secondary_relationship text;

  v_parent record;
  v_household record;
  v_household_id bigint;
  v_household_is_new boolean := false;
  v_primary_id bigint;
  v_secondary_id bigint;
  v_primary_match_clean boolean := true;
  v_family_reasons text[] := '{}';

  v_first text;
  v_last text;
  v_dob date;
  v_grade text;
  v_level text;
  v_gender text;
  v_ability text;
  v_quran_notes text;
  v_studied boolean;
  v_returning boolean;
  v_notes text;
  v_seen text[] := '{}';
  v_reasons text[];
  v_student_id bigint;
  v_has_previous boolean;
  v_registration_id bigint;
  v_reference text;
  v_attempt integer;
  v_submission_id bigint;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if p_idempotency_key is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  -- Serialize retries of the same submission, then replay a finished one.
  perform pg_advisory_xact_lock(hashtextextended('registration:' || p_idempotency_key::text, 0));

  select result into v_existing
  from public.registration_submissions
  where idempotency_key = p_idempotency_key;

  if found then
    return v_existing || jsonb_build_object('replayed', true);
  end if;

  select id, label, default_amount_due into v_year
  from public.school_years
  where is_current and registration_open
  limit 1;

  if not found then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;

  -- ---- Structural validation (the server validates first; this is the last line of defence)
  if jsonb_typeof(v_primary) is distinct from 'object'
     or jsonb_typeof(p_payload -> 'students') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'students') not between 1 and 8
     or v_primary_first is null or char_length(v_primary_first) > 80
     or v_primary_last is null or char_length(v_primary_last) > 80
     or v_primary_email is null or char_length(v_primary_email) > 254 or v_primary_email !~ c_email_pattern
     or v_primary_phone is null or char_length(v_primary_phone) > 40
     or not (v_primary_relationship = any (c_relationships))
     or v_emergency_name is null or char_length(v_emergency_name) > 120
     or v_emergency_phone is null or char_length(v_emergency_phone) > 40
     or char_length(v_emergency_relationship) > 60
     or jsonb_typeof(v_acknowledgments) is distinct from 'object'
     or exists (select 1 from jsonb_each(v_acknowledgments) a where a.value is distinct from 'true'::jsonb)
     or not exists (select 1 from jsonb_each(v_acknowledgments))
  then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_secondary) = 'object' then
    v_secondary_first := private.clean_text(v_secondary ->> 'firstName');
    v_secondary_last := private.clean_text(v_secondary ->> 'lastName');
    v_secondary_email := lower(private.clean_text(v_secondary ->> 'email'));
    v_secondary_phone := private.clean_text(v_secondary ->> 'phone');
    v_secondary_relationship := coalesce(private.clean_text(v_secondary ->> 'relationship'), 'parent');

    if v_secondary_first is null or char_length(v_secondary_first) > 80
       or v_secondary_last is null or char_length(v_secondary_last) > 80
       or (v_secondary_email is not null and (v_secondary_email !~ c_email_pattern or char_length(v_secondary_email) > 254))
       or v_secondary_email = v_primary_email
       or char_length(v_secondary_phone) > 40
       or not (v_secondary_relationship = any (c_relationships))
    then
      raise exception 'invalid_payload' using errcode = 'P0001';
    end if;
  elsif v_secondary is not null and jsonb_typeof(v_secondary) <> 'null' then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  -- ---- Primary guardian (serialized per email to avoid duplicate inserts under concurrency)
  perform pg_advisory_xact_lock(hashtextextended('parent:' || v_primary_email, 0));

  select * into v_parent from public.parents where email_normalized = v_primary_email;

  if found then
    v_primary_id := v_parent.id;

    if lower(v_parent.first_name) <> lower(v_primary_first) or lower(v_parent.last_name) <> lower(v_primary_last) then
      v_primary_match_clean := false;
      v_family_reasons := array_append(v_family_reasons, 'guardian_details_differ');
    elsif v_parent.phone_normalized is distinct from nullif(regexp_replace(v_primary_phone, '\D', '', 'g'), '') then
      v_family_reasons := array_append(v_family_reasons, 'contact_details_differ');
    end if;

    v_household_id := v_parent.household_id;
    if v_household_id is null then
      insert into public.households (display_name)
      values (left(v_parent.last_name || ' family', 120))
      returning id into v_household_id;
      update public.parents set household_id = v_household_id where id = v_parent.id;
    end if;
  else
    insert into public.households (display_name, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship)
    values (left(v_primary_last || ' family', 120), v_emergency_name, v_emergency_phone, v_emergency_relationship)
    returning id into v_household_id;
    v_household_is_new := true;

    insert into public.parents (household_id, first_name, last_name, email, phone)
    values (v_household_id, v_primary_first, v_primary_last, v_primary_email, v_primary_phone)
    returning id into v_primary_id;
  end if;

  -- ---- Emergency contact: fill blanks on an existing household, never overwrite.
  if not v_household_is_new then
    select * into v_household from public.households where id = v_household_id for update;

    if v_household.emergency_contact_name is null and v_household.emergency_contact_phone is null then
      update public.households
      set emergency_contact_name = v_emergency_name,
          emergency_contact_phone = v_emergency_phone,
          emergency_contact_relationship = v_emergency_relationship
      where id = v_household_id;
    elsif lower(v_household.emergency_contact_name) is distinct from lower(v_emergency_name)
       or regexp_replace(coalesce(v_household.emergency_contact_phone, ''), '\D', '', 'g')
          is distinct from regexp_replace(v_emergency_phone, '\D', '', 'g')
    then
      if not ('contact_details_differ' = any (v_family_reasons)) then
        v_family_reasons := array_append(v_family_reasons, 'contact_details_differ');
      end if;
    end if;
  end if;

  -- ---- Optional second guardian
  if v_secondary_first is not null then
    if v_secondary_email is not null then
      perform pg_advisory_xact_lock(hashtextextended('parent:' || v_secondary_email, 0));
      select * into v_parent from public.parents where email_normalized = v_secondary_email;

      if found then
        v_secondary_id := v_parent.id;
        if lower(v_parent.first_name) <> lower(v_secondary_first) or lower(v_parent.last_name) <> lower(v_secondary_last) then
          if not ('guardian_details_differ' = any (v_family_reasons)) then
            v_family_reasons := array_append(v_family_reasons, 'guardian_details_differ');
          end if;
        end if;
        if v_parent.household_id is distinct from v_household_id then
          v_family_reasons := array_append(v_family_reasons, 'guardian_in_other_household');
        end if;
      end if;
    else
      select id into v_secondary_id
      from public.parents
      where household_id = v_household_id
        and lower(first_name) = lower(v_secondary_first)
        and lower(last_name) = lower(v_secondary_last)
        and id <> v_primary_id
      order by id
      limit 1;
    end if;

    if v_secondary_id is null then
      insert into public.parents (household_id, first_name, last_name, email, phone)
      values (v_household_id, v_secondary_first, v_secondary_last, v_secondary_email, v_secondary_phone)
      returning id into v_secondary_id;
    end if;
  end if;

  -- ---- Submission record (results are filled in at the end)
  insert into public.registration_submissions (idempotency_key, household_id, primary_parent_id, submitted_contact)
  values (
    p_idempotency_key,
    v_household_id,
    v_primary_id,
    jsonb_strip_nulls(jsonb_build_object(
      'primaryGuardian', jsonb_build_object(
        'firstName', v_primary_first, 'lastName', v_primary_last, 'email', v_primary_email,
        'phone', v_primary_phone, 'relationship', v_primary_relationship),
      'secondaryGuardian', case when v_secondary_first is not null then jsonb_build_object(
        'firstName', v_secondary_first, 'lastName', v_secondary_last, 'email', v_secondary_email,
        'phone', v_secondary_phone, 'relationship', v_secondary_relationship) end,
      'emergencyContact', jsonb_build_object(
        'name', v_emergency_name, 'phone', v_emergency_phone, 'relationship', v_emergency_relationship)
    ))
  )
  returning id into v_submission_id;

  -- ---- Students and registrations
  for v_student in select value from jsonb_array_elements(p_payload -> 'students') loop
    v_first := private.clean_text(v_student ->> 'firstName');
    v_last := private.clean_text(v_student ->> 'lastName');
    v_grade := v_student ->> 'grade';
    v_level := nullif(v_student ->> 'arabicLevel', '');
    v_notes := private.clean_multiline(v_student ->> 'specialConsiderations');
    v_gender := v_student ->> 'gender';
    v_ability := v_student ->> 'quranAbility';
    v_quran_notes := private.clean_multiline(v_student ->> 'quranNotes');

    if jsonb_typeof(v_student) is distinct from 'object'
       or v_first is null or char_length(v_first) > 80
       or v_last is null or char_length(v_last) > 80
       or coalesce(v_student ->> 'dateOfBirth', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or not (coalesce(v_grade, '') = any (c_grades))
       or (v_level is not null and not (v_level = any (c_levels)))
       or jsonb_typeof(v_student -> 'studiedArabicBefore') is distinct from 'boolean'
       or jsonb_typeof(v_student -> 'isReturning') is distinct from 'boolean'
       or char_length(v_notes) > 1000
       or not (coalesce(v_gender, '') = any (c_genders))
       or not (coalesce(v_ability, '') = any (c_abilities))
       or char_length(v_quran_notes) > 1000
    then
      raise exception 'invalid_payload' using errcode = 'P0001';
    end if;

    begin
      v_dob := (v_student ->> 'dateOfBirth')::date;
    exception when others then
      raise exception 'invalid_payload' using errcode = 'P0001';
    end;

    if v_dob > current_date or v_dob < current_date - interval '25 years' then
      raise exception 'invalid_payload' using errcode = 'P0001';
    end if;

    v_studied := (v_student ->> 'studiedArabicBefore')::boolean;
    v_returning := (v_student ->> 'isReturning')::boolean;

    if (lower(v_first) || '|' || lower(v_last) || '|' || v_dob::text) = any (v_seen) then
      raise exception 'duplicate_student_in_submission' using errcode = 'P0001';
    end if;
    v_seen := array_append(v_seen, lower(v_first) || '|' || lower(v_last) || '|' || v_dob::text);

    v_reasons := v_family_reasons;
    v_student_id := null;

    if v_primary_match_clean and not v_household_is_new then
      select id into v_student_id
      from public.students
      where household_id = v_household_id
        and lower(first_name) = lower(v_first)
        and lower(last_name) = lower(v_last)
        and date_of_birth = v_dob
      order by id
      limit 1
      for update;
    end if;

    if v_student_id is not null then
      if exists (
        select 1 from public.registrations
        where student_id = v_student_id and school_year_id = v_year.id
      ) then
        raise exception 'duplicate_registration' using errcode = 'P0001';
      end if;

      select exists (select 1 from public.registrations where student_id = v_student_id)
      into v_has_previous;

      if v_returning and not v_has_previous then
        v_reasons := array_append(v_reasons, 'returning_student_not_matched');
      end if;
      v_returning := v_returning or v_has_previous;

      update public.students
      set grade = v_grade,
          arabic_level = coalesce(v_level, arabic_level),
          studied_arabic_before = v_studied,
          gender = v_gender
      where id = v_student_id;

      if v_notes is not null then
        insert into public.student_health_notes (student_id, special_considerations)
        values (v_student_id, v_notes)
        on conflict (student_id) do update set special_considerations = excluded.special_considerations;
      end if;
    else
      if v_returning then
        v_reasons := array_append(v_reasons, 'returning_student_not_matched');
      end if;

      if exists (
        select 1 from public.students
        where lower(first_name) = lower(v_first)
          and lower(last_name) = lower(v_last)
          and date_of_birth = v_dob
      ) then
        v_reasons := array_append(v_reasons, 'possible_duplicate_student');
      end if;

      insert into public.students (household_id, first_name, last_name, date_of_birth, grade, arabic_level, studied_arabic_before, gender)
      values (v_household_id, v_first, v_last, v_dob, v_grade, v_level, v_studied, v_gender)
      returning id into v_student_id;

      if v_notes is not null then
        insert into public.student_health_notes (student_id, special_considerations)
        values (v_student_id, v_notes);
      end if;
    end if;

    insert into public.student_parents (student_id, parent_id, relationship, is_primary_contact)
    values (v_student_id, v_primary_id, v_primary_relationship, true)
    on conflict (student_id, parent_id) do nothing;

    if v_secondary_id is not null then
      insert into public.student_parents (student_id, parent_id, relationship, is_primary_contact)
      values (v_student_id, v_secondary_id, v_secondary_relationship, false)
      on conflict (student_id, parent_id) do nothing;
    end if;

    -- Random reference code; retry on the (very unlikely) collision.
    v_attempt := 0;
    loop
      v_attempt := v_attempt + 1;
      v_reference := 'NKC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      begin
        insert into public.registrations (
          student_id, school_year_id, reference_code, grade, is_returning, status,
          submission_id, needs_review, review_reasons, acknowledgments, acknowledged_at, amount_due,
          reported_quran_ability, quran_background_notes
        )
        values (
          v_student_id, v_year.id, v_reference, v_grade, v_returning, 'pending',
          v_submission_id, cardinality(v_reasons) > 0, v_reasons,
          v_acknowledgments || jsonb_build_object('_version', coalesce(left(p_payload ->> 'consentVersion', 40), 'unknown')),
          now(), v_year.default_amount_due,
          v_ability, v_quran_notes
        )
        returning id into v_registration_id;
        exit;
      exception when unique_violation then
        if exists (
          select 1 from public.registrations
          where student_id = v_student_id and school_year_id = v_year.id
        ) then
          raise exception 'duplicate_registration' using errcode = 'P0001';
        end if;
        if v_attempt >= 5 then
          raise;
        end if;
      end;
    end loop;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'referenceCode', v_reference,
      'studentFirstName', v_first
    ));
  end loop;

  v_result := jsonb_build_object(
    'schoolYear', v_year.label,
    'registrations', v_results
  );

  update public.registration_submissions set result = v_result where id = v_submission_id;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin: change a student's Quran level and/or teacher for a school year.
-- Closes the current assignment (kept as history) and opens a new one in one
-- transaction. Passing a NULL level ends the current assignment.
-- SECURITY INVOKER: the caller's RLS permissions apply.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_quran_assignment(
  p_student_id bigint,
  p_school_year_id bigint,
  p_quran_level_id smallint,
  p_teacher_id bigint,
  p_note text default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current record;
  v_has_current boolean;
  v_new_id bigint;
  v_note text := private.clean_multiline(p_note);
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_teacher_id is not null and p_quran_level_id is null then
    raise exception 'teacher_requires_level' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.registrations
    where student_id = p_student_id
      and school_year_id = p_school_year_id
      and status not in ('withdrawn', 'rejected')
  ) then
    raise exception 'no_active_registration' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('quran:' || p_student_id || ':' || p_school_year_id, 0));

  select * into v_current
  from public.quran_assignments
  where student_id = p_student_id and school_year_id = p_school_year_id and status = 'active'
  for update;
  v_has_current := found;

  if v_has_current
     and v_current.quran_level_id = p_quran_level_id
     and v_current.teacher_id is not distinct from p_teacher_id then
    if v_note is not null and v_note is distinct from v_current.note then
      update public.quran_assignments set note = v_note where id = v_current.id;
    end if;
    return v_current.id;
  end if;

  if v_has_current then
    update public.quran_assignments
    set status = 'ended', ended_on = greatest(current_date, started_on)
    where id = v_current.id;
  end if;

  if p_quran_level_id is null then
    return null;
  end if;

  insert into public.quran_assignments (student_id, school_year_id, quran_level_id, teacher_id, note)
  values (p_student_id, p_school_year_id, p_quran_level_id, p_teacher_id, v_note)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- Assign several students to the same level/teacher in one transaction.
create or replace function public.admin_bulk_set_quran_assignment(
  p_student_ids bigint[],
  p_school_year_id bigint,
  p_quran_level_id smallint,
  p_teacher_id bigint
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student_id bigint;
  v_count integer := 0;
begin
  if cardinality(p_student_ids) is null or cardinality(p_student_ids) > 200 then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;
  foreach v_student_id in array p_student_ids loop
    perform public.admin_set_quran_assignment(v_student_id, p_school_year_id, p_quran_level_id, p_teacher_id, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Admin: make one theme the active theme (or none, with NULL).
create or replace function public.admin_set_active_theme(p_theme_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_full_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.program_themes set is_active = false where is_active and id is distinct from p_theme_id;
  if p_theme_id is not null then
    update public.program_themes set is_active = true where id = p_theme_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

-- Public: the active theme, only once it has real content.
create or replace function public.get_active_theme()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', name,
    'description', description,
    'mainValue', main_value,
    'colorHex', color_hex,
    'cyclePosition', cycle_position
  )
  from public.program_themes
  where is_active
    and name is not null
    and main_value is not null
    and (starts_on is null or starts_on <= current_date)
    and (ends_on is null or ends_on >= current_date)
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Dashboard read model (security_invoker: the caller's RLS applies)
-- -----------------------------------------------------------------------------
drop view if exists public.admin_registration_list;
drop view if exists public.admin_group_overview;

create view public.admin_registration_list
with (security_invoker = true)
as
select
  r.id as registration_id,
  r.reference_code,
  r.school_year_id,
  sy.label as school_year,
  r.status,
  (r.status not in ('withdrawn', 'rejected')) as is_active,
  r.payment_status,
  r.amount_due,
  coalesce(pay.amount_paid, 0)::numeric(10, 2) as amount_paid,
  r.grade,
  array_position(array['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], r.grade) as grade_rank,
  r.is_returning,
  r.needs_review,
  r.reported_quran_ability,
  r.registered_at,
  r.updated_at,
  s.id as student_id,
  s.first_name as student_first_name,
  s.last_name as student_last_name,
  s.date_of_birth,
  s.gender,
  s.studied_arabic_before,
  s.household_id,
  cga.color_group_id,
  cg.name as color_group_name,
  cg.slug as color_group_slug,
  cg.color_hex as color_group_color,
  cg.text_color_hex as color_group_text_color,
  qa.id as quran_assignment_id,
  qa.quran_level_id,
  ql.name as quran_level_name,
  ql.sort_order as quran_level_sort,
  qa.teacher_id,
  t.full_name as teacher_name,
  pg.id as guardian_id,
  pg.first_name as guardian_first_name,
  pg.last_name as guardian_last_name,
  pg.email as guardian_email,
  pg.phone as guardian_phone,
  lower(concat_ws(' ', s.first_name, s.last_name, guardians.names, guardians.emails, r.reference_code)) as search_text
from public.registrations r
join public.students s on s.id = r.student_id
join public.school_years sy on sy.id = r.school_year_id
left join public.color_group_assignments cga on cga.registration_id = r.id
left join public.color_groups cg on cg.id = cga.color_group_id
left join public.quran_assignments qa
  on qa.student_id = r.student_id and qa.school_year_id = r.school_year_id and qa.status = 'active'
left join public.quran_levels ql on ql.id = qa.quran_level_id
left join public.teachers t on t.id = qa.teacher_id
left join lateral (
  select sum(p.amount) as amount_paid from public.payments p where p.registration_id = r.id
) pay on true
left join lateral (
  select pa.id, pa.first_name, pa.last_name, pa.email, pa.phone
  from public.student_parents sp
  join public.parents pa on pa.id = sp.parent_id
  where sp.student_id = s.id
  order by sp.is_primary_contact desc, pa.id
  limit 1
) pg on true
left join lateral (
  select string_agg(pa.first_name || ' ' || pa.last_name, ' ') as names,
         string_agg(pa.email, ' ') as emails
  from public.student_parents sp
  join public.parents pa on pa.id = sp.parent_id
  where sp.student_id = s.id
) guardians on true;

-- -----------------------------------------------------------------------------
-- Dashboard summary for one school year (active registrations only, except
-- the status breakdown, which covers every registration).
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_school_year_id bigint)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with r as (
    select
      reg.*,
      cga.color_group_id,
      cg.slug as color_group_slug,
      qa.quran_level_id,
      qa.teacher_id,
      (reg.status not in ('withdrawn', 'rejected')) as active
    from public.registrations reg
    left join public.color_group_assignments cga on cga.registration_id = reg.id
    left join public.color_groups cg on cg.id = cga.color_group_id
    left join public.quran_assignments qa
      on qa.student_id = reg.student_id and qa.school_year_id = reg.school_year_id and qa.status = 'active'
    where reg.school_year_id = p_school_year_id
  )
  select jsonb_build_object(
    'totalRegistrations', count(*),
    'activeStudents', count(distinct student_id) filter (where active),
    'newStudents', count(*) filter (where active and not is_returning),
    'returningStudents', count(*) filter (where active and is_returning),
    'pending', count(*) filter (where status in ('pending', 'under_review')),
    'needsReview', count(*) filter (where needs_review and status in ('pending', 'under_review')),
    'registeredLast7Days', count(*) filter (where registered_at > now() - interval '7 days'),
    'unassignedColorGroup', count(*) filter (where active and color_group_id is null),
    'unassignedQuranLevel', count(*) filter (where active and quran_level_id is null),
    'levelWithoutTeacher', count(*) filter (where active and quran_level_id is not null and teacher_id is null),
    'byStatus', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) as n from r group by status) x),
    'byPaymentStatus', (select coalesce(jsonb_object_agg(payment_status, n), '{}'::jsonb) from (select payment_status, count(*) as n from r where active group by payment_status) x),
    'byColorGroup', (select coalesce(jsonb_object_agg(color_group_slug, n), '{}'::jsonb) from (select color_group_slug, count(*) as n from r where active and color_group_slug is not null group by 1) x),
    'byQuranLevel', (select coalesce(jsonb_object_agg(quran_level_id::text, n), '{}'::jsonb) from (select quran_level_id, count(*) as n from r where active and quran_level_id is not null group by 1) x),
    'teacherRosters', (
      select coalesce(jsonb_agg(jsonb_build_object('teacherId', x.teacher_id, 'teacherName', t.full_name, 'quranLevelId', x.quran_level_id, 'count', x.n) order by x.quran_level_id desc, t.full_name), '[]'::jsonb)
      from (select teacher_id, quran_level_id, count(*) as n from r where active and teacher_id is not null group by 1, 2) x
      join public.teachers t on t.id = x.teacher_id
    )
  )
  into v_result
  from r;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security for the new tables
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'color_groups', 'color_group_assignments', 'quran_levels', 'teachers',
    'teacher_quran_levels', 'quran_assignments', 'program_themes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy "Admins can read" on public.%I for select to authenticated using ((select private.is_admin()))', t);
  end loop;
end;
$$;

-- Any admin may configure color-group criteria and manage assignments/teachers.
create policy "Admins can update" on public.color_groups
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Admins can insert" on public.color_group_assignments
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update" on public.color_group_assignments
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete" on public.color_group_assignments
  for delete to authenticated using ((select private.is_admin()));

create policy "Admins can insert" on public.teachers
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update" on public.teachers
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
-- No delete policy: teachers are deactivated so their history is kept.

create policy "Admins can insert" on public.teacher_quran_levels
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update" on public.teacher_quran_levels
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
-- Removing a teacher-level link fails (foreign key) once any assignment uses it.
create policy "Admins can delete" on public.teacher_quran_levels
  for delete to authenticated using ((select private.is_admin()));

create policy "Admins can insert" on public.quran_assignments
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update" on public.quran_assignments
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
-- No delete policy: assignment history is permanent.

create policy "Full admins can update" on public.program_themes
  for update to authenticated using ((select private.is_full_admin())) with check ((select private.is_full_admin()));

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on
  public.color_groups, public.color_group_assignments, public.quran_levels, public.teachers,
  public.teacher_quran_levels, public.quran_assignments, public.program_themes, public.admin_registration_list
  to authenticated;
grant all on
  public.color_groups, public.color_group_assignments, public.quran_levels, public.teachers,
  public.teacher_quran_levels, public.quran_assignments, public.program_themes, public.admin_registration_list
  to service_role;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

revoke all on function public.submit_family_registration(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.submit_family_registration(jsonb, uuid) to service_role;

revoke all on function public.admin_set_quran_assignment(bigint, bigint, smallint, bigint, text) from public, anon;
revoke all on function public.admin_bulk_set_quran_assignment(bigint[], bigint, smallint, bigint) from public, anon;
revoke all on function public.admin_set_active_theme(bigint) from public, anon;
grant execute on function public.admin_set_quran_assignment(bigint, bigint, smallint, bigint, text) to authenticated, service_role;
grant execute on function public.admin_bulk_set_quran_assignment(bigint[], bigint, smallint, bigint) to authenticated, service_role;
grant execute on function public.admin_set_active_theme(bigint) to authenticated, service_role;

revoke all on function public.get_active_theme() from public;
grant execute on function public.get_active_theme() to anon, authenticated, service_role;
