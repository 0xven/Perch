import { getWeather, weatherInfo } from '@/lib/queries/weather'

const DAY_FMT = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })

/** Live weather panel. Async server component - stream it behind <Suspense>. */
export async function WeatherCard({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const w = await getWeather(lat, lng)
  if (!w) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Live weather</h3>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">Weather is unavailable right now. Try again shortly.</p>
      </div>
    )
  }

  const now = weatherInfo(w.code)
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">Live weather</p>
            <p className="mt-0.5 text-4xl font-display leading-none">{w.tempC}°C</p>
            <p className="mt-1 text-sm text-white/80">{now.icon} {now.label}</p>
          </div>
          <span className="text-5xl leading-none" aria-hidden>{now.icon}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/75">
          <span>Feels like {w.feelsLikeC}°</span>
          <span>💧 {w.humidity}%</span>
          <span>💨 {w.windKmh} km/h</span>
        </div>
      </div>

      {/* 16 days is Open-Meteo's (and the industry's) real forecast horizon - a
          horizontally-scrollable strip rather than a grid, since 16 columns
          don't fit any reasonable card width. */}
      <div className="flex gap-px overflow-x-auto border-t border-[var(--line)] bg-[var(--line)]">
        {w.daily.map((d, i) => {
          const info = weatherInfo(d.code)
          return (
            <div key={d.date} className="min-w-[64px] flex-1 bg-[var(--surface)] px-2 py-3 text-center">
              <p className="text-[11px] font-medium text-[var(--ink-soft)]">
                {i === 0 ? 'Today' : DAY_FMT.format(new Date(d.date))}
              </p>
              <p className="mt-1 text-xl" aria-label={info.label}>{info.icon}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--ink)]">{d.tempMax}°</p>
              <p className="text-[11px] text-[var(--ink-soft)]">{d.tempMin}°</p>
              {d.precipChance !== null && d.precipChance > 0 ? (
                <p className="mt-0.5 text-[10px] text-[var(--brand)]">💧{d.precipChance}%</p>
              ) : (
                <p className="mt-0.5 text-[10px] text-transparent">·</p>
              )}
            </div>
          )
        })}
      </div>

      <p className="border-t border-[var(--line)] px-4 py-2 text-[10px] text-[var(--ink-soft)]">
        {w.daily.length}-day forecast for {name} ·{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">
          Open-Meteo
        </a>
      </p>
    </div>
  )
}

/** Skeleton shown while the live weather streams in. */
export function WeatherSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="h-[132px] animate-pulse bg-[var(--paper-deep)]" />
      <div className="h-[104px] animate-pulse border-t border-[var(--line)] bg-[var(--paper-deep)]/60" />
    </div>
  )
}
