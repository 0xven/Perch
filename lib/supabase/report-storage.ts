import type { SupabaseClient } from '@supabase/supabase-js'
import { checkReportPhoto } from '@/lib/validations/trip-report'

/**
 * A SEPARATE bucket from `media`.
 *
 * `media` is the owner's admin-only bucket and its insert policy calls
 * is_admin(); pointing anonymous uploads at it would mean loosening that
 * policy, which is exactly backwards. This bucket is the one place in the app
 * an anonymous visitor may write bytes, and migration 006 constrains it with a
 * 5MB per-object cap, a JPEG/PNG/WebP mime allowlist and a `reports/` path pin,
 * all enforced by Storage rather than by this file.
 */
export const REPORT_BUCKET = 'report-uploads'

export type ReportUploadResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Upload one photo for a report and return its public URL.
 *
 * `publicId` is the report's own ID, so a report's photos sit together and an
 * admin can bin the lot in one go. The path prefix must stay `reports/` - the
 * bucket's insert policy checks it.
 */
export async function uploadReportPhoto(
  supabase: SupabaseClient,
  file: File,
  publicId: string,
): Promise<ReportUploadResult> {
  const check = checkReportPhoto(file)
  if (!check.ok) return { ok: false, error: check.error }

  const path = `reports/${publicId}/${crypto.randomUUID()}.${check.ext}`

  const { error } = await supabase.storage
    .from(REPORT_BUCKET)
    .upload(path, file, { contentType: check.type, upsert: false })

  if (error) {
    console.error('[report-storage] upload failed:', error.message)
    // The bucket may simply not exist yet (006 not run). Say something a
    // traveller can act on rather than echoing a Storage error code.
    return {
      ok: false,
      error: /not found|does not exist|bucket/i.test(error.message)
        ? 'Photo uploads are not switched on yet. You can still submit the report without photos.'
        : `Could not upload ${file.name}. ${error.message}`,
    }
  }

  const { data } = supabase.storage.from(REPORT_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

/**
 * Best-effort removal of a report's photos, by LISTING THE REPORT'S OWN FOLDER.
 *
 * It used to take the urls off the report's trip_report_media rows and delete
 * whatever they pointed at. That was a confused deputy, and a bad one: those
 * urls are free text written by anonymous visitors, this runs under the ADMIN's
 * session, and the bucket's delete policy is bucket-wide `is_admin()`. So a junk
 * report whose media rows named OTHER reports' objects would, the moment the
 * owner clicked Delete on it, take every one of those photos with it. Storage
 * deletes are hard deletes with no versioning.
 *
 * Deriving the paths from `reports/<publicId>/` instead means the set of objects
 * this can ever touch is fixed by the report's own identity, and nothing an
 * attacker can write into the database is consulted at all. Migration 007 adds
 * a matching trigger so a hostile url cannot be stored in the first place, but
 * this function no longer depends on that being true.
 *
 * Admin only - the bucket's select and delete policies both call is_admin().
 * Failures are logged, never thrown: an orphaned object is a smaller problem
 * than a report row that will not delete.
 */
export async function deleteReportPhotos(
  supabase: SupabaseClient,
  publicId: string,
): Promise<void> {
  const folder = `reports/${publicId}`

  const { data: objects, error: listError } = await supabase.storage
    .from(REPORT_BUCKET)
    .list(folder, { limit: 1000 })

  if (listError) {
    console.error('[report-storage] list failed:', listError.message)
    return
  }
  if (!objects || objects.length === 0) return

  const paths = objects.map((o) => `${folder}/${o.name}`)

  const { error } = await supabase.storage.from(REPORT_BUCKET).remove(paths)
  if (error) console.error('[report-storage] delete failed:', error.message)
}
