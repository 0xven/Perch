import { createPublicClient } from '@/lib/supabase/public-client'
import type {
  WifiReading, WorkSpot, Accommodation, Journey, PowerReport,
} from '@/lib/types/database'

/** Aggregated WiFi stats from the `destination_wifi_summary` view. */
export interface WifiSummary {
  avg_download_mbps: number | null
  reading_count: number
  last_reading_at: string | null
}

/** Everything the community contributes for a destination, fully typed. */
export interface DestinationCommunityData {
  wifiList: WifiReading[]
  workSpots: WorkSpot[]
  accommodations: Accommodation[]
  journeys: Journey[]
  powerReports: PowerReport[]
  wifiSummary: WifiSummary | null
}

const EMPTY: DestinationCommunityData = {
  wifiList: [], workSpots: [], accommodations: [], journeys: [], powerReports: [], wifiSummary: null,
}

/**
 * Fetch the Supabase community layer for a destination by slug.
 *
 * The static catalogue is the source of truth for the destination itself, so
 * this only loads the optional crowd-sourced data. It NEVER throws: if the row
 * is not seeded, the DB is unreachable, or a query errors, it logs and returns
 * empty collections so the page still renders from the catalogue.
 */
export async function getDestinationCommunityData(slug: string): Promise<DestinationCommunityData> {
  try {
    // Cookie-less on purpose. Everything below is public community data with no
    // per-visitor component, and the cookie-bound client's cookies() call is a
    // dynamic signal that stopped /destinations/[slug] prerendering at all.
    const supabase = createPublicClient()
    const { data: dbDest, error: destErr } = await supabase
      .from('destinations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (destErr) {
      console.error('[destination] lookup failed:', destErr.message)
      return EMPTY
    }
    const destId = dbDest?.id as string | undefined
    if (!destId) return EMPTY

    const [wifi, work, accom, jour, power, summary] = await Promise.all([
      supabase.from('wifi_readings').select('*').eq('destination_id', destId).order('recorded_at', { ascending: false }).limit(30),
      supabase.from('work_spots').select('*').eq('destination_id', destId).order('wifi_rating', { ascending: false }),
      supabase.from('accommodations').select('*').eq('destination_id', destId).order('wifi_rating', { ascending: false }),
      supabase.from('journeys').select('*').eq('destination_id', destId).order('transport_mode'),
      supabase.from('power_reports').select('*').eq('destination_id', destId).order('reported_at', { ascending: false }).limit(5),
      supabase.from('destination_wifi_summary').select('*').eq('destination_id', destId).maybeSingle(),
    ])

    for (const r of [wifi, work, accom, jour, power, summary]) {
      if (r.error) console.error('[destination] query error:', r.error.message)
    }

    return {
      wifiList: (wifi.data as WifiReading[]) ?? [],
      workSpots: (work.data as WorkSpot[]) ?? [],
      accommodations: (accom.data as Accommodation[]) ?? [],
      journeys: (jour.data as Journey[]) ?? [],
      powerReports: (power.data as PowerReport[]) ?? [],
      wifiSummary: (summary.data as WifiSummary | null) ?? null,
    }
  } catch (e) {
    console.error('[getDestinationCommunityData] unexpected error:', e)
    return EMPTY
  }
}
