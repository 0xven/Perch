import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public-client'
import type {
  TripReportDetail, TripReportItem, TripReportMedia, TripReportPublic, TripReportSummary,
} from '@/lib/types/database'

/** Cache tag. The admin moderation actions call updateTag() with it. */
export const TRIP_REPORTS_TAG = 'trip-reports'

/**
 * "The table is not there yet" is the expected state until the owner runs 006,
 * and the right answer then is an empty list, not a red page. Same reflex as
 * lib/queries/site-settings.ts.
 */
function isNotMigrated(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST202' || // function not found
    error.code === 'PGRST205' || // relation not found in the schema cache
    /schema cache/i.test(error.message ?? '')
  )
}

function warnOnce(where: string, error: { code?: string; message?: string }) {
  if (isNotMigrated(error)) {
    console.warn(`[trip-reports] ${where}: run supabase/migrations/006_trip_reports.sql. Showing nothing for now.`)
  } else {
    console.error(`[trip-reports] ${where}:`, error.message)
  }
}

// ─── Browse listing ──────────────────────────────────────────────────────────

async function fetchPublishedReports(): Promise<TripReportSummary[]> {
  try {
    const supabase = createPublicClient()

    // The view, not the table: it has no contact_email column at all, and its
    // security_invoker RLS still restricts anon to published rows. Both halves
    // matter - see the header of migration 006.
    const { data: reports, error } = await supabase
      .from('trip_reports_public')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      warnOnce('listing query', error)
      return []
    }

    const rows = (reports as TripReportPublic[]) ?? []
    if (rows.length === 0) return []

    const ids = rows.map((r) => r.id)

    // Two flat reads rather than an embedded join: PostgREST embedding on a view
    // needs a declared FK relationship, which a view does not carry.
    const [{ data: items }, { data: media }] = await Promise.all([
      supabase.from('trip_report_items').select('report_id, kind, rating').in('report_id', ids),
      supabase.from('trip_report_media').select('report_id, url, sort').in('report_id', ids).order('sort'),
    ])

    const byReport = new Map<string, { kinds: Set<string>; count: number; ratings: number[] }>()
    for (const i of (items ?? []) as Pick<TripReportItem, 'report_id' | 'kind' | 'rating'>[]) {
      const agg = byReport.get(i.report_id) ?? { kinds: new Set<string>(), count: 0, ratings: [] }
      agg.kinds.add(i.kind)
      agg.count += 1
      if (i.rating != null) agg.ratings.push(i.rating)
      byReport.set(i.report_id, agg)
    }

    const photosByReport = new Map<string, string[]>()
    for (const m of (media ?? []) as Pick<TripReportMedia, 'report_id' | 'url'>[]) {
      const list = photosByReport.get(m.report_id) ?? []
      list.push(m.url)
      photosByReport.set(m.report_id, list)
    }

    return rows.map((r) => {
      const agg = byReport.get(r.id)
      const photos = photosByReport.get(r.id) ?? []
      const ratings = agg?.ratings ?? []
      return {
        ...r,
        kinds: agg ? [...agg.kinds] : [],
        itemCount: agg?.count ?? 0,
        photoCount: photos.length,
        avgRating: ratings.length
          ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10
          : null,
        coverUrl: photos[0] ?? null,
      }
    })
  } catch (e) {
    unstable_rethrow(e)
    console.error('[trip-reports] unexpected listing error:', e)
    return []
  }
}

/**
 * Every published report, for /reports and for the destination pages.
 *
 * unstable_cache for the same reason as site-settings: supabase-js issues an
 * uncached fetch, which is a dynamic signal, and /reports and the 97
 * destination pages are prerendered. Inside a cache scope the fetch stops being
 * a dynamic signal and prerendering survives. Approving a report in /admin
 * calls updateTag(TRIP_REPORTS_TAG), so the queue clears immediately; the 10
 * minute revalidate is only a backstop for a hand edit in the SQL editor.
 */
export const getPublishedReports = cache(
  unstable_cache(fetchPublishedReports, ['trip-reports-published-v1'], {
    tags: [TRIP_REPORTS_TAG],
    revalidate: 600,
  }),
)

/** The published reports that mention a destination, newest first. */
export async function getReportsForDestination(slug: string, limit = 4): Promise<TripReportSummary[]> {
  const all = await getPublishedReports()
  return all.filter((r) => r.destination_slug === slug).slice(0, limit)
}

// ─── Single report, by its shareable ID ──────────────────────────────────────

/**
 * One report by public_id - published or not.
 *
 * This is the unlisted-link path, so it goes through the security-definer
 * trip_report_detail() function rather than the view: an unapproved report is
 * invisible to the view's row policy by design, and it still has to be readable
 * by the person who just submitted it. The function is the narrow, audited
 * exception (one row, matched on a unique unguessable column, contact_email
 * stripped in SQL) - see migration 006.
 *
 * Deliberately NOT cached. Someone lands here seconds after submitting; a stale
 * cache entry would show them "not found" for their own report.
 */
export async function getReportDetail(publicId: string): Promise<TripReportDetail | null> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.rpc('trip_report_detail', { p_public_id: publicId })

    if (error) {
      warnOnce('detail rpc', error)
      return null
    }
    if (!data) return null

    const doc = data as { report: TripReportPublic | null; items: TripReportItem[]; media: TripReportMedia[] }
    if (!doc.report) return null

    return { report: doc.report, items: doc.items ?? [], media: doc.media ?? [] }
  } catch (e) {
    unstable_rethrow(e)
    console.error('[trip-reports] unexpected detail error:', e)
    return null
  }
}
