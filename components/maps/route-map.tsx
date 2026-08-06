'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { OPENFREEMAP_STYLE } from '@/lib/data/places'

interface Point {
  lat: number
  lng: number
  label?: string
}

function markerEl(color: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #F7F4EF;box-shadow:0 2px 6px rgba(26,23,20,.35);`
  return el
}

// ─── Route map: origin + destination + connector line ────────────────────────

export function RouteMap({ origin, destination }: { origin: Point; destination: Point }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const map = new maplibregl.Map({
      container: ref.current,
      style: OPENFREEMAP_STYLE,
      center: [(origin.lng + destination.lng) / 2, (origin.lat + destination.lat) / 2],
      zoom: 6,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    new maplibregl.Marker({ element: markerEl('#6B6259') })
      .setLngLat([origin.lng, origin.lat])
      .setPopup(new maplibregl.Popup({ offset: 16 }).setText(origin.label ?? 'Origin'))
      .addTo(map)

    new maplibregl.Marker({ element: markerEl('#1C5240') })
      .setLngLat([destination.lng, destination.lat])
      .setPopup(new maplibregl.Popup({ offset: 16 }).setText(destination.label ?? 'Destination'))
      .addTo(map)

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
          },
        },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#1C5240',
          'line-width': 3,
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.7,
        },
      })

      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([origin.lng, origin.lat])
      bounds.extend([destination.lng, destination.lat])
      map.fitBounds(bounds, { padding: 70, maxZoom: 9, duration: 0 })
    })

    return () => map.remove()
  }, [origin, destination])

  return <div ref={ref} className="h-full w-full" />
}

// ─── Single destination pin ──────────────────────────────────────────────────

export function DestinationPinMap({ lat, lng, label }: Point) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const map = new maplibregl.Map({
      container: ref.current,
      style: OPENFREEMAP_STYLE,
      center: [lng, lat],
      zoom: 11,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    new maplibregl.Marker({ element: markerEl('#1C5240') })
      .setLngLat([lng, lat])
      .setPopup(new maplibregl.Popup({ offset: 16 }).setText(label ?? ''))
      .addTo(map)

    return () => map.remove()
  }, [lat, lng, label])

  return <div ref={ref} className="h-full w-full" />
}

// ─── Trip-report points ──────────────────────────────────────────────────────
// Every geotagged item in one report. Markers carry the kind's emoji so a fuel
// stop reads as a fuel stop at a glance, which matters when a single report can
// hold twenty items of a dozen different kinds.

export interface ReportPoint {
  lat: number
  lng: number
  label: string
  icon: string
  sub?: string
}

function reportMarkerEl(icon: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'width:30px;height:30px;border-radius:50%;background:#F7F4EF;border:2px solid #1C5240;' +
    'box-shadow:0 2px 8px rgba(26,23,20,.3);display:flex;align-items:center;justify-content:center;' +
    'font-size:15px;line-height:1;cursor:pointer;'
  el.textContent = icon
  return el
}

export function ReportPointsMap({ points }: { points: ReportPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || points.length === 0) return

    const map = new maplibregl.Map({
      container: ref.current,
      style: OPENFREEMAP_STYLE,
      center: [points[0].lng, points[0].lat],
      zoom: 9,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    const bounds = new maplibregl.LngLatBounds()
    for (const p of points) {
      new maplibregl.Marker({ element: reportMarkerEl(p.icon) })
        .setLngLat([p.lng, p.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setText(p.sub ? `${p.label} - ${p.sub}` : p.label),
        )
        .addTo(map)
      bounds.extend([p.lng, p.lat])
    }

    // A single point has zero-area bounds, which fitBounds cannot work with.
    if (points.length > 1) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 0 })
    } else {
      map.setZoom(11)
    }

    return () => map.remove()
  }, [points])

  return <div ref={ref} className="h-full w-full" />
}
