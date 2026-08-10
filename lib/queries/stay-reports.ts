import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public-client'
import { TRIP_REPORTS_TAG } from '@/lib/queries/trip-reports'

/**
 * What travellers have written about a specific stay.
 *
 * This is the honest answer to "the stays have no pictures". We cannot lift
 * photos from Google Maps listings - they belong to the businesses and the
 * people who took them - but we CAN show what someone who actually slept there
 * said about it, which is worth more than a stock photo anyway and is exactly
 * what this site is for.
 *
 * Matching is on the stay's NAME, normalised, scoped to the same destination.
 * A trip report's `stay` item is free text typed by a traveller, so an exact
 * join is impossible; normalising to lowercase alphanumerics and requiring the
 * destination to agree is deliberately conservative. A missed match shows
 * nothing, which is the correct failure - a wrong match would attach a
 * stranger's opinion to the wrong guesthouse.
 *
 * NOTE ON PHOTOS: trip_report_media hangs off the REPORT, not the item, so a
 * photo cannot be truthfully labelled as being of this stay. Report photos are
 * therefore NOT surfaced here. Attaching them per-stay needs an item_id on that
 * table and a per-item uploader in the form; until then this shows words only.
 */

export interface StayReportNote {
  /** The report's public id, for the /report/<id> link. */
  publicId: string
  reportTitle: string | null
  /** What the traveller called it - may differ slightly from the OSM name. */
  itemName: string
  rating: number | null
  costInr: number | null
  notes: string | null
  tripDate: string | null
}

/** Lowercase alphanumerics only, so "Hotel Nilgiri's" == "hotel nilgiris". */
export function normaliseStayName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface Row {
  name: string | null
  rating: number | null
  cost_inr: number | null
  notes: string | null
  trip_reports: {
    public_id: string
    title: string | null
    trip_date: string | null
    destination_slug: string | null
    published: boolean
  } | null
}

async function fetchStayNotes(): Promise<Record<string, StayReportNote[]>> {
  try {
    const supabase = createPublicClient()

    // Only `stay` items, and only from reports the owner has approved. The RLS
    // policy on trip_report_items already restricts reads to published reports;
    // the explicit filter below is belt and braces, and keeps the join small.
    const { data, error } = await supabase
      .from('trip_report_items')
      .select(
        'name, rating, cost_inr, notes, trip_reports!inner(public_id, title, trip_date, destination_slug, published)',
      )
      .eq('kind', 'stay')
      .eq('trip_reports.published', true)
      .not('name', 'is', null)
      .limit(2000)

    if (error) {
      // Missing table = 006 not run yet. Not worth shouting about.
      const notMigrated =
        error.code === '42P01' || error.code === 'PGRST205' || /schema cache/i.test(error.message)
      if (!notMigrated) console.error('[stay-reports] query error:', error.message)
      return {}
    }

    const out: Record<string, StayReportNote[]> = {}
    for (const row of (data ?? []) as unknown as Row[]) {
      const report = row.trip_reports
      if (!report?.published || !row.name) continue
      // Key includes the destination so two "Mountain View" homestays in
      // different valleys never inherit each other's reviews.
      const key = `${report.destination_slug ?? ''}::${normaliseStayName(row.name)}`
      ;(out[key] ??= []).push({
        publicId: report.public_id,
        reportTitle: report.title,
        itemName: row.name,
        rating: row.rating,
        costInr: row.cost_inr,
        notes: row.notes,
        tripDate: report.trip_date,
      })
    }
    return out
  } catch (e) {
    unstable_rethrow(e)
    console.error('[stay-reports] unexpected error:', e)
    return {}
  }
}

/**
 * All traveller stay-notes, keyed by `<destination-slug>::<normalised-name>`.
 *
 * Fetched once and cached rather than queried per stay: the page renders up to
 * 90 cards, and 90 round trips would undo the point. Cached for the same reason
 * every other public read here is - an uncached supabase-js fetch is a dynamic
 * signal.
 */
export const getStayNotes = cache(
  unstable_cache(fetchStayNotes, ['stay-report-notes-v1'], {
    tags: [TRIP_REPORTS_TAG],
    revalidate: 1800,
  }),
)

/** Lookup helper matching the key format above. */
export function stayNoteKey(destSlug: string, name: string): string {
  return `${destSlug}::${normaliseStayName(name)}`
}
