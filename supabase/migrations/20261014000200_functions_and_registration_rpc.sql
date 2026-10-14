-- =============================================================================
-- Functions and triggers:
--   * admin authorization helpers used by RLS policies
--   * audit logging of administrative changes
--   * registration status / payment status bookkeeping
--   * group assignment rules (same school year, capacity)
--   * submit_family_registration: the atomic public registration workflow
--   * consume_registration_rate_limit: abuse protection
--   * get_open_school_year: the only school data the public can read
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Authorization helpers
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so they can read admin_profiles regardless of the caller's
-- own RLS visibility. They only ever answer about the *current* user.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and is_active
  );
$$;

-- Full administrators (role = 'admin') may also read health notes, manage
-- school years and delete payments.
create or replace function private.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and is_active and role = 'admin'
  );
$$;

-- Collapses internal whitespace and turns blank strings into NULL.
create or replace function private.clean_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'), '');
$$;

-- Like clean_text but keeps line breaks (for free-text notes).
create or replace function private.clean_multiline(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(coalesce(p_value, ''), '[ \t]+', ' ', 'g')), '');
$$;

-- -----------------------------------------------------------------------------
-- Audit logging
-- -----------------------------------------------------------------------------
-- Records INSERT/UPDATE/DELETE made by a signed-in user (auth.uid() is set).
-- Changes made by the public registration RPC (service role, no user) are not
-- audited here; they are traceable through registration_submissions instead.
-- TG_ARGV lists the primary-key column(s) of the audited table.
-- Values from student_health_notes are never copied into the audit log.
create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changed text[];
  v_record_id text;
  v_key text;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('UPDATE', 'INSERT') then
    v_new := to_jsonb(new);
  end if;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key)
    into v_changed
    from jsonb_each(v_new) n
    where n.key not in ('updated_at')
      and n.value is distinct from v_old -> n.key;

    if v_changed is null then
      return new;
    end if;

    select jsonb_object_agg(k, v_old -> k) into v_old from unnest(v_changed) k;
    select jsonb_object_agg(k, v_new -> k) into v_new from unnest(v_changed) k;
  end if;

  if tg_table_name = 'student_health_notes' then
    v_old := null;
    v_new := null;
  end if;

  foreach v_key in array tg_argv loop
    v_record_id := concat_ws(':', v_record_id, v_row ->> v_key);
  end loop;

  insert into public.audit_logs (actor_id, action, table_name, record_id, changed_fields, old_values, new_values)
  values (v_actor, lower(tg_op), tg_table_name, coalesce(v_record_id, '?'), v_changed, v_old, v_new);

  return coalesce(new, old);
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('households', 'id'),
      ('parents', 'id'),
      ('students', 'id'),
      ('student_parents', 'student_id,parent_id'),
      ('student_health_notes', 'student_id'),
      ('school_years', 'id'),
      ('groups', 'id'),
      ('registrations', 'id'),
      ('student_group_assignments', 'registration_id'),
      ('payments', 'id'),
      ('admin_notes', 'id'),
      ('admin_profiles', 'user_id')
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
-- Registration status and payment bookkeeping
-- -----------------------------------------------------------------------------
-- Payment status is derived from the payment ledger and the amount due, except
-- 'waived' (scholarship/fee waiver), which an administrator sets explicitly.
create or replace function private.compute_payment_status(p_amount_paid numeric, p_amount_due numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_amount_paid, 0) <= 0 then 'not_paid'
    when p_amount_due is not null and p_amount_paid >= p_amount_due then 'paid'
    else 'partially_paid'
  end;
$$;

create or replace function private.registrations_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;

  if new.payment_status <> 'waived' then
    new.payment_status := private.compute_payment_status(
      (select coalesce(sum(amount), 0) from public.payments where registration_id = new.id),
      new.amount_due
    );
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_before_update on public.registrations;
create trigger registrations_before_update
  before update on public.registrations
  for each row execute function private.registrations_before_update();

-- A withdrawn or rejected student no longer occupies a seat in their group.
create or replace function private.registrations_after_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('withdrawn', 'rejected') and old.status is distinct from new.status then
    delete from public.student_group_assignments where registration_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists registrations_after_status_change on public.registrations;
create trigger registrations_after_status_change
  after update of status on public.registrations
  for each row execute function private.registrations_after_status_change();

-- Recalculate the registration's payment status whenever the ledger changes.
create or replace function private.payments_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Touching the row fires registrations_before_update, which recomputes
  -- payment_status from the ledger.
  if tg_op in ('INSERT', 'UPDATE') then
    update public.registrations set updated_at = now() where id = new.registration_id;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    update public.registrations set updated_at = now() where id = old.registration_id;
  end if;
  return null;
end;
$$;

drop trigger if exists payments_after_change on public.payments;
create trigger payments_after_change
  after insert or update or delete on public.payments
  for each row execute function private.payments_after_change();

create or replace function private.payments_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recorded_by := coalesce(new.recorded_by, auth.uid());
  return new;
end;
$$;

drop trigger if exists payments_before_insert on public.payments;
create trigger payments_before_insert
  before insert on public.payments
  for each row execute function private.payments_before_insert();

-- -----------------------------------------------------------------------------
-- Group assignment rules
-- -----------------------------------------------------------------------------
create or replace function private.validate_group_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
  v_registration_year bigint;
  v_enrolled integer;
begin
  -- Lock the group row so concurrent assignments cannot exceed capacity.
  select id, school_year_id, capacity into v_group
  from public.groups where id = new.group_id
  for update;

  select school_year_id into v_registration_year
  from public.registrations where id = new.registration_id;

  if v_group.school_year_id is distinct from v_registration_year then
    raise exception 'group_year_mismatch' using errcode = 'P0001';
  end if;

  select count(*) into v_enrolled
  from public.student_group_assignments
  where group_id = new.group_id
    and registration_id <> new.registration_id;

  if v_enrolled >= v_group.capacity then
    raise exception 'group_full' using errcode = 'P0001';
  end if;

  new.assigned_at := now();
  new.assigned_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists student_group_assignments_validate on public.student_group_assignments;
create trigger student_group_assignments_validate
  before insert or update on public.student_group_assignments
  for each row execute function private.validate_group_assignment();

create or replace function private.health_notes_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists student_health_notes_before_write on public.student_health_notes;
create trigger student_health_notes_before_write
  before insert or update on public.student_health_notes
  for each row execute function private.health_notes_before_write();

-- -----------------------------------------------------------------------------
-- Public: the currently open registration year (label only)
-- -----------------------------------------------------------------------------
create or replace function public.get_open_school_year()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('label', label)
  from public.school_years
  where is_current and registration_open
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Abuse protection: fixed-window counter keyed by a hashed client identifier.
-- Returns true when the request is allowed.
-- -----------------------------------------------------------------------------
create or replace function public.consume_registration_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_key_hash is null or char_length(p_key_hash) < 16 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.registration_rate_limits as rl (key_hash, window_start)
  values (p_key_hash, v_window)
  on conflict (key_hash, window_start)
  do update set request_count = rl.request_count + 1
  returning request_count into v_count;

  delete from public.registration_rate_limits where window_start < now() - interval '1 day';

  return v_count <= p_limit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Atomic family registration
-- -----------------------------------------------------------------------------
-- Called only by the server (service role) after it has validated the payload.
-- Everything happens in one transaction: either every child is registered or
-- nothing is written.
--
-- Matching rules (never silently merge when identity is uncertain):
--   * Guardians are matched by normalized email. A match is reused but its
--     stored details are never overwritten by a public submission. If the
--     submitted name differs, the registration is flagged for review.
--   * A secondary guardian without email is reused only when a guardian with
--     the same name already exists in the same household.
--   * A child is reused only when the primary guardian matched cleanly AND a
--     child with the same name and date of birth exists in that household.
--     Otherwise a new student record is created and possible duplicates are
--     flagged for an administrator to reconcile.
--
-- Errors are raised with stable machine-readable messages that the server maps
-- to friendly text: registration_closed, invalid_payload,
-- duplicate_student_in_submission, duplicate_registration.
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

    if jsonb_typeof(v_student) is distinct from 'object'
       or v_first is null or char_length(v_first) > 80
       or v_last is null or char_length(v_last) > 80
       or coalesce(v_student ->> 'dateOfBirth', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or not (coalesce(v_grade, '') = any (c_grades))
       or (v_level is not null and not (v_level = any (c_levels)))
       or jsonb_typeof(v_student -> 'studiedArabicBefore') is distinct from 'boolean'
       or jsonb_typeof(v_student -> 'isReturning') is distinct from 'boolean'
       or char_length(v_notes) > 1000
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
          studied_arabic_before = v_studied
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

      insert into public.students (household_id, first_name, last_name, date_of_birth, grade, arabic_level, studied_arabic_before)
      values (v_household_id, v_first, v_last, v_dob, v_grade, v_level, v_studied)
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
          submission_id, needs_review, review_reasons, acknowledgments, acknowledged_at, amount_due
        )
        values (
          v_student_id, v_year.id, v_reference, v_grade, v_returning, 'pending',
          v_submission_id, cardinality(v_reasons) > 0, v_reasons,
          v_acknowledgments || jsonb_build_object('_version', coalesce(left(p_payload ->> 'consentVersion', 40), 'unknown')),
          now(), v_year.default_amount_due
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
-- Admin: add a guardian to a household and link them to its children.
-- SECURITY INVOKER: runs with the caller's RLS permissions.
-- -----------------------------------------------------------------------------
create or replace function public.admin_add_guardian(
  p_household_id bigint,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_relationship text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent_id bigint;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.households where id = p_household_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.parents (household_id, first_name, last_name, email, phone)
  values (
    p_household_id,
    private.clean_text(p_first_name),
    private.clean_text(p_last_name),
    lower(private.clean_text(p_email)),
    private.clean_text(p_phone)
  )
  returning id into v_parent_id;

  insert into public.student_parents (student_id, parent_id, relationship, is_primary_contact)
  select s.id, v_parent_id, p_relationship, false
  from public.students s
  where s.household_id = p_household_id;

  return v_parent_id;
end;
$$;
