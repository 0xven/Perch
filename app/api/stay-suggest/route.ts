import { filterStays, staysNearDestination } from '@/lib/data/stays-all'

/**
 * Autocomplete for the `stay` item kind, backed by the OpenStreetMap stays set.
 *
 * This is a route handler rather than a client-side filter because OSM_STAYS is
 * ~470KB - lib/data/stays-all.ts exists precisely so that list stays on the
 * server. Shipping it to the browser to power a typeahead would be a third of a
 * megabyte on a page most visitors will never submit.
 *
 * Open data, our own file, no upstream call: this costs nothing and needs no
 * key. It is dynamic only because it reads query params.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dest = (searchParams.get('dest') ?? '').trim()
  const q = (searchParams.get('q') ?? '').trim().slice(0, 80)

  // Nothing to go on at all would mean scanning the whole set for no reason.
  if (!dest && q.length < 2) return Response.json({ stays: [] })

  const matches = q
    ? filterStays({ dest: dest || 'all', q, sort: 'relevance' })
    : staysNearDestination(dest)

  const stays = matches.slice(0, 8).map((s) => ({
    name: s.name,
    area: s.area,
    state: s.state,
    lat: s.lat,
    lng: s.lng,
    type: s.type,
    wifi: s.hasInternet,
  }))

  return Response.json({ stays })
}
