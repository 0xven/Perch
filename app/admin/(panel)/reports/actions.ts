'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { requireAdmin } from '@/lib/supabase/admin-guard'
import { createClient } from '@/lib/supabase/server'
import { deleteReportPhotos } from '@/lib/supabase/report-storage'
import { TRIP_REPORTS_TAG } from '@/lib/queries/trip-reports'

export interface ReportModerationState {
  error?: string
  message?: string
}

/**
 * Every write here flips what the public /reports list contains, and that list
 * is prerendered behind unstable_cache. updateTag - NOT the deprecated
 * single-argument revalidateTag - is what makes the next request wait for fresh
 * data rather than serve the queue the owner has just cleared.
 */
function refresh(publicId?: string) {
  updateTag(TRIP_REPORTS_TAG)
  revalidatePath('/admin/reports')
  revalidatePath('/reports')
  if (publicId) revalidatePath(`/report/${publicId}`)
}

function readIds(formData: FormData): { id: string; publicId: string } | null {
  const id = String(formData.get('id') ?? '')
  const publicId = String(formData.get('public_id') ?? '')
  return id ? { id, publicId } : null
}

/** Approve or withdraw. `published` is the only column moderation ever touches. */
async function setPublished(
  formData: FormData,
  published: boolean,
): Promise<ReportModerationState> {
  await requireAdmin()

  const ids = readIds(formData)
  if (!ids) return { error: 'Missing report id.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('trip_reports')
    .update({ published })
    .eq('id', ids.id)

  if (error) {
    console.error('[admin/reports] publish toggle failed:', error.message)
    return { error: `Could not update that report: ${error.message}` }
  }

  refresh(ids.publicId)
  return {
    message: published
      ? 'Approved. It is on the public reports list now.'
      : 'Withdrawn from the public list. The direct link still works.',
  }
}

export async function publishReport(
  _prev: ReportModerationState,
  formData: FormData,
): Promise<ReportModerationState> {
  try {
    return await setPublished(formData, true)
  } catch (e) {
    unstable_rethrow(e)
    console.error('[publishReport] unexpected error:', e)
    return { error: 'Something went wrong approving that report.' }
  }
}

export async function unpublishReport(
  _prev: ReportModerationState,
  formData: FormData,
): Promise<ReportModerationState> {
  try {
    return await setPublished(formData, false)
  } catch (e) {
    unstable_rethrow(e)
    console.error('[unpublishReport] unexpected error:', e)
    return { error: 'Something went wrong withdrawing that report.' }
  }
}

/**
 * Delete a report, its items, its photos and the uploaded files.
 *
 * The rows go by ON DELETE CASCADE; the Storage objects do not, so they are
 * collected first and binned after. Best-effort on the files (see
 * deleteReportPhotos) - an orphaned object beats a row that will not delete.
 */
export async function deleteReport(
  _prev: ReportModerationState,
  formData: FormData,
): Promise<ReportModerationState> {
  try {
    await requireAdmin()

    const ids = readIds(formData)
    if (!ids) return { error: 'Missing report id.' }

    const supabase = await createClient()

    const { data: media } = await supabase
      .from('trip_report_media')
      .select('url')
      .eq('report_id', ids.id)

    const { error } = await supabase.from('trip_reports').delete().eq('id', ids.id)
    if (error) {
      console.error('[admin/reports] delete failed:', error.message)
      return { error: `Could not delete: ${error.message}` }
    }

    await deleteReportPhotos(supabase, ((media ?? []) as { url: string }[]).map((m) => m.url))

    refresh(ids.publicId)
    return { message: 'Report deleted, photos and all.' }
  } catch (e) {
    unstable_rethrow(e)
    console.error('[deleteReport] unexpected error:', e)
    return { error: 'Something went wrong deleting that report.' }
  }
}
