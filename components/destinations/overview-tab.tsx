import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { DestinationPinMapClient } from '@/components/maps/destination-pin-map-client'
import { Reveal } from '@/components/fx/reveal'
import type { HillStation } from '@/lib/data/destinations'
import { wildlifeFor } from '@/lib/data/wildlife'
import { wildlifeImage } from '@/lib/data/wildlife-images'
import { advisoryFor } from '@/lib/data/advisories'
import { evSearchNear } from '@/lib/data/ev-networks'
import { GlanceStrip } from './glance-strip'
import { WeatherCard, WeatherSkeleton } from './weather-card'
import { ClimateOutlook } from './climate-outlook'

/**
 * Overview tab.
 *
 * Ordered by what someone actually wants first, which is not what they used to
 * get. This was two columns: prose on the left, and the map, weather and facts
 * stacked in a narrow rail on the right. On a phone the columns collapse in
 * source order, so you scrolled past Highlights, Wildlife, Working-from-here and
 * Charging before reaching a single live number.
 *
 * Now it reads top to bottom in order of decisiveness:
 *   1. the four instruments - how high, how thin the air, when to come, where
 *   2. the advisory, if this is a place that needs one
 *   3. where it is and what it is doing right now (map + weather + climate)
 *   4. the written detail, in a grid that no longer has to be a narrow column
 *
 * Still fully static and DB-free; only the weather streams.
 */
export function OverviewTab({ dest }: { dest: HillStation }) {
  const wildlife = wildlifeFor(dest.slug)
  const wildlifePic = wildlifeImage(dest.slug)
  const advisory = advisoryFor(dest.slug)
  const isHigh = advisory?.level === 'high'

  return (
    <div className="space-y-8">
      {/* ─── 1. At a glance ─────────────────────────────────────────────── */}
      <GlanceStrip dest={dest} />

      {/* ─── 2. Advisory, only where care is genuinely needed ───────────── */}
      {advisory ? (
        <Reveal>
          <div
            className={`overflow-hidden rounded-2xl border ${
              isHigh
                ? 'border-[var(--clay)]/40 bg-[var(--clay)]/8'
                : 'border-[var(--brand-gold)]/45 bg-[var(--brand-gold)]/10'
            }`}
          >
            <div className="flex items-center gap-2 px-5 pt-5">
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
            <ul className="mt-3 grid gap-2 px-5 sm:grid-cols-2">
              {advisory.points.map((p, i) => (
                <li
                  key={p}
                  className="mark-in flex items-start gap-2 text-sm leading-relaxed text-[var(--ink)]"
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                >
                  <span className="mt-0.5 shrink-0 text-[var(--clay)]">•</span> {p}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-[var(--line)]/70 px-5 py-2.5 text-[11px] leading-relaxed text-[var(--ink-soft)]">
              Conditions change with weather, season and local rules. Always check the latest official
              and local advisories before you travel.
            </p>
          </div>
        </Reveal>
      ) : null}

      {/* ─── 3. Map, full width ─────────────────────────────────────────── */}
      <Reveal>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--elev-sm)]">
          <DestinationPinMapClient
            lat={dest.lat}
            lng={dest.lng}
            label={dest.name}
            heightClass="h-[280px] sm:h-[360px] lg:h-[420px]"
          />
        </div>
      </Reveal>

      {/* ─── 4. Live weather, full width ────────────────────────────────────
          16 days is not a choice - it is Open-Meteo's hard ceiling (asking for
          more returns "Allowed range 0 to 16"), and no free provider forecasts
          further out because daily forecasts stop being meaningful past about
          two weeks. The climate outlook below is what covers the rest.
          min-w-0 is load-bearing: the forecast strip is 16 x 64px of intrinsic
          width and would otherwise force the whole page sideways on a phone
          instead of scrolling inside its own container. */}
      <Reveal>
        <div className="min-w-0">
          <Suspense fallback={<WeatherSkeleton />}>
            <WeatherCard lat={dest.lat} lng={dest.lng} name={dest.name} />
          </Suspense>
        </div>
      </Reveal>

      {/* ─── 5. Climate outlook, full width ─────────────────────────────── */}
      <Reveal>
        <div className="min-w-0">
          <ClimateOutlook slug={dest.slug} />
        </div>
      </Reveal>

      {/* ─── 6. Highlights + Charging, side by side ─────────────────────── */}
      <section className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <Reveal className="h-full">
          <div className="card card-hover h-full p-6">
            <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">Highlights</h2>
            <ul className="mt-3 space-y-2.5">
              {dest.highlights.map((h, i) => (
                <li
                  key={h}
                  className="mark-in flex items-start gap-2.5 text-sm text-[var(--ink-soft)]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="mt-0.5 text-[var(--brand-mint)]">✦</span> {h}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={80} className="h-full">
          <div className="card card-hover flex h-full flex-col p-6">
            <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">🔌 Charging</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              On the hill routes a working DC charger can be an hour apart, so check live availability
              and start the climb with enough range. These open the current maps, not a list that goes
              stale.
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
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
        </Reveal>
      </section>

      {/* ─── 7. Working from here, full width ───────────────────────────── */}
      <Reveal>
        <div className="card card-hover p-6">
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">Working from here</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--ink-soft)]">
            {dest.remoteWorkNote}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--ink-soft)]">
            Community WiFi readings, work spots and route reports appear in the tabs above as
            travellers contribute them.
          </p>
        </div>
      </Reveal>

      {/* ─── 8. Wildlife, only when the place is famous for it ───────────── */}
      {wildlife ? (
        <Reveal>
          <div className="card card-hover overflow-hidden">
            <div className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] p-5 text-white">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">
                🐾 Wildlife &amp; nature
              </p>
              <h2 className="mt-1 font-display text-2xl tracking-tight">{wildlife.park}</h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-white/85">{wildlife.note}</p>
            </div>
            {/* Real CC-licensed photo of the headline species, self-hosted under
                public/wildlife/. Credit line mirrors the destination hero. */}
            {wildlifePic ? (
              <figure className="group relative aspect-[16/7] w-full overflow-hidden bg-[var(--brand-deep)]">
                <Image
                  src={wildlifePic.url}
                  alt={`${wildlife.species[0]} - ${wildlife.park}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 1100px"
                  className="object-cover transition-transform duration-700 ease-[var(--motion-out)] group-hover:scale-105"
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
                {wildlife.species.map((s, i) => (
                  <span
                    key={s}
                    className="mark-in rounded-full border border-[var(--line)] bg-[var(--paper-deep)] px-3 py-1 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--brand-mint)]"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-soft)]">
                Sightings are never guaranteed - go with a registered guide or forest-department
                safari, keep your distance, and never feed the animals.
              </p>
            </div>
          </div>
        </Reveal>
      ) : null}
    </div>
  )
}
