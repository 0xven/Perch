-- ─── 006: TRIP REPORTS ───────────────────────────────────────────────────────
-- The public, anonymous trip-reporting system behind /contribute, /reports and
-- /report/<public_id>.
--
-- This is the FIRST anonymous write surface in this app. Everything before it
-- (004, 005) was owner-only, so the security model here is new and is spelled
-- out in full:
--
--   * Only the anon key ever reaches the browser. There is still no service_role
--     key anywhere in this app.
--   * Anonymous visitors may INSERT a report, its items and its photos. They may
--     NOT update or delete anything, ever - there is deliberately no anon
--     update/delete policy on any table below, so RLS refuses those verbs
--     outright rather than relying on the app not to ask.
--   * `contact_email` is PII and never leaves the database for a non-admin.
--     THREE independent mechanisms enforce that, because one typo in any of them
--     should not be enough to leak it:
--       1. COLUMN-LEVEL GRANTS. anon AND authenticated are granted select on the
--          named non-PII columns only - the column is granted to no role at all.
--          Postgres checks column privileges before RLS, so
--          `select contact_email from trip_reports` is refused whatever the row
--          policies say, and being signed in buys nothing.
--       2. A VIEW, public.trip_reports_public, which simply does not have the
--          column. It is `security_invoker = true`, so the caller's own RLS
--          still applies through it - a view is not a way around row policies
--          here, only a way to drop a column and give the app one thing to read.
--       3. ONE narrow security-definer function, trip_report_contacts(), whose
--          body is `where public.is_admin()`. That is how the owner's own
--          moderation queue sees an address, and there is no other path.
--
--   * MODERATION WITH UNLISTED LINKS. A new report is published = false.
--       - The LISTING (/reports) reads the view, whose anon SELECT policy is
--         `published = true`. An unapproved report is not merely hidden by the
--         UI: it is not in the result set at all, even for someone hand-rolling
--         a PostgREST query with the anon key.
--       - The SHAREABLE LINK (/report/<public_id>) goes through
--         public.trip_report_detail(), a security-definer function that looks up
--         exactly one row by its unguessable public_id and returns it with
--         contact_email stripped. That, and only that, is how an unpublished
--         report is readable - like an unlisted video.
--
-- This migration is idempotent: safe to run more than once.
-- Paste it into the Supabase SQL editor and run it.

-- ─── TRIP REPORTS ────────────────────────────────────────────────────────────
-- The "skeleton" of a trip: where, when, how, who. Everything specific the
-- traveller actually saw lives in trip_report_items.

create table if not exists public.trip_reports (
  id               uuid primary key default gen_random_uuid(),
  -- Short, human-readable, unguessable-ish. Generated in app code
  -- (lib/validations/trip-report.ts) rather than from a DB sequence precisely
  -- so it cannot be walked: PERCH-000001 would hand out every draft.
  public_id        text unique not null check (public_id ~ '^PERCH-[A-Z0-9]{6}$'),
  destination_slug text check (char_length(destination_slug) <= 80),
  origin_name      text check (char_length(origin_name) <= 120),
  trip_date        date,
  transport_mode   text check (char_length(transport_mode) <= 24),
  vehicle          text check (char_length(vehicle) <= 120),
  days             int  check (days between 1 and 365),
  travellers       int  check (travellers between 1 and 60),
  total_cost_inr   numeric check (total_cost_inr >= 0 and total_cost_inr < 100000000),
  title            text check (char_length(title) <= 200),
  summary          text check (char_length(summary) <= 6000),
  author_name      text check (char_length(author_name) <= 80),
  -- PII. Optional, and only ever readable by an admin (see the grants below).
  contact_email    text check (char_length(contact_email) <= 200),
  published        boolean default false,
  created_at       timestamptz default now()
);

create index if not exists trip_reports_published_idx on public.trip_reports (published, created_at desc);
create index if not exists trip_reports_destination_idx on public.trip_reports (destination_slug);

alter table public.trip_reports enable row level security;

-- Public reads: published rows only, plus the owner's own view of everything.
-- The unlisted-link path deliberately does NOT go through this policy; see
-- trip_report_detail() below.
drop policy if exists "trip_reports_public_read" on public.trip_reports;
create policy "trip_reports_public_read" on public.trip_reports
  for select using (published = true or public.is_admin());

-- Anonymous submissions. `published = false` in the WITH CHECK is what stops a
-- hand-rolled client from self-approving straight into the public listing.
drop policy if exists "trip_reports_anon_insert" on public.trip_reports;
create policy "trip_reports_anon_insert" on public.trip_reports
  for insert with check (published = false);

drop policy if exists "trip_reports_admin_write" on public.trip_reports;
create policy "trip_reports_admin_write" on public.trip_reports
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── ITEMS ───────────────────────────────────────────────────────────────────
-- One report has many items, each of a KIND (stay / wifi / sim / fuel /
-- bike_service / road_condition / ...). The kind-specific fields live in
-- `details` jsonb ON PURPOSE: the taxonomy is declared in app code
-- (lib/data/report-kinds.ts) and adding a new kind, or a new field on an
-- existing kind, must never need a migration.
--
-- `kind` has a length check but no enum / value check, for the same reason.

create table if not exists public.trip_report_items (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.trip_reports(id) on delete cascade,
  kind       text not null check (char_length(kind) between 1 and 40),
  name       text check (char_length(name) <= 200),
  lat        double precision check (lat between -90 and 90),
  lng        double precision check (lng between -180 and 180),
  area       text check (char_length(area) <= 160),
  rating     int check (rating between 1 and 5),
  cost_inr   numeric check (cost_inr >= 0 and cost_inr < 100000000),
  notes      text check (char_length(notes) <= 6000),
  details    jsonb default '{}'::jsonb,
  sort       int default 0,
  created_at timestamptz default now()
);

create index if not exists trip_report_items_report_idx on public.trip_report_items (report_id, sort);
create index if not exists trip_report_items_kind_idx on public.trip_report_items (kind);

alter table public.trip_report_items enable row level security;

-- ─── MEDIA ───────────────────────────────────────────────────────────────────

create table if not exists public.trip_report_media (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.trip_reports(id) on delete cascade,
  url        text not null check (char_length(url) <= 1000),
  caption    text check (char_length(caption) <= 300),
  sort       int default 0,
  created_at timestamptz default now()
);

create index if not exists trip_report_media_report_idx on public.trip_report_media (report_id, sort);

alter table public.trip_report_media enable row level security;

-- ─── PARENT-STATE HELPERS ────────────────────────────────────────────────────
-- Both are security definer so they answer about the PARENT ROW ITSELF rather
-- than about the caller's RLS view of it. An RLS policy that queried
-- trip_reports directly would be evaluated as the caller, and for anon that
-- view is "published rows only" - which would make "is this report still
-- unpublished and therefore still accepting items?" unanswerable by
-- construction. `set search_path = public` pins resolution so neither function
-- can be hijacked by a caller-controlled search_path.

-- "Is this report approved and on the public listing?"
create or replace function public.report_is_public(p_report uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trip_reports where id = p_report and published = true);
$$;

-- "Is this report still a draft, and therefore still accepting rows?"
-- Note the consequence: once an admin approves a report, anonymous inserts of
-- new items and photos onto it stop. Approving is final, so nothing can be
-- appended to a report AFTER it was reviewed.
create or replace function public.report_is_open(p_report uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trip_reports where id = p_report and published = false);
$$;

revoke all on function public.report_is_public(uuid) from public;
revoke all on function public.report_is_open(uuid) from public;
grant execute on function public.report_is_public(uuid) to anon, authenticated;
grant execute on function public.report_is_open(uuid) to anon, authenticated;

-- ─── ITEM / MEDIA POLICIES ───────────────────────────────────────────────────

drop policy if exists "trip_report_items_public_read" on public.trip_report_items;
create policy "trip_report_items_public_read" on public.trip_report_items
  for select using (public.report_is_public(report_id) or public.is_admin());

drop policy if exists "trip_report_items_anon_insert" on public.trip_report_items;
create policy "trip_report_items_anon_insert" on public.trip_report_items
  for insert with check (public.report_is_open(report_id));

drop policy if exists "trip_report_items_admin_write" on public.trip_report_items;
create policy "trip_report_items_admin_write" on public.trip_report_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "trip_report_media_public_read" on public.trip_report_media;
create policy "trip_report_media_public_read" on public.trip_report_media
  for select using (public.report_is_public(report_id) or public.is_admin());

drop policy if exists "trip_report_media_anon_insert" on public.trip_report_media;
create policy "trip_report_media_anon_insert" on public.trip_report_media
  for insert with check (public.report_is_open(report_id));

drop policy if exists "trip_report_media_admin_write" on public.trip_report_media;
create policy "trip_report_media_admin_write" on public.trip_report_media
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── PRIVILEGES ──────────────────────────────────────────────────────────────
-- Supabase's default grants hand anon everything on new tables in `public`, so
-- the interesting work here is the REVOKE. RLS would refuse an anon UPDATE or
-- DELETE anyway (no policy exists for either) - taking the privilege away too
-- means the request is rejected one layer earlier and cannot depend on a policy
-- staying correct through a future edit.

revoke all on public.trip_reports from anon;
-- Column-level SELECT: every column EXCEPT contact_email. This list is the
-- actual guard on the PII, not the view below.
grant select (
  id, public_id, destination_slug, origin_name, trip_date, transport_mode,
  vehicle, days, travellers, total_cost_inr, title, summary, author_name,
  published, created_at
) on public.trip_reports to anon;
grant insert on public.trip_reports to anon;

-- `authenticated` gets the SAME column treatment, which is the non-obvious half.
--
-- A column grant cannot tell an admin apart from any other signed-in user, and
-- Supabase projects accept sign-ups by default - so leaving `authenticated`
-- with the column would mean anyone who created an account could read the email
-- of every published report, RLS notwithstanding (row policies do not filter
-- columns). Being signed in is not the same as being the owner.
--
-- update/delete are granted here and gated by the admin policy above; the
-- owner's own read of contact_email goes through trip_report_contacts() below.
revoke all on public.trip_reports from authenticated;
grant select (
  id, public_id, destination_slug, origin_name, trip_date, transport_mode,
  vehicle, days, travellers, total_cost_inr, title, summary, author_name,
  published, created_at
) on public.trip_reports to authenticated;
grant insert, update, delete on public.trip_reports to authenticated;

revoke all on public.trip_report_items from anon;
grant select, insert on public.trip_report_items to anon;

revoke all on public.trip_report_media from anon;
grant select, insert on public.trip_report_media to anon;

-- ─── PUBLIC VIEW ─────────────────────────────────────────────────────────────
-- What the app reads for anything public. contact_email is simply not in it.
--
-- security_invoker = true is load-bearing: without it the view would run as its
-- owner and quietly bypass the row policy above, turning every draft report
-- into public data. With it, the caller's own RLS applies through the view and
-- anon still sees published rows only.

drop view if exists public.trip_reports_public;
create view public.trip_reports_public
with (security_invoker = true) as
select
  id, public_id, destination_slug, origin_name, trip_date, transport_mode,
  vehicle, days, travellers, total_cost_inr, title, summary, author_name,
  published, created_at
from public.trip_reports;

grant select on public.trip_reports_public to anon, authenticated;

-- ─── UNLISTED-LINK LOOKUP ────────────────────────────────────────────────────
-- The one and only way an UNPUBLISHED report is readable: by presenting its
-- exact public_id. security definer, so it steps around the `published = true`
-- row policy - and therefore it is written to be incapable of doing anything
-- else. It takes one scalar, matches one row on a unique column, returns no
-- list, and strips contact_email from the payload with `- 'contact_email'`.
--
-- Items and photos come back in the same call so the page cannot accidentally
-- read them through the (published-only) table policies and render a draft with
-- its contents missing.

create or replace function public.trip_report_detail(p_public_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'report', to_jsonb(r) - 'contact_email',
    'items', coalesce(
      (select jsonb_agg(to_jsonb(i) order by i.sort, i.created_at)
         from public.trip_report_items i where i.report_id = r.id),
      '[]'::jsonb),
    'media', coalesce(
      (select jsonb_agg(to_jsonb(m) order by m.sort, m.created_at)
         from public.trip_report_media m where m.report_id = r.id),
      '[]'::jsonb)
  )
  from public.trip_reports r
  where r.public_id = p_public_id;
$$;

revoke all on function public.trip_report_detail(text) from public;
grant execute on function public.trip_report_detail(text) to anon, authenticated;

-- ─── ADMIN-ONLY: the submitter emails ────────────────────────────────────────
-- The one and only way contact_email is readable, now that the column is
-- granted to nobody. `where public.is_admin()` is the whole gate: for any other
-- signed-in user the predicate is false and the function returns zero rows -
-- not an error, not a partial list, nothing. /admin/reports joins this onto the
-- view (see lib/queries/admin.ts).

-- The OUT columns are named report_id/email rather than id/contact_email
-- deliberately: a RETURNS TABLE column name is in scope inside the body, so
-- `select contact_email ...` under an OUT column also called contact_email is
-- an ambiguous reference. Different names, and every column qualified with `r.`.
create or replace function public.trip_report_contacts()
returns table (report_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.contact_email from public.trip_reports r where public.is_admin();
$$;

revoke all on function public.trip_report_contacts() from public;
grant execute on function public.trip_report_contacts() to authenticated;

-- ─── STORAGE: `report-uploads` bucket ────────────────────────────────────────
-- A SEPARATE bucket from `media`. `media` is the owner's own admin-only bucket
-- and must stay that way; mixing anonymous uploads into it would mean loosening
-- its insert policy, which is the opposite of what we want.
--
-- file_size_limit and allowed_mime_types are set ON THE BUCKET, so they are
-- enforced by Storage itself. The identical checks in the browser
-- (lib/validations/trip-report.ts) are there to give a decent error message -
-- these are the ones that actually hold.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-uploads', 'report-uploads', true,
  5242880,                                            -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "report_uploads_public_read" on storage.objects;
create policy "report_uploads_public_read" on storage.objects
  for select using (bucket_id = 'report-uploads');

-- Anonymous insert, pinned to a `reports/` prefix so the bucket cannot be used
-- as general-purpose free hosting with arbitrary paths.
drop policy if exists "report_uploads_anon_insert" on storage.objects;
create policy "report_uploads_anon_insert" on storage.objects
  for insert with check (
    bucket_id = 'report-uploads'
    and (storage.foldername(name))[1] = 'reports'
  );

drop policy if exists "report_uploads_admin_update" on storage.objects;
create policy "report_uploads_admin_update" on storage.objects
  for update using (bucket_id = 'report-uploads' and public.is_admin())
  with check (bucket_id = 'report-uploads' and public.is_admin());

drop policy if exists "report_uploads_admin_delete" on storage.objects;
create policy "report_uploads_admin_delete" on storage.objects
  for delete using (bucket_id = 'report-uploads' and public.is_admin());

-- ─── RESIDUAL ABUSE SURFACE - READ THIS ──────────────────────────────────────
-- Being honest about what this design does NOT solve, so the decision is a
-- decision and not an oversight.
--
-- 1. ANONYMOUS STORAGE WRITES ARE THE REAL EXPOSURE. Anyone who reads the anon
--    key out of the page source (it is a public key - that is what it is for)
--    can upload 5 MB images into report-uploads/reports/ all day without ever
--    submitting a report. They cannot overwrite or delete anything, and they
--    cannot upload a script or an SVG (allowed_mime_types), but they can fill
--    the free tier's 1 GB and leave orphaned objects behind.
--    Mitigated by: the 5 MB per-object cap and the mime allowlist, both
--    enforced by Storage; the folder pin; the browser cap of 6 files per
--    report. NOT mitigated: overall volume. If this is ever abused the fix is
--    to flip the bucket's insert policy to `authenticated` and put anonymous
--    submissions behind Supabase anonymous sign-in, which is still $0 and is a
--    one-policy change - the app code already uploads with the caller's own
--    client, so nothing else moves.
--
-- 2. ANONYMOUS ROW WRITES. Same key, same reasoning: junk reports can be
--    inserted. They land as published = false, so junk never reaches /reports
--    without the owner clicking approve, and the schema caps text lengths so a
--    single row cannot be megabytes. There is no rate limit at the database
--    level - Supabase's free tier has no per-IP request limiting - so the
--    moderation queue is the control.
--
-- 3. GUESSING A DRAFT'S report_id LETS YOU APPEND TO IT. The item/media insert
--    policies allow inserts against any report that is still unpublished, and
--    report_id is a v4 UUID that never appears in a URL (the URL carries
--    public_id instead). Appending therefore requires guessing 122 bits. The
--    alternative - a per-submitter token - would need an account, which is the
--    friction this whole feature exists to avoid.
--
-- 4. NOTHING HERE VERIFIES THE CONTENT IS TRUE. It is a trip report from a
--    stranger. The UI says so.
--
-- 5. WHAT IS *NOT* A RESIDUAL RISK, and why it took three mechanisms: a
--    signed-in non-admin reading submitter emails. Row policies do not filter
--    columns, so `published = true or is_admin()` alone would have handed the
--    address of every approved report to anyone who created an account. The
--    contact_email column is therefore granted to NO role, and the owner reads
--    it through trip_report_contacts() alone. If a future migration adds a
--    column to trip_reports, remember that the two grant lists above are
--    explicit - a new column is unreadable until it is added to them, which is
--    the safe direction to fail in.
