'use client'

import { useMemo } from 'react'
import { altitudeAdvice, oxygenPercentAt } from '@/lib/data/altitude'
import { haversineKm } from '@/lib/data/places'
import { useVisitor } from './visitor-context'

/**
 * "Your baseline" - the panel that makes the page about the person reading it.
 *
 * Every figure here is measured or derived, never invented: ground elevation and
 * temperature come from Open-Meteo for their actual coordinates, oxygen comes
 * from the barometric formula, the connection estimate is the browser's own
 * `navigator.connection`, and the nearest hill station is a haversine over the
 * catalogue. If a value is unavailable it is omitted rather than guessed.
 */

export interface BaselineDestination {
  slug: string
  name: string
  state: string
  elevationM: number
  lat: number
  lng: number
}

export interface CityOption {
  name: string
  state: string
  lat: number
  lng: number
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-[14px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-4">
      <p className="mono text-[10px] uppercase tracking-[0.14em] text-[rgba(233,228,218,0.45)]">{label}</p>
      <p className={`disp mt-1.5 text-[26px] leading-none ${accent ? 'text-[#E0A93B]' : 'text-[#F3EFE6]'}`}>
        {value}
      </p>
      {sub ? <p className="mono mt-1.5 text-[10.5px] leading-relaxed text-[rgba(233,228,218,0.5)]">{sub}</p> : null}
    </div>
  )
}

export function YourBaseline({
  destinations,
  cities,
}: {
  destinations: BaselineDestination[]
  cities: CityOption[]
}) {
  const { place, ambient, status, errorMessage, requestLocation, setCity, clear } = useVisitor()

  const nearest = useMemo(() => {
    if (!place) return null
    let best: { d: BaselineDestination; km: number } | null = null
    for (const d of destinations) {
      const km = haversineKm(place, d)
      if (!best || km < best.km) best = { d, km }
    }
    return best
  }, [place, destinations])

  const localTime = useMemo(() => {
    if (!ambient.timeZone) return null
    try {
      return new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ambient.timeZone,
      }).format(new Date())
    } catch {
      return null
    }
  }, [ambient.timeZone])

  const busy = status === 'locating'

  // ─── Invitation ──────────────────────────────────────────────────────────
  if (!place) {
    return (
      <div className="rounded-[18px] border border-[rgba(224,169,59,0.25)] bg-[rgba(9,22,17,0.55)] p-6">
        <p className="mono text-[11px] uppercase tracking-[0.16em] text-[#E0A93B]">Make this about you</p>
        <h3 className="disp mt-2 text-[26px] text-[#F3EFE6]">
          Every number below is someone else&apos;s. Want yours?
        </h3>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-[rgba(233,228,218,0.6)]">
          Share where you are and this page recalculates around it: your ground elevation, the oxygen
          you&apos;re breathing right now, how much colder each hill station is than your street, and
          how far away it actually is.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={requestLocation}
            disabled={busy}
            className="rounded-[11px] bg-[#7FB89C] px-5 py-2.5 text-sm font-semibold text-[#0A1912] transition-opacity disabled:opacity-60"
          >
            {busy ? 'Locating…' : 'Use my location'}
          </button>

          <span className="mono text-[11px] text-[rgba(233,228,218,0.4)]">or</span>

          <label className="sr-only" htmlFor="perch-city">
            Pick your city
          </label>
          <select
            id="perch-city"
            defaultValue=""
            disabled={busy}
            onChange={(e) => {
              const city = cities.find((c) => c.name === e.target.value)
              if (city) setCity(city)
            }}
            className="rounded-[11px] border border-[rgba(233,228,218,0.25)] bg-[rgba(9,22,17,0.9)] px-4 py-2.5 text-sm text-[#E9E4DA] focus:border-[#7FB89C] focus:outline-none"
          >
            <option value="">Pick your city</option>
            {cities.map((c) => (
              <option key={`${c.name}-${c.lat}`} value={c.name}>
                {c.name} · {c.state}
              </option>
            ))}
          </select>
        </div>

        {errorMessage ? (
          <p className="mono mt-3 text-[11px] text-[#E0A93B]">{errorMessage}</p>
        ) : null}

        {/* Say plainly what happens. A location prompt with no explanation is
            how you teach people to click "block". */}
        <p className="mono mt-4 text-[10px] leading-relaxed text-[rgba(233,228,218,0.35)]">
          Your coordinates go to Open-Meteo to look up elevation and weather, and nowhere else. No
          account, no tracking, nothing stored on our side — only your choice, in this browser.
        </p>
      </div>
    )
  }

  // ─── Personalised ────────────────────────────────────────────────────────
  const elevation = place.elevationM
  const advice = elevation != null ? altitudeAdvice(elevation) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.16em] text-[#7FB89C]">
            Your baseline · {place.label}
          </p>
          <h3 className="disp mt-1.5 text-[clamp(26px,3.4vw,34px)] text-[#F3EFE6]">
            This is what you&apos;re starting from.
          </h3>
        </div>
        <button
          type="button"
          onClick={clear}
          className="mono text-[11px] text-[rgba(233,228,218,0.45)] underline underline-offset-4 transition-colors hover:text-[#E9E4DA]"
        >
          Reset
        </button>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {elevation != null ? (
          <Tile
            label="Your elevation"
            value={
              <>
                {elevation.toLocaleString()}
                <span className="text-[15px] text-[rgba(233,228,218,0.5)]"> m</span>
              </>
            }
            sub={advice?.label}
          />
        ) : null}

        {elevation != null ? (
          <Tile
            label="Air you're breathing"
            value={`${oxygenPercentAt(elevation)}%`}
            sub="Oxygen vs sea level, from the barometric formula"
          />
        ) : null}

        {place.tempC != null ? (
          <Tile
            label="Right now"
            value={
              <>
                {place.tempC}
                <span className="text-[15px] text-[rgba(233,228,218,0.5)]">°C</span>
              </>
            }
            sub={localTime ? `Local time ${localTime}` : undefined}
          />
        ) : null}

        {ambient.downlinkMbps != null ? (
          <Tile
            label="Your connection"
            value={
              <>
                {ambient.downlinkMbps}
                <span className="text-[15px] text-[rgba(233,228,218,0.5)]"> Mbps</span>
              </>
            }
            sub={
              ambient.effectiveType
                ? `${ambient.effectiveType.toUpperCase()} · the browser's own estimate, not a speed test`
                : undefined
            }
          />
        ) : null}

        {nearest ? (
          <Tile
            label="Nearest hill station"
            accent
            value={nearest.d.name}
            sub={`${nearest.km.toLocaleString()} km away · ${nearest.d.elevationM.toLocaleString()} m · ${nearest.d.state}`}
          />
        ) : null}
      </div>
    </div>
  )
}
