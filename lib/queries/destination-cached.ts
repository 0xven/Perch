import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getDestinationCommunityData } from './destination'

/** Cache tag, so a new contribution can invalidate this on demand later. */
export const COMMUNITY_DATA_TAG = 'destination-community'

/**
 * The community layer for a destination, cached two ways.
 *
 * unstable_cache: supabase-js issues an uncached fetch, and an uncached fetch is
 * a dynamic signal - on its own it was enough to stop /destinations/[slug] being
 * prerendered, which cost every visitor a full server render (measured: TTFB
 * 340ms, spiking to 1.4s, and x-vercel-cache MISS on every single request).
 * Putting the query in a cache scope lets the page prerender and be served from
 * the edge instead. Keyed by slug, so each destination caches separately.
 *
 * react cache(): the page streams this through several independent Suspense
 * boundaries at once - the tab panels plus the hero WiFi badge - and this
 * collapses those concurrent calls for the same slug into one lookup per render.
 *
 * 30 minutes matches the rest of the destination page. A contribution showing up
 * within half an hour is fine; the alternative was the page never being cached.
 */
export const getCommunityData = cache((slug: string) =>
  unstable_cache(
    () => getDestinationCommunityData(slug),
    ['destination-community-v1', slug],
    { tags: [COMMUNITY_DATA_TAG], revalidate: 1800 },
  )(),
)
