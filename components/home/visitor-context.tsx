'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

/**
 * What we know about the visitor, and how we came to know it.
 *
 * PRIVACY, deliberately:
 *   - Geolocation is NEVER requested on load. It happens only when the visitor
 *     presses the button, which is also the only thing that triggers the
 *     browser's own permission prompt.
 *   - Their coordinates are sent to Open-Meteo (keyless, accountless) to look up
 *     ground elevation and current weather. Nothing goes to a Perch server,
 *     nothing is written to a database, and there is no analytics call here.
 *   - The only thing persisted is their choice, in localStorage, so the page
 *     does not nag them on every visit. Clearing it is one button.
 *   - There is a no-permission path: pick a city and get the same numbers. Some
 *     people will never grant location to a website, and they should not get a
 *     worse page for it.
 */

export interface VisitorPlace {
  label: string
  lat: number
  lng: number
  /** Ground elevation in metres, from Open-Meteo's elevation API. */
  elevationM: number | null
  tempC: number | null
  weatherCode: number | null
  source: 'geo' | 'city'
}

/**
 * Signals the browser gives up with no permission prompt at all. On a site whose
 * whole premise is "will the connection hold", the visitor's own live downlink
 * estimate is the most on-the-nose number we could possibly show them.
 */
export interface VisitorAmbient {
  timeZone: string | null
  downlinkMbps: number | null
  effectiveType: string | null
}

type Status = 'idle' | 'locating' | 'ready' | 'denied' | 'error'

interface VisitorState {
  place: VisitorPlace | null
  ambient: VisitorAmbient
  status: Status
  errorMessage: string | null
  requestLocation: () => void
  setCity: (city: { name: string; lat: number; lng: number }) => void
  clear: () => void
}

const VisitorContext = createContext<VisitorState | null>(null)

const STORAGE_KEY = 'perch:visitor-place:v1'

/** `navigator.connection` is real and widely shipped, but not in the TS DOM lib. */
interface NetworkInformation {
  downlink?: number
  effectiveType?: string
}

/**
 * Ambient signals are EXTERNAL browser state, so they are read through
 * useSyncExternalStore rather than an effect-plus-setState. That is the
 * primitive built for this: it gives React a server snapshot (all nulls, so the
 * markup matches during hydration), re-reads on the client, and re-renders when
 * the connection actually changes - a laptop moving from 5G tethering to hotel
 * WiFi updates the number without a refresh.
 */
function connectionOf(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { connection?: NetworkInformation }).connection
}

const SERVER_AMBIENT: VisitorAmbient = { timeZone: null, downlinkMbps: null, effectiveType: null }

// getSnapshot must be referentially stable between renders or React loops
// forever, so the last value is cached and only replaced when a field moves.
let ambientCache: VisitorAmbient = SERVER_AMBIENT

function getAmbientSnapshot(): VisitorAmbient {
  const conn = connectionOf()
  let timeZone: string | null = null
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    timeZone = null
  }
  const next: VisitorAmbient = {
    timeZone,
    downlinkMbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
    effectiveType: conn?.effectiveType ?? null,
  }
  if (
    next.timeZone !== ambientCache.timeZone ||
    next.downlinkMbps !== ambientCache.downlinkMbps ||
    next.effectiveType !== ambientCache.effectiveType
  ) {
    ambientCache = next
  }
  return ambientCache
}

function getServerAmbientSnapshot(): VisitorAmbient {
  return SERVER_AMBIENT
}

function subscribeAmbient(onChange: () => void): () => void {
  const conn = connectionOf() as (NetworkInformation & EventTarget) | undefined
  conn?.addEventListener?.('change', onChange)
  return () => conn?.removeEventListener?.('change', onChange)
}

/**
 * Elevation + current weather for a coordinate, in two keyless Open-Meteo calls.
 * Either half may fail without taking the other down - a missing temperature is
 * a blank field, not a broken panel.
 */
async function enrich(lat: number, lng: number): Promise<{ elevationM: number | null; tempC: number | null; weatherCode: number | null }> {
  const elevationUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code&timezone=auto`

  const [elevationRes, weatherRes] = await Promise.allSettled([
    fetch(elevationUrl).then((r) => (r.ok ? r.json() : null)),
    fetch(weatherUrl).then((r) => (r.ok ? r.json() : null)),
  ])

  let elevationM: number | null = null
  if (elevationRes.status === 'fulfilled') {
    const v = elevationRes.value?.elevation
    if (Array.isArray(v) && typeof v[0] === 'number') elevationM = Math.round(v[0])
  }

  let tempC: number | null = null
  let weatherCode: number | null = null
  if (weatherRes.status === 'fulfilled') {
    const c = weatherRes.value?.current
    if (typeof c?.temperature_2m === 'number') tempC = Math.round(c.temperature_2m)
    if (typeof c?.weather_code === 'number') weatherCode = c.weather_code
  }

  return { elevationM, tempC, weatherCode }
}

export function VisitorProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<VisitorPlace | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const ambient = useSyncExternalStore(subscribeAmbient, getAmbientSnapshot, getServerAmbientSnapshot)

  // Restore a previous choice. Coordinates are re-enriched rather than trusted
  // from storage, so a stale temperature never renders as if it were live.
  // Every setState here happens inside the async callback, never synchronously
  // in the effect body - that would cascade an extra render on first paint.
  useEffect(() => {
    let cancelled = false
    let saved: Pick<VisitorPlace, 'label' | 'lat' | 'lng' | 'source'> | null = null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) saved = JSON.parse(raw)
    } catch {
      // Corrupt or unavailable storage is not worth surfacing.
    }
    if (typeof saved?.lat !== 'number' || typeof saved?.lng !== 'number') return

    const restored = saved
    enrich(restored.lat, restored.lng).then((extra) => {
      if (cancelled) return
      setPlace({ ...restored, ...extra })
      setStatus('ready')
    })

    return () => {
      cancelled = true
    }
  }, [])

  const remember = useCallback((p: VisitorPlace) => {
    try {
      const { label, lat, lng, source } = p
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ label, lat, lng, source }))
    } catch {
      // Private mode / storage disabled - the feature still works this session.
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error')
      setErrorMessage('This browser cannot share a location. Pick your city instead.')
      return
    }
    setStatus('locating')
    setErrorMessage(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = +pos.coords.latitude.toFixed(4)
        const lng = +pos.coords.longitude.toFixed(4)
        const extra = await enrich(lat, lng)
        const next: VisitorPlace = { label: 'Where you are', lat, lng, source: 'geo', ...extra }
        setPlace(next)
        remember(next)
        setStatus('ready')
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied')
          setErrorMessage('No problem - pick your city instead and you get the same numbers.')
        } else {
          setStatus('error')
          setErrorMessage('Could not get a fix. Pick your city instead.')
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    )
  }, [remember])

  const setCity = useCallback(
    async (city: { name: string; lat: number; lng: number }) => {
      setStatus('locating')
      setErrorMessage(null)
      const extra = await enrich(city.lat, city.lng)
      const next: VisitorPlace = {
        label: city.name,
        lat: city.lat,
        lng: city.lng,
        source: 'city',
        ...extra,
      }
      setPlace(next)
      remember(next)
      setStatus('ready')
    },
    [remember],
  )

  const clear = useCallback(() => {
    setPlace(null)
    setStatus('idle')
    setErrorMessage(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clean up if storage was never available.
    }
  }, [])

  const value = useMemo<VisitorState>(
    () => ({ place, ambient, status, errorMessage, requestLocation, setCity, clear }),
    [place, ambient, status, errorMessage, requestLocation, setCity, clear],
  )

  return <VisitorContext.Provider value={value}>{children}</VisitorContext.Provider>
}

export function useVisitor(): VisitorState {
  const ctx = useContext(VisitorContext)
  if (!ctx) throw new Error('useVisitor must be used inside <VisitorProvider>')
  return ctx
}
