'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { OPENFREEMAP_STYLE } from '@/lib/data/places'
import { ROUTE_LINE, TRIP_STOPS, TRIP_META } from '@/lib/data/kashmir-trip'

const RIDE_SECONDS = 34

// The Himalayan 450 seen from ABOVE, rider up top - a map is a bird's-eye view,
// so a side-profile bike would read wrong. Nose points north (0deg) by default,
// which lets us rotate it straight to the compass heading. White body with a
// dark outline so it stays legible over pale plains and dark relief alike.
const BIKE_SVG = `
<svg viewBox="0 0 40 60" width="30" height="45" aria-hidden="true"
     style="overflow:visible;filter:drop-shadow(0 2px 3px rgba(26,23,20,.6))">
  <g stroke="#1A1714" stroke-width="7" fill="#1A1714" stroke-linejoin="round" stroke-linecap="round">
    <path d="M20 12 V48"/>
    <path d="M11 18 H29"/>
    <rect x="16.5" y="4" width="7" height="12" rx="3.5"/>
    <rect x="16.5" y="44" width="7" height="13" rx="3.5"/>
    <rect x="14" y="20" width="12" height="26" rx="5"/>
  </g>
  <rect x="16.5" y="4" width="7" height="12" rx="3.5" fill="#2A2723" stroke="#FFFFFF" stroke-width="1.8"/>
  <rect x="16.5" y="44" width="7" height="13" rx="3.5" fill="#2A2723" stroke="#FFFFFF" stroke-width="1.8"/>
  <path d="M11 18 H29" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="10.5" cy="18" r="2" fill="#FFFFFF"/><circle cx="29.5" cy="18" r="2" fill="#FFFFFF"/>
  <rect x="14" y="20" width="12" height="26" rx="5" fill="#FFFFFF" stroke="#1A1714" stroke-width="1.4"/>
  <path d="M13.5 22 L20 27 L26.5 22" fill="none" stroke="#1C5240" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20" cy="31" r="6" fill="#1C5240" stroke="#FFFFFF" stroke-width="2"/>
  <path d="M16.5 29.5 A 6 6 0 0 1 23.5 29.5 Z" fill="#7FB89C"/>
</svg>`

function dayMarker(day: number): HTMLDivElement {
  const el = document.createElement('div')
  el.textContent = String(day)
  el.style.cssText =
    'width:24px;height:24px;border-radius:50%;background:#1C5240;color:#F7F4EF;' +
    'border:2px solid #F7F4EF;box-shadow:0 2px 6px rgba(26,23,20,.4);' +
    'font:600 11px/20px system-ui;text-align:center;'
  return el
}

// ─── Polyline maths (planar is plenty at this scale) ─────────────────────────
type Pt = [number, number]

const SEG = ROUTE_LINE.slice(1).map((p, i) => {
  const a = ROUTE_LINE[i]
  return Math.hypot(p[0] - a[0], p[1] - a[1])
})
const CUM = SEG.reduce<number[]>((acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d], [])
const TOTAL = CUM[CUM.length - 1]

/** Position + heading at distance `dist` along the route. */
function atDistance(dist: number): { pos: Pt; bearingDeg: number; leg: number } {
  const d = Math.max(0, Math.min(dist, TOTAL))
  let leg = CUM.findIndex((c) => c >= d)
  if (leg < 0) leg = SEG.length - 1
  const legStart = leg === 0 ? 0 : CUM[leg - 1]
  const t = SEG[leg] === 0 ? 0 : (d - legStart) / SEG[leg]
  const a = ROUTE_LINE[leg]
  const b = ROUTE_LINE[leg + 1]
  const pos: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  // Compass bearing: 0 = north, 90 = east.
  const bearingDeg = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
  return { pos, bearingDeg, leg }
}

/** Route coordinates from the start up to `dist`, for the growing trail. */
function trailTo(dist: number): Pt[] {
  const { pos, leg } = atDistance(dist)
  return [...ROUTE_LINE.slice(0, leg + 1), pos] as Pt[]
}

/**
 * The circuit on one map: numbered day markers, the full route, and a white
 * Himalayan 450 that actually rides the loop - leaning into each turn, trailing
 * a line behind it, camera in tow. Reduced motion gets the static route.
 */
export function TripFlyover() {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const bikeRef = useRef<maplibregl.Marker | null>(null)
  const rotorRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef(0)
  const [riding, setRiding] = useState(false)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (!ref.current) return

    const map = new maplibregl.Map({
      container: ref.current,
      style: OPENFREEMAP_STYLE,
      center: [75.8, 33.2],
      zoom: 6,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    for (const s of TRIP_STOPS) {
      new maplibregl.Marker({ element: dayMarker(s.day) })
        .setLngLat([s.lng, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(`Day ${s.day} · ${s.name}`))
        .addTo(map)
    }

    // The bike: maplibre transforms the outer element for positioning, so the
    // heading rotation lives on an inner wrapper of our own.
    const bikeEl = document.createElement('div')
    const rotor = document.createElement('div')
    rotor.innerHTML = BIKE_SVG
    rotor.style.cssText = 'transition:transform .15s linear;will-change:transform;'
    bikeEl.appendChild(rotor)
    bikeEl.style.opacity = '0'
    rotorRef.current = rotor
    bikeRef.current = new maplibregl.Marker({ element: bikeEl })
      .setLngLat(ROUTE_LINE[0] as Pt)
      .addTo(map)

    map.on('load', () => {
      map.addSource('circuit', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ROUTE_LINE } },
      })
      map.addLayer({
        id: 'circuit-line',
        type: 'line',
        source: 'circuit',
        paint: { 'line-color': '#1C5240', 'line-width': 2, 'line-dasharray': [1.6, 1.4], 'line-opacity': 0.45 },
      })
      // The trail the bike paints as it rides.
      map.addSource('ridden', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'ridden-line',
        type: 'line',
        source: 'ridden',
        paint: { 'line-color': '#E0A93B', 'line-width': 4, 'line-opacity': 0.95, 'line-blur': 0.4 },
      })
      map.fitBounds(bounds(), { padding: 46, duration: 0 })
    })

    return () => {
      cancelAnimationFrame(rafRef.current)
      map.remove()
      mapRef.current = null
    }
  }, [])

  function bounds() {
    return ROUTE_LINE.reduce(
      (b, c) => b.extend(c as Pt),
      new maplibregl.LngLatBounds(ROUTE_LINE[0] as Pt, ROUTE_LINE[0] as Pt),
    )
  }

  function setTrail(dist: number) {
    const src = mapRef.current?.getSource('ridden') as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: trailTo(dist) } })
  }

  function stopRide() {
    cancelAnimationFrame(rafRef.current)
    setRiding(false)
    setPct(0)
    const map = mapRef.current
    if (!map) return
    map.stop()
    const bikeEl = bikeRef.current?.getElement()
    if (bikeEl) bikeEl.style.opacity = '0'
    setTrail(0)
    map.easeTo({ center: bounds().getCenter(), duration: 600 })
    map.fitBounds(bounds(), { padding: 46, duration: 700 })
  }

  function startRide() {
    const map = mapRef.current
    const bike = bikeRef.current
    if (!map || !bike || riding) { if (riding) stopRide(); return }

    const reduced = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      // No ride - just show the finished trail and the bike at the end.
      setTrail(TOTAL)
      bike.setLngLat(ROUTE_LINE[ROUTE_LINE.length - 1] as Pt).getElement().style.opacity = '1'
      setPct(100)
      return
    }

    setRiding(true)
    bike.getElement().style.opacity = '1'
    const t0 = performance.now()
    map.easeTo({ center: ROUTE_LINE[0] as Pt, zoom: 7.6, duration: 900 })

    const step = (now: number) => {
      const p = Math.min((now - t0) / (RIDE_SECONDS * 1000), 1)
      const { pos, bearingDeg } = atDistance(p * TOTAL)
      bike.setLngLat(pos)
      // The top-down bike already points north, so the compass heading maps straight through.
      if (rotorRef.current) rotorRef.current.style.transform = `rotate(${bearingDeg}deg)`
      setTrail(p * TOTAL)
      setPct(Math.round(p * 100))
      map.setCenter(pos)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        setRiding(false)
        map.fitBounds(bounds(), { padding: 46, duration: 1200 })
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      <button
        onClick={startRide}
        className="absolute bottom-3 left-3 z-10 rounded-xl bg-[var(--brand)] px-3.5 py-2 text-xs font-semibold text-[var(--paper)] shadow-[var(--elev-md)] transition hover:bg-[var(--brand-deep)]"
      >
        {riding ? `Riding · ${pct}% · tap to stop` : `▶ Ride the route · ${TRIP_META.distanceKm.toLocaleString()} km`}
      </button>
    </div>
  )
}
