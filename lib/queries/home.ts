import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public-client'
import type { DestinationWifiSummary } from '@/lib/types/database'

/** Cache tag, so a new WiFi reading can invalidate this on demand later. */
export const WIFI_SUMMARY_TAG = 'wifi-summary'

async function fetchWifiBySlug(): Promise<Record<string, DestinationWifiSummary>> {
  try {
    const supabase = createPublicClient()
    const [destRes, wifiRes] = await Promise.all([
      supabase.from('destinations').select('id, slug'),
      supabase.from('destination_wifi_summary').select('*'),
    ])

    if (destRes.error) console.error('[home] destinations lookup failed:', destRes.error.message)
    if (wifiRes.error) console.error('[home] wifi summary query error:', wifiRes.error.message)

    const wifiById = Object.fromEntries(
      ((wifiRes.data ?? []) as DestinationWifiSummary[]).map((w) => [w.destination_id, w]),
    )
    const wifiBySlug: Record<string, DestinationWifiSummary> = {}
    for (const d of ((destRes.data ?? []) as { id: string; slug: string }[])) {
      const w = wifiById[d.id] as DestinationWifiSummary | undefined
      if (w) wifiBySlug[d.slug] = w
    }
    return wifiBySlug
  } catch (e) {
    unstable_rethrow(e)
    console.error('[getWifiBySlug] unexpected error:', e)
    return {}
  }
}

/**
 * Slug -> community WiFi summary, joining the static catalogue to the Supabase
 * `destination_wifi_summary` view.
 *
 * TWO THINGS HERE ARE ABOUT SPEED, and they are why / and /destinations are
 * served from the edge instead of rendered per request.
 *
 * 1. THE COOKIE-LESS CLIENT. This used to use lib/supabase/server's client,
 *    which calls cookies() - and reading cookies is a dynamic signal, so it
 *    forced both pages to `ƒ` no matter what `revalidate` they declared. Every
 *    visitor paid for a fresh render and Vercel's cache never held them
 *    (measured: x-vercel-cache MISS on every request, ~340ms TTFB, spiking to
 *    1.4s). Nothing here is per-visitor - it is public community averages - so
 *    the cookie-bound client was buying nothing and costing the cache.
 *
 * 2. unstable_cache. supabase-js issues an uncached fetch, which is itself a
 *    dynamic signal. Wrapping it puts the query in a cache scope so prerendering
 *    survives. Same pattern, and the same reasoning, as
 *    lib/queries/site-settings.ts.
 *
 * react cache() on top collapses repeat calls within one render into one lookup.
 *
 * It still NEVER throws: any DB failure logs and returns {}, so the pages fall
 * back to the catalogue exactly as before.
 */
export const getWifiBySlug = cache(
  unstable_cache(fetchWifiBySlug, ['wifi-by-slug-v1'], {
    tags: [WIFI_SUMMARY_TAG],
    revalidate: 1800,
  }),
)
