// Live weather via Open-Meteo - free, open-source, NO API key, no billing.
// Same keyless / $0 philosophy as OpenFreeMap tiles and Overpass.
// https://open-meteo.com/  (CC-BY-4.0 data; attribute in the UI)

/** WMO weather interpretation codes -> label + emoji. */
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Rime fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy drizzle', icon: '🌦️' },
  56: { label: 'Freezing drizzle', icon: '🌧️' },
  57: { label: 'Freezing drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Freezing rain', icon: '🌧️' },
  67: { label: 'Freezing rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  77: { label: 'Snow grains', icon: '🌨️' },
  80: { label: 'Light showers', icon: '🌦️' },
  81: { label: 'Showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  85: { label: 'Snow showers', icon: '🌨️' },
  86: { label: 'Snow showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm, hail', icon: '⛈️' },
  99: { label: 'Thunderstorm, hail', icon: '⛈️' },
}

export function weatherInfo(code: number): { label: string; icon: string } {
  return WMO[code] ?? { label: 'Unknown', icon: '🌡️' }
}

export interface DailyForecast {
  date: string          // ISO date
  code: number
  tempMax: number
  tempMin: number
  precipChance: number | null
}

export interface Weather {
  tempC: number
  feelsLikeC: number
  humidity: number
  windKmh: number
  code: number
  isDay: boolean
  daily: DailyForecast[]
}

/** Compact live snapshot for list/card previews. */
export interface CurrentWeather {
  tempC: number
  code: number
  isDay: boolean
}

/**
 * Current conditions + 16-day forecast for a coordinate (Open-Meteo's documented
 * max forecast_days - real daily forecasts do not exist further out than this
 * from any provider, free or paid). Returns null on any failure so callers
 * render a graceful fallback instead of crashing. Cached for 30 minutes
 * (weather does not need to be fresher than that, and it keeps us well within
 * Open-Meteo's free limits).
 */
export async function getWeather(lat: number, lng: number): Promise<Weather | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lng))
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day')
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('forecast_days', '16')

    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) {
      console.error('[weather] HTTP', res.status)
      return null
    }
    const d = await res.json()
    const c = d.current
    const day = d.daily
    if (!c || !day) return null

    // Open-Meteo's furthest-out day (day 16) is occasionally returned
    // incomplete - weather_code/temps missing for that index even though
    // `time` still lists the date. Drop any day lacking real data rather than
    // rendering a bogus "0°/0°" cold snap.
    const daily: DailyForecast[] = (day.time as string[])
      .map((date: string, i: number) => ({
        date,
        code: day.weather_code?.[i],
        tempMax: day.temperature_2m_max?.[i],
        tempMin: day.temperature_2m_min?.[i],
        precipChance: day.precipitation_probability_max?.[i] ?? null,
      }))
      .filter((d): d is { date: string; code: number; tempMax: number; tempMin: number; precipChance: number | null } =>
        d.code != null && d.tempMax != null && d.tempMin != null,
      )
      .map((d) => ({ ...d, tempMax: Math.round(d.tempMax), tempMin: Math.round(d.tempMin) }))

    return {
      tempC: Math.round(c.temperature_2m),
      feelsLikeC: Math.round(c.apparent_temperature),
      humidity: Math.round(c.relative_humidity_2m),
      windKmh: Math.round(c.wind_speed_10m),
      code: c.weather_code,
      isDay: c.is_day === 1,
      daily,
    }
  } catch (e) {
    console.error('[getWeather]', e)
    return null
  }
}

/**
 * Current conditions for many coordinates in ONE request. Open-Meteo accepts
 * comma-separated lat/lng lists and returns an array (or a single object for one
 * point), so a whole destinations grid costs a single fetch. Returns a map keyed
 * by the caller's slug; missing/failed points are simply absent (graceful).
 */
export async function getWeatherBatch(
  points: { slug: string; lat: number; lng: number }[],
): Promise<Record<string, CurrentWeather>> {
  if (points.length === 0) return {}
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', points.map((p) => p.lat).join(','))
    url.searchParams.set('longitude', points.map((p) => p.lng).join(','))
    url.searchParams.set('current', 'temperature_2m,weather_code,is_day')
    url.searchParams.set('timezone', 'auto')

    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) {
      console.error('[weatherBatch] HTTP', res.status)
      return {}
    }
    const data = await res.json()
    // One point -> object; many points -> array. Normalise to an array.
    type Row = { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } }
    const rows: Row[] = Array.isArray(data) ? data : [data]

    const out: Record<string, CurrentWeather> = {}
    rows.forEach((row, i) => {
      const c = row?.current
      const p = points[i]
      if (!c || !p || c.temperature_2m == null) return
      out[p.slug] = {
        tempC: Math.round(c.temperature_2m),
        code: c.weather_code ?? 0,
        isDay: c.is_day === 1,
      }
    })
    return out
  } catch (e) {
    console.error('[getWeatherBatch]', e)
    return {}
  }
}
