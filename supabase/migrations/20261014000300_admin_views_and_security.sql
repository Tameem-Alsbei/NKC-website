-- =============================================================================
-- Admin read models, Row Level Security and privileges.
--
-- Access model:
--   anon (public website)    -> no table access at all. May only call
--                               get_open_school_year().
--   authenticated, no admin  -> no rows visible anywhere (RLS), except their
--   profile                     own admin_profiles row if one exists.
--   staff (admin_profiles)   -> read/manage families, students, registrations,
--                               groups, payments, notes. NO health notes.
--   admin (admin_profiles)   -> everything staff can do + health notes,
--                               school years, deleting payments/groups.
--   service_role (server)    -> bypasses RLS. Used only by the server for the
--                               public registration RPC and rate limiting.
--
-- All pre-existing policies on these tables are dropped first so that the
-- resulting access rules are exactly the ones written here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Read models for the dashboard (security_invoker: the caller's RLS applies)
-- -----------------------------------------------------------------------------
create or replace view public.admin_registration_list
with (security_invoker = true)
as
select
  r.id as registration_id,
  r.reference_code,
  r.school_year_id,
  sy.label as school_year,
  r.status,
  r.payment_status,
  r.amount_due,
  coalesce(pay.amount_paid, 0)::numeric(10, 2) as amount_paid,
  r.grade,
  array_position(array['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], r.grade) as grade_rank,
  r.is_returning,
  r.needs_review,
  r.registered_at,
  r.updated_at,
  s.id as student_id,
  s.first_name as student_first_name,
  s.last_name as student_last_name,
  s.date_of_birth,
  s.arabic_level,
  s.studied_arabic_before,
  s.household_id,
  sga.group_id,
  g.name as group_name,
  pg.id as guardian_id,
  pg.first_name as guardian_first_name,
  pg.last_name as guardian_last_name,
  pg.email as guardian_email,
  pg.phone as guardian_phone,
  lower(concat_ws(' ', s.first_name, s.last_name, guardians.names, guardians.emails, r.reference_code)) as search_text
from public.registrations r
join public.students s on s.id = r.student_id
join public.school_years sy on sy.id = r.school_year_id
left join public.student_group_assignments sga on sga.registration_id = r.id
left join public.groups g on g.id = sga.group_id
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

create or replace view public.admin_group_overview
with (security_invoker = true)
as
select
  g.id,
  g.name,
  g.school_year_id,
  sy.label as school_year,
  g.minimum_grade,
  g.maximum_grade,
  g.arabic_level,
  g.teacher_name,
  g.capacity,
  g.notes,
  g.created_at,
  g.updated_at,
  (select count(*) from public.student_group_assignments a where a.group_id = g.id)::integer as enrolled_count
from public.groups g
join public.school_years sy on sy.id = g.school_year_id;

create or replace view public.admin_family_list
with (security_invoker = true)
as
select
  h.id,
  h.display_name,
  h.created_at,
  h.updated_at,
  (select count(*) from public.students s where s.household_id = h.id)::integer as children_count,
  guardians.names as guardian_names,
  guardians.emails as guardian_emails,
  guardians.phones as guardian_phones,
  children.names as children_names,
  lower(concat_ws(' ', h.display_name, guardians.names, guardians.emails, children.names)) as search_text
from public.households h
left join lateral (
  select string_agg(p.first_name || ' ' || p.last_name, ', ' order by p.id) as names,
         string_agg(p.email, ', ' order by p.id) as emails,
         string_agg(p.phone, ', ' order by p.id) as phones
  from public.parents p
  where p.household_id = h.id
) guardians on true
left join lateral (
  select string_agg(s.first_name || ' ' || s.last_name, ', ' order by s.date_of_birth) as names
  from public.students s
  where s.household_id = h.id
) children on true;

-- -----------------------------------------------------------------------------
-- Dashboard summary for one school year
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
    select reg.*, s.arabic_level, (sga.registration_id is not null) as is_assigned
    from public.registrations reg
    join public.students s on s.id = reg.student_id
    left join public.student_group_assignments sga on sga.registration_id = reg.id
    where reg.school_year_id = p_school_year_id
  )
  select jsonb_build_object(
    'totalRegistrations', count(*),
    'totalStudents', count(distinct student_id),
    'newStudents', count(*) filter (where not is_returning),
    'returningStudents', count(*) filter (where is_returning),
    'needsReview', count(*) filter (where needs_review and status in ('pending', 'under_review')),
    'registeredLast7Days', count(*) filter (where registered_at > now() - interval '7 days'),
    'unassigned', count(*) filter (where not is_assigned and status not in ('withdrawn', 'rejected')),
    'byStatus', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) as n from r group by status) x),
    'byPaymentStatus', (select coalesce(jsonb_object_agg(payment_status, n), '{}'::jsonb) from (select payment_status, count(*) as n from r where status not in ('withdrawn', 'rejected') group by payment_status) x),
    'byGrade', (select coalesce(jsonb_object_agg(grade, n), '{}'::jsonb) from (select grade, count(*) as n from r where status not in ('withdrawn', 'rejected') group by grade) x),
    'byArabicLevel', (select coalesce(jsonb_object_agg(level, n), '{}'::jsonb) from (select coalesce(arabic_level, 'unknown') as level, count(*) as n from r where status not in ('withdrawn', 'rejected') group by 1) x)
  )
  into v_result
  from r;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'school_years', 'households', 'parents', 'students', 'student_parents',
    'student_health_notes', 'groups', 'registration_submissions', 'registrations',
    'student_group_assignments', 'payments', 'admin_profiles', 'admin_notes',
    'audit_logs', 'registration_rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end;
$$;

-- Tables any active admin (staff or admin) can read, create and update.
do $$
declare
  t text;
begin
  foreach t in array array[
    'households', 'parents', 'students', 'student_parents', 'groups',
    'registrations', 'student_group_assignments'
  ] loop
    execute format('create policy "Admins can read" on public.%I for select to authenticated using ((select private.is_admin()))', t);
    execute format('create policy "Admins can insert" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can update" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end;
$$;

-- Removing a guardian link or a group assignment is a normal admin task.
create policy "Admins can delete" on public.student_parents
  for delete to authenticated using ((select private.is_admin()));
create policy "Admins can delete" on public.student_group_assignments
  for delete to authenticated using ((select private.is_admin()));
-- Deleting a group (only possible when it is empty) requires a full admin.
create policy "Full admins can delete" on public.groups
  for delete to authenticated using ((select private.is_full_admin()));
-- Students, parents, households and registrations have no DELETE policy:
-- records are withdrawn/updated, never deleted from the dashboard.

-- School years: all admins read; full admins manage.
create policy "Admins can read" on public.school_years
  for select to authenticated using ((select private.is_admin()));
create policy "Full admins can insert" on public.school_years
  for insert to authenticated with check ((select private.is_full_admin()));
create policy "Full admins can update" on public.school_years
  for update to authenticated using ((select private.is_full_admin())) with check ((select private.is_full_admin()));

-- Payments: any admin can read and record; only full admins correct or delete.
create policy "Admins can read" on public.payments
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can insert" on public.payments
  for insert to authenticated with check ((select private.is_admin()));
create policy "Full admins can update" on public.payments
  for update to authenticated using ((select private.is_full_admin())) with check ((select private.is_full_admin()));
create policy "Full admins can delete" on public.payments
  for delete to authenticated using ((select private.is_full_admin()));

-- Health / special-consideration notes: strictest access, full admins only.
create policy "Full admins can read" on public.student_health_notes
  for select to authenticated using ((select private.is_full_admin()));
create policy "Full admins can insert" on public.student_health_notes
  for insert to authenticated with check ((select private.is_full_admin()));
create policy "Full admins can update" on public.student_health_notes
  for update to authenticated using ((select private.is_full_admin())) with check ((select private.is_full_admin()));
create policy "Full admins can delete" on public.student_health_notes
  for delete to authenticated using ((select private.is_full_admin()));

-- Internal notes: admins read and write their own; authors or full admins delete.
create policy "Admins can read" on public.admin_notes
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can insert own" on public.admin_notes
  for insert to authenticated with check ((select private.is_admin()) and author_id = (select auth.uid()));
create policy "Authors or full admins can delete" on public.admin_notes
  for delete to authenticated using (
    (select private.is_admin()) and (author_id = (select auth.uid()) or (select private.is_full_admin()))
  );

-- Admin profiles: a user may read their own row; admins can read the team.
-- No write policies: profiles are managed with SQL by the project owner.
create policy "Users read own profile, admins read all" on public.admin_profiles
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Audit log and submissions: read-only for admins; written by triggers/RPC.
create policy "Admins can read" on public.audit_logs
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can read" on public.registration_submissions
  for select to authenticated using ((select private.is_admin()));

-- registration_rate_limits: no policies (service role only).

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
-- The publishable (anon) key gets no direct table access whatsoever.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on
  public.audit_logs, public.registration_submissions, public.registration_rate_limits, public.admin_profiles
  from authenticated;
revoke select on public.registration_rate_limits from authenticated;
grant all on all tables in schema public to service_role;

-- private.* holds RLS helpers and trigger functions. The schema is not exposed
-- through the Data API; authenticated needs EXECUTE for RLS evaluation.
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- Public RPC surface.
revoke all on function public.submit_family_registration(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.consume_registration_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.submit_family_registration(jsonb, uuid) to service_role;
grant execute on function public.consume_registration_rate_limit(text, integer, integer) to service_role;

revoke all on function public.admin_dashboard_stats(bigint) from public, anon;
revoke all on function public.admin_add_guardian(bigint, text, text, text, text, text) from public, anon;
grant execute on function public.admin_dashboard_stats(bigint) to authenticated, service_role;
grant execute on function public.admin_add_guardian(bigint, text, text, text, text, text) to authenticated, service_role;

revoke all on function public.get_open_school_year() from public;
grant execute on function public.get_open_school_year() to anon, authenticated, service_role;
