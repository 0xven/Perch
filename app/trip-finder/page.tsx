import { TripFinderBrowser } from '@/components/trip-finder/trip-finder-browser'
import { DESTINATIONS } from '@/lib/data/destinations'
import { getWeatherBatch } from '@/lib/queries/weather'

export const revalidate = 3600

export const metadata = {
  title: 'Trip finder - filter hill stations by temperature, climate & distance',
  description:
    'Find the right hill station by month-by-month temperature, climate type, elevation and distance from where you are - across 97 destinations from the Western Ghats to the Himalaya.',
}

export default async function TripFinderPage() {
  // Same batching pattern as /destinations - one Open-Meteo request for every
  // destination's live conditions, shown alongside the climate-normal filter.
  const weatherBySlug = await getWeatherBatch(
    DESTINATIONS.map((d) => ({ slug: d.slug, lat: d.lat, lng: d.lng })),
  )

  return (
    <div>
      <section className="on-dark grain relative overflow-hidden bg-[var(--brand-deep)]">
        <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-[var(--brand-gold)] opacity-15 blur-[110px]" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-mint)]">
            Trip finder
          </p>
          <h1 className="rise mt-2 max-w-2xl font-display text-4xl tracking-tight text-white sm:text-5xl">
            Find the place that fits, not just the pretty one.
          </h1>
          <p className="rise delay-1 mt-3 max-w-xl text-white/70">
            Filter by what a month typically feels like there, climate type, elevation and distance from
            wherever you&apos;re starting from.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <TripFinderBrowser weatherBySlug={weatherBySlug} />
      </div>
    </div>
  )
}
