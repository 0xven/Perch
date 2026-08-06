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

const PUBLIC_PREFIX = `/storage/v1/object/public/${REPORT_BUCKET}/`

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

/** The object path inside the bucket for one of our URLs, or null if not ours. */
export function reportStoragePathFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url)
    const i = pathname.indexOf(PUBLIC_PREFIX)
    if (i === -1) return null
    return decodeURIComponent(pathname.slice(i + PUBLIC_PREFIX.length))
  } catch {
    return null
  }
}

/**
 * Best-effort removal of a report's photos. Admin only (the bucket's delete
 * policy is is_admin()). A failure is logged, never thrown: an orphaned object
 * is a smaller problem than a report row that will not delete.
 */
export async function deleteReportPhotos(
  supabase: SupabaseClient,
  urls: (string | null)[],
): Promise<void> {
  const paths = urls
    .map((u) => (u ? reportStoragePathFromUrl(u) : null))
    .filter((p): p is string => p !== null)

  if (paths.length === 0) return

  const { error } = await supabase.storage.from(REPORT_BUCKET).remove(paths)
  if (error) console.error('[report-storage] delete failed:', error.message)
}
