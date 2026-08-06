'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useVisitor } from './visitor-context'

/**
 * The featured destination grid, recalculated around the visitor.
 *
 * Before they share a location this is the ordinary curated list. After, every
 * card answers the two questions people actually ask - "how far is it?" and
 * "how much cooler is it than here?" - with real numbers: haversine distance,
 * the elevation the visitor would gain, and the measured difference between
 * their live temperature and the destination's. Cards reorder by distance,
 * nearest first, so the list is genuinely about where they are.
 */

export interface FromHereDestination {
  slug: string
  name: string
  state: string
  elevationM: number
  lat: number
  lng: number
  imageUrl: string | null
  /** Real WiFi average where the community has reported one, else best season. */
  fact: string
  tempC: number | null
}

export function FromHere({ destinations }: { destinations: FromHereDestination[] }) {
  const { place } = useVisitor()

  const rows = useMemo(() => {
    if (!place) return destinations.map((d) => ({ d, km: null as number | null, climbM: null as number | null, deltaC: null as number | null }))

    return destinations
      .map((d) => {
        // Inlined rather than imported so this stays a leaf client component -
        // haversineKm lives in places.ts, which pulls in the whole catalogue.
        const R = 6371
        const dLat = ((d.lat - place.lat) * Math.PI) / 180
        const dLng = ((d.lng - place.lng) * Math.PI) / 180
        const lat1 = (place.lat * Math.PI) / 180
        const lat2 = (d.lat * Math.PI) / 180
        const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
        const km = Math.round(2 * R * Math.asin(Math.sqrt(h)))

        const climbM = place.elevationM != null ? d.elevationM - place.elevationM : null
        const deltaC = place.tempC != null && d.tempC != null ? d.tempC - place.tempC : null
        return { d, km, climbM, deltaC }
      })
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
  }, [place, destinations])

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
      {rows.map(({ d, km, climbM, deltaC }) => (
        <Link
          key={d.slug}
          href={`/destinations/${d.slug}`}
          className="group relative block h-[300px] overflow-hidden rounded-[18px] border border-[rgba(127,184,156,0.16)] transition-transform duration-300 hover:-translate-y-1"
        >
          {d.imageUrl ? (
            <Image
              src={d.imageUrl}
              alt={d.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover saturate-[0.8]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,22,17,0.95)] via-[rgba(9,22,17,0.25)] to-[rgba(9,22,17,0.35)]" />

          <div className="relative flex h-full flex-col justify-between p-4">
            <div className="flex items-start justify-between">
              <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-white/60">{d.state}</span>
              <span className="mono rounded-full border border-white/25 bg-[rgba(9,22,17,0.5)] px-2.5 py-0.5 text-[10.5px] text-[#E9E4DA] backdrop-blur-sm">
                {d.elevationM.toLocaleString()}m
              </span>
            </div>

            <div>
              <h3 className="disp text-[27px] text-[#F3EFE6]">{d.name}</h3>

              {km != null ? (
                <div className="mono mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                  <span className="rounded-lg border border-[rgba(224,169,59,0.3)] bg-[rgba(224,169,59,0.12)] px-2 py-1 text-[#E0A93B]">
                    {km.toLocaleString()} km
                  </span>
                  {climbM != null ? (
                    <span className="rounded-lg border border-[rgba(127,184,156,0.25)] bg-[rgba(127,184,156,0.14)] px-2 py-1 text-[#A5CDB8]">
                      {climbM >= 0 ? '+' : '−'}
                      {Math.abs(climbM).toLocaleString()} m
                    </span>
                  ) : null}
                  {deltaC != null ? (
                    <span className="rounded-lg border border-[rgba(127,184,156,0.25)] bg-[rgba(127,184,156,0.14)] px-2 py-1 text-[#A5CDB8]">
                      {deltaC === 0 ? 'same temp' : `${Math.abs(deltaC)}° ${deltaC < 0 ? 'cooler' : 'warmer'}`}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mono mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(127,184,156,0.25)] bg-[rgba(127,184,156,0.14)] px-2.5 py-1 text-[10.5px] text-[#A5CDB8]">
                  {d.fact}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
