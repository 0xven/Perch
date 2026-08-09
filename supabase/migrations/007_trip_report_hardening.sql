-- ─── 007: TRIP REPORT HARDENING ──────────────────────────────────────────────
-- Fixes found by a security review of 006, plus one thing 006's own
-- RESIDUAL ABUSE SURFACE block asserted that turned out not to be true.
--
-- Three defects, all reachable with nothing but the public anon key:
--
--   A. CONFUSED-DEPUTY PHOTO DELETION (high). `trip_report_media.url` is free
--      text written by anonymous visitors and 006 constrained only its length.
--      The admin delete path read those URLs back and passed them to
--      storage.remove() under the ADMIN's session, against a bucket-wide delete
--      policy. So an attacker could file a junk report whose media rows pointed
--      at OTHER reports' photos, and the owner clicking "Delete" on the junk -
--      the documented moderation action - would hard-delete every victim
--      object. 006 item 1 claimed "They cannot overwrite or delete anything";
--      that was wrong.
--
--   B. INJECTION INTO A STRANGER'S PENDING REPORT (medium). 006 item 3 accepted
--      this class of issue on the grounds that report_id "never appears in a
--      URL" and so needs 122 bits of guessing. It does appear: trip_report_detail
--      returned `to_jsonb(r) - 'contact_email'`, and the primary key survives
--      that. Anyone holding a shared unlisted link could read the UUID and
--      append items, notes and image URLs to a stranger's unreviewed report -
--      which renders immediately on their shared page, under their name.
--      Separately, trip_reports_public exposes `id` for published reports, and
--      withdrawing one re-opened it to anonymous writes forever.
--
--   C. OBJECT ENUMERATION (medium). The storage read policy had no `to` clause,
--      so anon held SELECT on storage.objects for the bucket - and Storage's
--      list endpoint is gated by exactly that. Since object keys are
--      `reports/<public_id>/…`, listing handed over the public_id of every
--      report with a photo, published or not, defeating the "unlisted link"
--      boundary wholesale. CONFIRMED EMPIRICALLY against this project before
--      writing this migration: an anon list of the `reports/` prefix returned
--      folder names.
--
-- Idempotent: safe to run more than once.

-- ─── A + B: stop leaking the primary key ─────────────────────────────────────
-- The report's UUID is the write capability for its own child rows (the
-- item/media insert policies gate on report_is_open(report_id)), so it must not
-- travel to a reader. Nothing in the app needs it: the submitting browser mints
-- the id itself (components/contribute/trip-report-form.tsx) and the detail page
-- renders entirely from public_id. Items and media are now selected column by
-- column rather than with to_jsonb(), so `report_id` does not ride along either.

create or replace function public.trip_report_detail(p_public_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'report', to_jsonb(r) - 'contact_email' - 'id',
    'items', coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'id', i.id, 'kind', i.kind, 'name', i.name,
                  'lat', i.lat, 'lng', i.lng, 'area', i.area,
                  'rating', i.rating, 'cost_inr', i.cost_inr,
                  'notes', i.notes, 'details', i.details,
                  'sort', i.sort, 'created_at', i.created_at
                ) order by i.sort, i.created_at)
         from public.trip_report_items i where i.report_id = r.id),
      '[]'::jsonb),
    'media', coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'id', m.id, 'url', m.url, 'caption', m.caption,
                  'sort', m.sort, 'created_at', m.created_at
                ) order by m.sort, m.created_at)
         from public.trip_report_media m where m.report_id = r.id),
      '[]'::jsonb)
  )
  from public.trip_reports r
  where r.public_id = p_public_id;
$$;

-- anon KEEPS execute here: this is the unlisted-link path and the submitter is
-- not signed in. What changed is the payload, not who may ask for it.
revoke all on function public.trip_report_detail(text) from public;
grant execute on function public.trip_report_detail(text) to anon, authenticated;

-- ─── B: approval is one-way for WRITES ───────────────────────────────────────
-- 006's report_is_open() was `published = false`, so withdrawing an approved
-- report re-opened it to anonymous inserts - and every published report's UUID
-- is readable from trip_reports_public. Once a human has looked at a report,
-- it must never accept anonymous rows again, whatever happens to `published`.

alter table public.trip_reports
  add column if not exists moderated_at timestamptz;

-- Anything already approved counts as moderated, so this is safe to run against
-- existing data without reopening history.
update public.trip_reports set moderated_at = now()
  where published = true and moderated_at is null;

create or replace function public.trip_reports_mark_moderated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published = true and new.moderated_at is null then
    new.moderated_at := now();
  end if;
  return new;
end;
$$;

-- A trigger rather than a line in the admin action: forgetting it in some future
-- code path would silently reopen the hole, and this cannot be forgotten.
drop trigger if exists trip_reports_mark_moderated_trg on public.trip_reports;
create trigger trip_reports_mark_moderated_trg
  before insert or update on public.trip_reports
  for each row execute function public.trip_reports_mark_moderated();

create or replace function public.report_is_open(p_report uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_reports
    where id = p_report and published = false and moderated_at is null
  );
$$;

revoke all on function public.report_is_open(uuid) from public;
grant execute on function public.report_is_open(uuid) to anon, authenticated;

-- ─── A: a media row may only point at its OWN report's folder ────────────────
-- Belt and braces behind the application fix (the admin delete path no longer
-- trusts these URLs at all - it lists the report's own prefix instead). A CHECK
-- constraint cannot see the parent row, so this is a trigger.
--
-- Deliberately matches on the PATH ONLY, not the full origin: the project ref
-- would otherwise be hardcoded into a migration in a public repository.

create or replace function public.trip_report_media_url_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  select '/storage/v1/object/public/report-uploads/reports/' || r.public_id || '/'
    into expected
    from public.trip_reports r where r.id = new.report_id;

  if expected is null then
    raise exception 'unknown report';
  end if;

  -- Admins may attach anything (they are trusted, and may be repairing a row).
  if public.is_admin() then
    return new;
  end if;

  if position(expected in new.url) = 0 then
    raise exception 'media url must point at this report''s own folder';
  end if;

  return new;
end;
$$;

drop trigger if exists trip_report_media_url_guard_trg on public.trip_report_media;
create trigger trip_report_media_url_guard_trg
  before insert or update on public.trip_report_media
  for each row execute function public.trip_report_media_url_guard();

-- ─── C: stop anonymous object enumeration ────────────────────────────────────
-- Listing is gated by SELECT on storage.objects; DOWNLOADS from a public bucket
-- are not (they go through /object/public/… and skip RLS entirely). No app code
-- calls .list() as anon, so restricting this costs the public site nothing while
-- closing the enumeration. The admin still needs SELECT: the new delete path
-- lists the report's own prefix.

drop policy if exists "report_uploads_public_read" on storage.objects;
drop policy if exists "report_uploads_admin_read" on storage.objects;
create policy "report_uploads_admin_read" on storage.objects
  for select using (bucket_id = 'report-uploads' and public.is_admin());

-- ─── WHAT IS STILL ACCEPTED ──────────────────────────────────────────────────
-- Unchanged from 006 and still true: anonymous uploads can consume bucket
-- storage (mitigated by the 5MB cap, the mime allowlist and the folder pin, not
-- by volume); junk reports can be filed but land unpublished, so the moderation
-- queue remains the control; and nothing here verifies that a trip report is
-- TRUE - it is a stranger's account of their own trip, and the UI says so.
--
-- 006 item 3's "122 bits" reasoning is now actually correct rather than merely
-- asserted: with `id` stripped from the RPC and moderated_at closing the
-- withdraw-reopen path, the report UUID is known only to the browser that
-- minted it.
