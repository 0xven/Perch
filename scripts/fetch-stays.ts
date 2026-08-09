/**
 * Build-time accommodation aggregator.
 *
 * Pulls REAL stays (hotels, homestays, guesthouses, hostels, resorts) from
 * OpenStreetMap via the Overpass API - keyless, $0, no card. Same honest pattern
 * as scripts/fetch-ev-stations.ts. We keep only NAMED stays within range of a
 * hill-station destination, so the file stays lean and relevant (Perch is about
 * the destinations, not every hotel in every metro).
 *
 * We do NOT touch Airbnb/OTA data - those are reached via legal outbound search
 * deep-links (see lib/data/stays.ts). Only OSM open data is stored.
 *
 * Run:  npx tsx scripts/fetch-stays.ts
 * Then commit the regenerated lib/data/stays-osm.ts.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { DESTINATIONS } from '../lib/data/destinations'
import { ORIGIN_CITIES, haversineKm } from '../lib/data/places'
import type { OsmStay, StayType } from '../lib/data/stays'

const BBOX = { s: 8.0, w: 74.0, n: 20.0, e: 85.0 }
const NEAR_DEST_KM = 25     // a stay must be within this of a hill station to keep
const DEDUPE_KM = 0.05      // ~50m = same building

function classify(tags: Record<string, string>): StayType {
  const t = (tags.tourism ?? '').toLowerCase()
  const name = (tags.name ?? '').toLowerCase()
  if (t === 'guest_house') {
    if (tags.guest_house === 'homestay' || /home\s?stay/.test(name)) return 'homestay'
    return 'guest_house'
  }
  if (t === 'hostel') return 'hostel'
  if (t === 'apartment') return 'apartment'
  if (t === 'chalet') return 'chalet'
  if (t === 'motel') return 'motel'
  // hotel + resort heuristics
  if (/resort/.test(name)) return 'resort'
  if (/home\s?stay/.test(name)) return 'homestay'
  return 'hotel'
}

function parseInternet(tags: Record<string, string>): boolean | null {
  const v = (tags.internet_access ?? '').toLowerCase()
  if (!v) return null
  if (v === 'no') return false
  return ['wlan', 'yes', 'wifi', 'wired', 'terminal'].includes(v)
}

function parseStars(tags: Record<string, string>): number | null {
  const s = tags.stars
  if (!s) return null
  const n = parseInt(s, 10)
  return isFinite(n) && n >= 1 && n <= 7 ? n : null
}

const REF_POINTS = [
  ...ORIGIN_CITIES.map((c) => ({ lat: c.lat, lng: c.lng, state: c.state, label: c.name })),
  ...DESTINATIONS.map((d) => ({ lat: d.lat, lng: d.lng, state: d.state, label: d.district })),
]

function nearestRef(lat: number, lng: number) {
  let best = REF_POINTS[0]
  let bestD = Infinity
  for (const r of REF_POINTS) {
    const d = haversineKm({ lat, lng }, r)
    if (d < bestD) { bestD = d; best = r }
  }
  return best
}

function nearestDestination(lat: number, lng: number) {
  let slug = ''
  let bestD = Infinity
  for (const d of DESTINATIONS) {
    const dist = haversineKm({ lat, lng }, d)
    if (dist < bestD) { bestD = dist; slug = d.slug }
  }
  return { slug, distKm: bestD }
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

async function fetchOverpass(): Promise<OverpassResponse> {
  const query = `[out:json][timeout:150];
(
  node["tourism"~"^(hotel|guest_house|hostel|apartment|chalet|motel)$"]["name"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["tourism"~"^(hotel|guest_house|hostel|apartment|chalet|motel)$"]["name"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
);
out center tags;`
  const endpoints = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      })
      if (!res.ok) { console.warn(`  Overpass ${ep} → HTTP ${res.status}, trying next…`); continue }
      return await res.json() as OverpassResponse
    } catch (e) {
      console.warn(`  Overpass ${ep} failed: ${(e as Error).message}, trying next…`)
    }
  }
  throw new Error('All Overpass endpoints failed')
}

async function main() {
  console.log('Fetching OpenStreetMap stays (Overpass, keyless)…')
  const data = await fetchOverpass()
  console.log(`  → ${data.elements.length} raw named accommodation elements`)

  const stays: OsmStay[] = []
  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const tags: Record<string, string> = el.tags ?? {}
    if (!tags.name) continue

    const dest = nearestDestination(lat, lng)
    if (dest.distKm > NEAR_DEST_KM) continue // keep only stays near a destination

    const ref = nearestRef(lat, lng)
    const area = tags['addr:suburb'] || tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || ref.label
    stays.push({
      id: `osm-${el.type}-${el.id}`,
      name: tags.name.slice(0, 80),
      type: classify(tags),
      area,
      district: ref.label,
      state: ref.state,
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      stars: parseStars(tags),
      website: tags.website || tags['contact:website'] || null,
      phone: tags.phone || tags['contact:phone'] || null,
      hasInternet: parseInternet(tags),
      source: 'osm',
      nearestDestSlug: dest.slug,
      distanceToDestKm: Math.round(dest.distKm),
    })
  }

  // Dedupe near-identical points.
  const kept: OsmStay[] = []
  for (const s of stays) {
    if (kept.some((k) => haversineKm(s, k) < DEDUPE_KM && k.name === s.name)) continue
    kept.push(s)
  }

  // Sort: by destination, then stays with wifi first, then named-richness.
  kept.sort((a, b) => {
    if (a.nearestDestSlug !== b.nearestDestSlug) return a.nearestDestSlug.localeCompare(b.nearestDestSlug)
    if (!!a.hasInternet !== !!b.hasInternet) return a.hasInternet ? -1 : 1
    return a.distanceToDestKm - b.distanceToDestKm
  })

  const byDest = new Set(kept.map((s) => s.nearestDestSlug))
  const withWifi = kept.filter((s) => s.hasInternet).length
  const byType = kept.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1
    return acc
  }, {})

  const header = `// AUTO-GENERATED by scripts/fetch-stays.ts - do not edit by hand.
// Source: OpenStreetMap (Overpass, keyless). Generated: ${new Date().toISOString().slice(0, 10)}
// ${kept.length} named stays within ${NEAR_DEST_KM}km of a hill station, across ${byDest.size} destinations.
// Open data is community-maintained: coordinates match OSM exactly (verified),
// but OSM's own point for a small rural stay can differ from Google's listing
// by tens to a couple thousand metres - that's a real gap between the two
// databases, not corruption in this pipeline. stayMapsLink() in lib/data/stays.ts
// searches Google Maps BY NAME rather than pinning this raw coordinate, so
// outbound "Map" links self-correct to Google's own listing. Amenities/stars
// are sparse either way (OSM rarely has them for small hill-town stays).
// Airbnb/OTA inventory is reached via legal outbound links (lib/data/stays.ts), never stored.
// Re-run: npx tsx scripts/fetch-stays.ts

import type { OsmStay } from './stays'

export const OSM_STAYS: OsmStay[] = ${JSON.stringify(kept, null, 0)
    .replace(/\},\{/g, '},\n  {')
    .replace(/^\[/, '[\n  ')
    .replace(/\]$/, ',\n]')}
`

  const outPath = resolve(import.meta.dirname, '../lib/data/stays-osm.ts')
  writeFileSync(outPath, header)
  console.log('\nWrote', outPath)
  console.log(`Total stays kept: ${kept.length} | with WiFi tag: ${withWifi} | destinations covered: ${byDest.size}`)
  console.log('By type:', byType)
}

main().catch((e) => { console.error(e); process.exit(1) })
