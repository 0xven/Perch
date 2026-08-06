import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { DestinationPinMapClient } from '@/components/maps/destination-pin-map-client'
import type { HillStation } from '@/lib/data/destinations'
import { wildlifeFor } from '@/lib/data/wildlife'
import { wildlifeImage } from '@/lib/data/wildlife-images'
import { advisoryFor } from '@/lib/data/advisories'
import { evSearchNear } from '@/lib/data/ev-networks'
import { Fact } from './ui'
import { WeatherCard, WeatherSkeleton } from './weather-card'
import { ClimateOutlook } from './climate-outlook'

const CATEGORY_TAG: Record<string, string> = {
  hill_station: 'Hill station', high_point: 'High pass / peak', forest: 'Forest & wildlife', gateway: 'Gateway', coastal: 'Coastal',
}

// Overview tab. Fully static: rendered from the catalogue, so it streams to the
// client immediately with no DB dependency.
export function OverviewTab({ dest }: { dest: HillStation }) {
  const wildlife = wildlifeFor(dest.slug)
  const wildlifePic = wildlifeImage(dest.slug)
  const advisory = advisoryFor(dest.slug)
  const isHigh = advisory?.level === 'high'

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        {/* ─── Travel advisory (only where care is genuinely needed) ─── */}
        {advisory ? (
          <div
            className={`rounded-2xl border p-5 ${
              isHigh
                ? 'border-[var(--clay)]/40 bg-[var(--clay)]/8'
                : 'border-[var(--brand-gold)]/45 bg-[var(--brand-gold)]/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>⚠️</span>
              <h2 className="font-display text-xl tracking-tight text-[var(--ink)]">
                Good to know before you go
              </h2>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isHigh ? 'bg-[var(--clay)] text-white' : 'bg-[var(--brand-gold)] text-[var(--ink)]'
                }`}
              >
                {isHigh ? 'Take care' : 'Good to know'}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {advisory.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm leading-relaxed text-[var(--ink)]">
                  <span className="mt-0.5 shrink-0 text-[var(--clay)]">•</span> {p}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-[var(--line)] pt-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">
              Conditions change with weather, season and local rules. Always check the latest official
              and local advisories before you travel.
            </p>
          </div>
        ) : null}

        <div className="card p-6">
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">Highlights</h2>
          <ul className="mt-3 space-y-2">
            {dest.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                <span className="mt-0.5 text-[var(--brand-mint)]">✦</span> {h}
              </li>
            ))}
          </ul>
        </div>

        {/* ─── Wildlife & nature (only when the place is famous for it) ─── */}
        {wildlife ? (
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] p-5 text-white">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">
                🐾 Wildlife &amp; nature
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-tight">{wildlife.park}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/85">{wildlife.note}</p>
            </div>
            {/* Real CC-licensed photo of the headline species, self-hosted under
                public/wildlife/. Credit line mirrors the destination hero. */}
            {wildlifePic ? (
              <figure className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--brand-deep)]">
                <Image
                  src={wildlifePic.url}
                  alt={`${wildlife.species[0]} - ${wildlife.park}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
                <figcaption>
                  <a
                    href={wildlifePic.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-1.5 right-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm transition-colors hover:text-white"
                  >
                    📷 {wildlifePic.attribution} / {wildlifePic.license} · Wikimedia
                  </a>
                </figcaption>
              </figure>
            ) : null}
            <div className="p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                Wildlife you may spot
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {wildlife.species.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-[var(--line)] bg-[var(--paper-deep)] px-3 py-1 text-xs font-medium text-[var(--ink)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-soft)]">
                Sightings are never guaranteed - go with a registered guide or forest-department safari,
                keep your distance, and never feed the animals.
              </p>
            </div>
          </div>
        ) : null}
        <div className="card p-6">
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">Working from here</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{dest.remoteWorkNote}</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            Community WiFi readings, work spots and route reports appear in the tabs above as
            travellers contribute them.
          </p>
        </div>

        {/* ─── Charging ─── */}
        <div className="card p-6">
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">🔌 Charging</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            On the hill routes a working DC charger can be an hour apart, so check live availability and
            start the climb with enough range. These open the current maps, not a list that goes stale.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={evSearchNear(`${dest.name}, ${dest.state}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
            >
              Chargers near {dest.name} ↗
            </a>
            <Link href="/charging" className="btn-ghost text-sm">
              All charging maps →
            </Link>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {/* Location map sits at the top of the facts column. */}
        <DestinationPinMapClient lat={dest.lat} lng={dest.lng} label={dest.name} />
        {/* Live weather streams in; the rest of the panel renders immediately. */}
        <Suspense fallback={<WeatherSkeleton />}>
          <WeatherCard lat={dest.lat} lng={dest.lng} name={dest.name} />
        </Suspense>
        <ClimateOutlook slug={dest.slug} />
        <Fact label="Elevation" value={`${dest.elevationM.toLocaleString()} m`} />
        <Fact label="Region" value={dest.region} />
        <Fact label="District" value={`${dest.district}, ${dest.state}`} />
        <Fact label="Type" value={CATEGORY_TAG[dest.category]} />
        <Fact label="Best season" value={dest.bestSeason} />
      </div>
    </div>
  )
}
