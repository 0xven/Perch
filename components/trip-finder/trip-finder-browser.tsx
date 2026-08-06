'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  DESTINATIONS, DEST_STATES, DESTINATION_CATEGORIES,
  type HillStation, type DestinationCategory,
} from '@/lib/data/destinations'
import { destinationImage } from '@/lib/data/destination-images'
import { normalsFor, monthName } from '@/lib/data/climate-normals'
import { climateType, CLIMATE_TYPES, CLIMATE_TYPE_LABEL, type ClimateType } from '@/lib/data/climate-type'
import { haversineKm, ALL_PLACES, type Place } from '@/lib/data/places'
import { type CurrentWeather } from '@/lib/queries/weather'
import { WeatherChip } from '@/components/destinations/weather-chip'
import { PlaceCombobox } from '@/components/search/place-combobox'

type SortKey = 'name' | 'tempFit' | 'distance' | 'elevation'

const TEMP_MIN = -10
const TEMP_MAX = 40
const ELEV_MIN = 0
const ELEV_MAX = 5500

const CATEGORY_TAG: Record<DestinationCategory, string> = {
  hill_station: 'Hill station', high_point: 'High pass / peak', forest: 'Forest & wildlife',
  gateway: 'Gateway', coastal: 'Coastal',
}

const TEMP_PRESETS: { label: string; min: number; max: number }[] = [
  { label: 'Cool (<15°C)', min: TEMP_MIN, max: 15 },
  { label: 'Mild (15-25°C)', min: 15, max: 25 },
  { label: 'Warm (>25°C)', min: 25, max: TEMP_MAX },
]

const ELEV_PRESETS: { label: string; min: number; max: number }[] = [
  { label: 'Low (<1,000m)', min: ELEV_MIN, max: 1000 },
  { label: 'Mid (1,000-2,500m)', min: 1000, max: 2500 },
  { label: 'High (>2,500m)', min: 2500, max: ELEV_MAX },
]

export function TripFinderBrowser({ weatherBySlug = {} }: { weatherBySlug?: Record<string, CurrentWeather> }) {
  const currentMonth = new Date().getMonth() + 1

  const [month, setMonth] = useState(currentMonth)
  const [tempMin, setTempMin] = useState(TEMP_MIN)
  const [tempMax, setTempMax] = useState(TEMP_MAX)
  const [elevMin, setElevMin] = useState(ELEV_MIN)
  const [elevMax, setElevMax] = useState(ELEV_MAX)
  const [climateFilter, setClimateFilter] = useState<ClimateType | 'all'>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [fromPlace, setFromPlace] = useState<Place | null>(null)
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('name')

  const targetTemp = (tempMin + tempMax) / 2

  const rows = useMemo(() => {
    return DESTINATIONS
      .map((d) => {
        const normal = normalsFor(d.slug, month)
        const distanceKm = fromPlace ? haversineKm(fromPlace, d) : null
        const ct = climateType(d.elevationM, d.category)
        return { d, normal, distanceKm, ct }
      })
      .filter(({ d, normal, distanceKm, ct }) => {
        if (stateFilter !== 'all' && d.state !== stateFilter) return false
        if (categoryFilter !== 'all' && d.category !== categoryFilter) return false
        if (climateFilter !== 'all' && ct !== climateFilter) return false
        if (d.elevationM < elevMin || d.elevationM > elevMax) return false
        if (normal && (normal.avgHighC < tempMin || normal.avgLowC > tempMax)) return false
        if (maxDistanceKm != null && (distanceKm == null || distanceKm > maxDistanceKm)) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'distance') return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        if (sortBy === 'elevation') return b.d.elevationM - a.d.elevationM
        if (sortBy === 'tempFit') {
          const fitA = a.normal ? Math.abs(((a.normal.avgHighC + a.normal.avgLowC) / 2) - targetTemp) : Infinity
          const fitB = b.normal ? Math.abs(((b.normal.avgHighC + b.normal.avgLowC) / 2) - targetTemp) : Infinity
          return fitA - fitB
        }
        return a.d.name.localeCompare(b.d.name)
      })
  }, [month, tempMin, tempMax, elevMin, elevMax, climateFilter, stateFilter, categoryFilter, fromPlace, maxDistanceKm, sortBy, targetTemp])

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Month</p>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--brand)] focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{monthName(m)}{m === currentMonth ? ' (now)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Typical temperature that month
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMP_PRESETS.map((p) => (
              <Chip
                key={p.label}
                small
                active={tempMin === p.min && tempMax === p.max}
                onClick={() => { setTempMin(p.min); setTempMax(p.max) }}
              >
                {p.label}
              </Chip>
            ))}
            <Chip small active={tempMin === TEMP_MIN && tempMax === TEMP_MAX} onClick={() => { setTempMin(TEMP_MIN); setTempMax(TEMP_MAX) }}>
              Any
            </Chip>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <NumberField value={tempMin} onChange={setTempMin} suffix="°C" aria="Minimum temperature" />
            <span className="text-[var(--ink-soft)]">to</span>
            <NumberField value={tempMax} onChange={setTempMax} suffix="°C" aria="Maximum temperature" />
          </div>
          <p className="text-[11px] text-[var(--ink-soft)]">
            Based on avg daily high/low for {monthName(month)}, from recent years.
          </p>
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Climate type</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip small active={climateFilter === 'all'} onClick={() => setClimateFilter('all')}>All</Chip>
            {CLIMATE_TYPES.map((c) => (
              <Chip key={c} small active={climateFilter === c} onClick={() => setClimateFilter(c)}>
                {CLIMATE_TYPE_LABEL[c].split(' (')[0]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Elevation</p>
          <div className="flex flex-wrap gap-1.5">
            {ELEV_PRESETS.map((p) => (
              <Chip
                key={p.label}
                small
                active={elevMin === p.min && elevMax === p.max}
                onClick={() => { setElevMin(p.min); setElevMax(p.max) }}
              >
                {p.label}
              </Chip>
            ))}
            <Chip small active={elevMin === ELEV_MIN && elevMax === ELEV_MAX} onClick={() => { setElevMin(ELEV_MIN); setElevMax(ELEV_MAX) }}>
              Any
            </Chip>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <NumberField value={elevMin} onChange={setElevMin} suffix="m" aria="Minimum elevation" step={100} />
            <span className="text-[var(--ink-soft)]">to</span>
            <NumberField value={elevMax} onChange={setElevMax} suffix="m" aria="Maximum elevation" step={100} />
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">Distance from</p>
          <PlaceCombobox
            placeholder="Your city or a destination…"
            places={ALL_PLACES}
            onSelect={setFromPlace}
          />
          {fromPlace ? (
            <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <span className="text-xs text-[var(--ink-soft)]">Within</span>
              <NumberField
                value={maxDistanceKm ?? 2000}
                onChange={setMaxDistanceKm}
                suffix="km"
                aria="Maximum distance"
                step={50}
              />
              <button
                onClick={() => { setFromPlace(null); setMaxDistanceKm(null) }}
                className="ml-auto text-xs text-[var(--clay)] underline"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">State</p>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--brand)] focus:outline-none"
          >
            <option value="all">All states</option>
            {DEST_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            <Chip small active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All types</Chip>
            {DESTINATION_CATEGORIES.map((c) => (
              <Chip key={c.id} small active={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>{c.label}</Chip>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── Results ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--ink-soft)]">
            {rows.length} {rows.length === 1 ? 'match' : 'matches'}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] focus:border-[var(--brand)] focus:outline-none"
          >
            <option value="name">Sort: A-Z</option>
            <option value="tempFit">Sort: best temperature match</option>
            {fromPlace ? <option value="distance">Sort: closest first</option> : null}
            <option value="elevation">Sort: highest elevation</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] p-12 text-center text-[var(--ink-soft)]">
            Nothing matches those filters. Try widening the temperature or elevation range.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ d, normal, distanceKm, ct }) => (
              <ResultCard key={d.slug} dest={d} normal={normal} distanceKm={distanceKm} climate={ct} weather={weatherBySlug[d.slug]} month={month} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResultCard({
  dest, normal, distanceKm, climate, weather, month,
}: {
  dest: HillStation
  normal: ReturnType<typeof normalsFor>
  distanceKm: number | null
  climate: ClimateType
  weather?: CurrentWeather
  month: number
}) {
  const img = destinationImage(dest.slug)
  return (
    <Link href={`/destinations/${dest.slug}`} className="card card-hover group overflow-hidden">
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)]">
        {img ? (
          <Image
            src={img.thumbUrl}
            alt={dest.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
        <div className="relative flex h-full flex-col justify-between p-3.5">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/70">{dest.state}</span>
            <WeatherChip weather={weather} />
          </div>
          <h3 className="font-display text-lg text-white drop-shadow-sm">{dest.name}</h3>
        </div>
      </div>
      <div className="space-y-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-soft)]">
          <span className="rounded-md bg-[var(--paper-deep)] px-2 py-0.5">{CATEGORY_TAG[dest.category]}</span>
          <span className="rounded-md bg-[var(--paper-deep)] px-2 py-0.5">{CLIMATE_TYPE_LABEL[climate].split(' (')[0]}</span>
          <span>{dest.elevationM.toLocaleString()}m</span>
        </div>
        {normal ? (
          <p className="text-sm text-[var(--ink)]">
            {monthName(month)}: <span className="font-semibold">{normal.avgHighC}°/{normal.avgLowC}°</span>
            <span className="text-[var(--ink-soft)]"> typical · ~{Math.round(normal.rainyDaysAvg)} rainy days</span>
          </p>
        ) : null}
        {distanceKm != null ? (
          <p className="text-xs font-medium text-[var(--brand)]">{distanceKm.toLocaleString()} km away</p>
        ) : null}
      </div>
    </Link>
  )
}

function NumberField({
  value, onChange, suffix, aria, step = 1,
}: {
  value: number
  onChange: (v: number) => void
  suffix: string
  aria: string
  step?: number
}) {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5">
      <input
        type="number"
        aria-label={aria}
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 bg-transparent text-sm text-[var(--ink)] focus:outline-none"
      />
      <span className="text-xs text-[var(--ink-soft)]">{suffix}</span>
    </span>
  )
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full font-medium transition-colors ${small ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${
        active
          ? 'bg-[var(--brand)] text-[var(--paper)]'
          : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--brand-mint)]'
      }`}
    >
      {children}
    </button>
  )
}
