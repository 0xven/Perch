/**
 * Build-time climate-normals fetcher.
 *
 * "2-month weather outlook" is meteorologically impossible as a real daily
 * forecast - nothing, including AccuWeather, can predict specific days that far
 * out. What's honest and genuinely useful instead is climate NORMALS: what a
 * given month has actually looked like on average over recent years. This
 * script computes that from Open-Meteo's ARCHIVE API (historical observed
 * weather, keyless, $0 - same provider/family as the live forecast already
 * used in lib/queries/weather.ts, just the historical endpoint instead of the
 * forecast one) for every destination's last 3 full calendar years, aggregated
 * into 12 monthly normals: { month, avgHighC, avgLowC, rainyDaysAvg }.
 *
 * Output is a generated static module (same convention as
 * lib/data/destination-images.ts) - committed, zero runtime API calls, so the
 * live pages never depend on the archive API being up.
 *
 * Run:  npx tsx scripts/fetch-climate-normals.ts
 * Then commit lib/data/climate-normals.ts.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { DESTINATIONS } from '../lib/data/destinations'
import { CLIMATE_NORMALS as EXISTING, type MonthlyNormal } from '../lib/data/climate-normals'

// Incremental by default: keep already-resolved destinations (e.g. from a run
// that got rate-limited partway through) and only fetch what's missing. Pass
// --all to re-fetch everything from scratch.
const REFETCH_ALL = process.argv.includes('--all')

const UA = 'PerchTripPlanner/1.0 (https://github.com/perch; hobby project) contact: hello@perch.app'
const OUT_FILE = resolve(import.meta.dirname, '../lib/data/climate-normals.ts')

// 3 full calendar years back from "now", ending at the most recent New Year's
// Eve - the archive API only has confirmed historical data, not the current
// in-progress year.
const END_YEAR = new Date().getFullYear() - 1
const START_YEAR = END_YEAR - 2
const START_DATE = `${START_YEAR}-01-01`
const END_DATE = `${END_YEAR}-12-31`

// Open-Meteo accepts comma-separated lat/lng lists on the archive endpoint too
// (confirmed with a live test call) - batch destinations to keep this to a
// handful of requests instead of 97 sequential ones. Kept small with a longer
// pause between chunks: the archive API rate-limited a first attempt at
// CHUNK_SIZE=15 / 1.2s after only 2 chunks.
const CHUNK_SIZE = 8
const CHUNK_DELAY_MS = 4000

interface MonthAccum {
  highSum: number
  lowSum: number
  rainyDays: number
  days: number
}

function emptyMonths(): MonthAccum[] {
  return Array.from({ length: 12 }, () => ({ highSum: 0, lowSum: 0, rainyDays: 0, days: 0 }))
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchChunk(
  chunk: { slug: string; lat: number; lng: number }[],
  attempt = 1,
): Promise<Record<string, MonthAccum[]>> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', chunk.map((c) => c.lat).join(','))
  url.searchParams.set('longitude', chunk.map((c) => c.lng).join(','))
  url.searchParams.set('start_date', START_DATE)
  url.searchParams.set('end_date', END_DATE)
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum')
  url.searchParams.set('timezone', 'auto')

  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 && attempt <= 5) {
    const wait = attempt * 8000
    console.error(`  429 rate-limited on ${chunk[0].slug} chunk, retrying in ${wait / 1000}s (attempt ${attempt})`)
    await sleep(wait)
    return fetchChunk(chunk, attempt + 1)
  }
  if (!res.ok) {
    console.error(`  HTTP ${res.status} for chunk starting ${chunk[0].slug}`)
    return {}
  }
  const data = await res.json()
  const rows = Array.isArray(data) ? data : [data]

  const out: Record<string, MonthAccum[]> = {}
  rows.forEach((row, i) => {
    const p = chunk[i]
    const day = row?.daily
    if (!p || !day?.time) return
    const months = emptyMonths()
    ;(day.time as string[]).forEach((date: string, di: number) => {
      const m = Number(date.slice(5, 7)) - 1
      const hi = day.temperature_2m_max?.[di]
      const lo = day.temperature_2m_min?.[di]
      const rain = day.precipitation_sum?.[di]
      if (hi == null || lo == null) return
      months[m].highSum += hi
      months[m].lowSum += lo
      months[m].days += 1
      if (rain != null && rain >= 1) months[m].rainyDays += 1
    })
    out[p.slug] = months
  })
  return out
}

async function main() {
  const alreadyDone = REFETCH_ALL ? new Set<string>() : new Set(Object.keys(EXISTING))
  const points = DESTINATIONS
    .filter((d) => !alreadyDone.has(d.slug))
    .map((d) => ({ slug: d.slug, lat: d.lat, lng: d.lng }))

  console.log(
    `${alreadyDone.size} destinations already resolved, fetching ${points.length} more ` +
    `(${START_YEAR}-${END_YEAR} climate normals)...`,
  )
  if (points.length === 0) console.log('Nothing to fetch.')

  // Freshly-fetched destinations only - already-resolved ones are written
  // straight from EXISTING in the output loop below, untouched.
  const accum: Record<string, MonthAccum[]> = {}

  for (let i = 0; i < points.length; i += CHUNK_SIZE) {
    const chunk = points.slice(i, i + CHUNK_SIZE)
    console.log(`  chunk ${i / CHUNK_SIZE + 1}: ${chunk.map((c) => c.slug).join(', ')}`)
    const result = await fetchChunk(chunk)
    Object.assign(accum, result)
    if (i + CHUNK_SIZE < points.length) await sleep(CHUNK_DELAY_MS)
  }

  const totalResolved = Object.keys(EXISTING).length + Object.keys(accum).length
  console.log(`Resolved ${totalResolved}/${DESTINATIONS.length} destinations (${Object.keys(accum).length} new this run).`)

  const lines: string[] = []
  lines.push(`// AUTO-GENERATED by scripts/fetch-climate-normals.ts - do not edit by hand.`)
  lines.push(`// Source: Open-Meteo archive API (keyless, $0), ${START_YEAR}-${END_YEAR} daily observations`)
  lines.push(`// aggregated into monthly averages. This is CLIMATOLOGY (what a month has typically`)
  lines.push(`// looked like), not a forecast - nothing can forecast daily weather this far out.`)
  lines.push(`// Re-run: npx tsx scripts/fetch-climate-normals.ts`)
  lines.push(``)
  lines.push(`export interface MonthlyNormal {`)
  lines.push(`  month: number       // 1-12`)
  lines.push(`  avgHighC: number`)
  lines.push(`  avgLowC: number`)
  lines.push(`  rainyDaysAvg: number // avg days in the month with >=1mm precipitation`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`export const CLIMATE_NORMALS: Record<string, MonthlyNormal[]> = {`)
  for (const d of DESTINATIONS) {
    // Already-resolved from a prior run: keep verbatim, no recomputation.
    const existingRows = EXISTING[d.slug]
    if (existingRows) {
      const entries = existingRows.map(
        (r: MonthlyNormal) =>
          `{ month: ${r.month}, avgHighC: ${r.avgHighC}, avgLowC: ${r.avgLowC}, rainyDaysAvg: ${r.rainyDaysAvg} }`,
      )
      lines.push(`  "${d.slug}": [${entries.join(', ')}],`)
      continue
    }
    const months = accum[d.slug]
    if (!months) continue
    const entries = months.map((m, i) => {
      const years = END_YEAR - START_YEAR + 1
      const avgHigh = m.days > 0 ? Math.round((m.highSum / m.days) * 10) / 10 : 0
      const avgLow = m.days > 0 ? Math.round((m.lowSum / m.days) * 10) / 10 : 0
      const rainyDaysAvg = years > 0 ? Math.round((m.rainyDays / years) * 10) / 10 : 0
      return `{ month: ${i + 1}, avgHighC: ${avgHigh}, avgLowC: ${avgLow}, rainyDaysAvg: ${rainyDaysAvg} }`
    })
    lines.push(`  "${d.slug}": [${entries.join(', ')}],`)
  }
  lines.push(`}`)
  lines.push(``)
  lines.push(`const MONTH_NAMES = [`)
  lines.push(`  'January', 'February', 'March', 'April', 'May', 'June',`)
  lines.push(`  'July', 'August', 'September', 'October', 'November', 'December',`)
  lines.push(`] as const`)
  lines.push(``)
  lines.push(`export function monthName(month: number): string {`)
  lines.push(`  return MONTH_NAMES[(month - 1 + 12) % 12]`)
  lines.push(`}`)
  lines.push(``)
  lines.push(`/** This month's and next month's normals for a destination, or null if unresolved. */`)
  lines.push(`export function normalsFor(slug: string, month: number): MonthlyNormal | null {`)
  lines.push(`  const rows = CLIMATE_NORMALS[slug]`)
  lines.push(`  if (!rows) return null`)
  lines.push(`  return rows.find((r) => r.month === ((month - 1 + 12) % 12) + 1) ?? null`)
  lines.push(`}`)
  lines.push(``)

  writeFileSync(OUT_FILE, lines.join('\n'))
  console.log(`Wrote ${OUT_FILE}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
