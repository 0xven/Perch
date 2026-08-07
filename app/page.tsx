import type { Metadata } from 'next'
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from 'next/font/google'
import Link from 'next/link'
import Image from 'next/image'
import { AltimeterDial } from '@/components/home/altimeter-dial'
import { TelemetryTicker } from '@/components/home/telemetry-ticker'
import { VisitorProvider } from '@/components/home/visitor-context'
import { HeroBadge } from '@/components/home/hero-badge'
import { YourBaseline } from '@/components/home/your-baseline'
import { FromHere, type FromHereDestination } from '@/components/home/from-here'
import { EV_NETWORKS } from '@/lib/data/ev-networks'
import { DESTINATIONS, getDestination } from '@/lib/data/destinations'
import { destinationImage } from '@/lib/data/destination-images'
import { TRIP_META } from '@/lib/data/kashmir-trip'
import { ORIGIN_CITIES } from '@/lib/data/places'
import { STAY_TOTALS } from '@/lib/data/stays-all'
import { WILDLIFE } from '@/lib/data/wildlife'
import { getWifiBySlug } from '@/lib/queries/home'
import { getWeatherBatch } from '@/lib/queries/weather'
import { getSiteSettings } from '@/lib/queries/site-settings'
import { heroBadgeDefault, SITE_DEFAULTS } from '@/lib/data/site-defaults'

export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/**
 * Page-scoped type, not part of the curated sitewide allowlist in
 * lib/data/fonts.ts - that set ships on every route and backs the admin
 * settings font picker. This look is a one-off for the homepage only, so it
 * loads its own three families and applies them just to this page's wrapper.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
})
const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-schibsted-grotesk',
})
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
})

// Top 12 most-visited hill destinations across India (tourist footfall),
// spanning the Himalaya and the South.
const FEATURED_SLUGS = [
  'manali', 'shimla', 'ooty', 'munnar', 'nainital', 'srinagar',
  'gulmarg', 'leh', 'coorg', 'kodaikanal', 'mussoorie', 'dharamshala',
]

// Real WILDLIFE entries for destinations already in the featured set - no
// invented sighting timestamps, just what lib/data/wildlife.ts actually has.
const WILDLIFE_LOG_SLUGS = ['srinagar', 'munnar', 'coorg']

export default async function HomePage() {
  const destCount = DESTINATIONS.length
  const featuredList = FEATURED_SLUGS.map((s) => getDestination(s)!).filter(Boolean)

  // Live temperatures for the featured set arrive in ONE batched Open-Meteo
  // request - they are what the "13° cooler than you" deltas are measured
  // against once a visitor shares where they are.
  const [wifiBySlug, weatherBySlug, settings] = await Promise.all([
    getWifiBySlug(),
    getWeatherBatch(featuredList.map((d) => ({ slug: d.slug, lat: d.lat, lng: d.lng }))),
    getSiteSettings(),
  ])

  const wifiEntries = featuredList
    .map((d) => {
      const wifi = wifiBySlug[d.slug]
      return wifi?.avg_download_mbps != null ? { d, wifi, mbps: wifi.avg_download_mbps } : null
    })
    .filter((x): x is { d: (typeof featuredList)[number]; wifi: NonNullable<typeof wifiBySlug[string]>; mbps: number } => x !== null)

  const wildlifeLog = WILDLIFE_LOG_SLUGS.map((slug) => {
    const w = WILDLIFE[slug]
    const d = getDestination(slug)
    return w && d ? { animal: w.species[0], where: `${w.park} · ${d.name}` } : null
  }).filter((x): x is { animal: string; where: string } => x !== null)

  const tickerItems = [
    ...featuredList.slice(0, 4).map((d) => `ALT ${d.elevationM.toLocaleString()} m · ${d.name}`),
    ...wifiEntries.slice(0, 2).map(({ d, mbps }) => `WIFI ${mbps} Mbps · ${d.name}`),
    `EV ${EV_NETWORKS.length} networks mapped`,
    ...wildlifeLog.slice(0, 2).map((w) => `SIGHTING ${w.animal.toLowerCase()} · ${w.where.split(' · ')[1]}`),
    `STAYS ${STAY_TOTALS.total.toLocaleString()}+ mapped`,
  ]

  // Everything the personalised cards need, resolved on the server so the
  // 97-entry catalogue and the image manifest never travel to the browser.
  const fromHereDestinations: FromHereDestination[] = featuredList.map((d) => {
    const wifi = wifiBySlug[d.slug]
    return {
      slug: d.slug,
      name: d.name,
      state: d.state,
      elevationM: d.elevationM,
      lat: d.lat,
      lng: d.lng,
      imageUrl: destinationImage(d.slug)?.thumbUrl ?? null,
      fact:
        wifi?.avg_download_mbps != null
          ? `${wifi.avg_download_mbps} Mbps avg`
          : `Best: ${d.bestSeason.split('(')[0].trim()}`,
      tempC: weatherBySlug[d.slug]?.tempC ?? null,
    }
  })

  // The no-permission path: 145 curated origin cities with fixed coordinates,
  // so someone who will never grant location still gets the same real numbers.
  const cityOptions = ORIGIN_CITIES.map((c) => ({
    name: c.name,
    state: c.state,
    lat: c.lat,
    lng: c.lng,
  }))

  const connectivityBars = Array.from({ length: 14 }, (_, i) => ({
    h: `${28 + ((i * 37) % 48)}px`,
    c: i % 4 === 0 ? '#E0A93B' : '#7FB89C',
    dur: `${1.6 + (i % 5) * 0.3}s`,
    delay: `${(i % 7) * 0.18}s`,
  }))

  return (
    <VisitorProvider>
    <div
      className={`${newsreader.variable} ${schibstedGrotesk.variable} ${ibmPlexMono.variable} home-dark`}
    >
      {/* ─── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <svg
          viewBox="0 0 1200 620"
          preserveAspectRatio="xMidYMax slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <g fill="none" stroke="#7FB89C" strokeOpacity="0.09" strokeWidth="1.1">
            <path d="M-60 500 C180 420 340 540 600 460 S1020 380 1260 470" />
            <path d="M-60 540 C200 470 360 580 620 505 S1040 430 1260 515" />
            <path d="M-60 580 C220 520 380 620 640 555 S1060 485 1260 560" />
            <path d="M-60 460 C160 370 320 500 580 415 S1000 330 1260 425" />
            <path d="M-60 420 C140 320 300 460 560 370 S980 280 1260 380" />
          </g>
        </svg>

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 pb-16 pt-[78px] lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <HeroBadge referenceAltitude={TRIP_META.maxAltM}>
              {settings.hero_badge?.trim() || heroBadgeDefault(destCount)}
            </HeroBadge>
            <h1 className="rise disp mt-5 text-[clamp(48px,6.8vw,80px)] text-[#F3EFE6]">
              {settings.hero_title?.trim() || SITE_DEFAULTS.heroTitle}
              <br />
              <span className="italic text-[#E0A93B]">
                {settings.hero_title_accent?.trim() || SITE_DEFAULTS.heroTitleAccent}
              </span>
            </h1>
            <p className="rise delay-1 mt-6 max-w-[470px] text-[16.5px] text-[rgba(233,228,218,0.62)]">
              {settings.hero_subhead?.trim() || SITE_DEFAULTS.heroSubhead}
            </p>
            <div className="rise delay-2 mt-8 flex flex-wrap gap-3">
              <Link
                href="/destinations"
                className="rounded-[11px] bg-[#7FB89C] px-[22px] py-[13px] text-[15px] font-semibold text-[#0A1912]"
              >
                Explore destinations →
              </Link>
              {/* Trip finder, not /journeys: "plan a journey" is someone who
                  has not chosen a destination yet, and the finder is the tool
                  that answers that. /journeys is route write-ups for a trip
                  already decided on. */}
              <Link
                href="/trip-finder"
                className="rounded-[11px] border border-white/25 px-[22px] py-[13px] text-[15px] font-semibold text-[#E9E4DA]"
              >
                Plan a journey
              </Link>
            </div>
          </div>

          <div className="rise delay-3 flex justify-center">
            <AltimeterDial
              referenceAltitude={TRIP_META.maxAltM}
              referenceLabel={`${TRIP_META.maxAltName} · the Kashmir circuit's high point`}
            />
          </div>
        </div>

        <TelemetryTicker items={tickerItems} />
      </section>

      <div className="mx-auto max-w-6xl px-5 py-[76px] space-y-[88px]">
        {/* ─── YOUR BASELINE ────────────────────────────────────────────────
            Sits directly under the hero because it is the offer that makes the
            rest of the page personal - and it degrades to a plain invitation
            when the visitor declines, never a broken panel. */}
        <section>
          <YourBaseline destinations={fromHereDestinations} cities={cityOptions} />
        </section>

        {/* ─── THE PANEL ────────────────────────────────────────────────────── */}
        <section>
          <p className="mono m-0 text-[11px] uppercase tracking-[0.16em] text-[#7FB89C]">
            What Perch measures
          </p>
          <h2 className="disp mb-[26px] mt-2.5 text-[clamp(32px,4.2vw,46px)] text-[#F3EFE6]">
            The mountain, measured.
          </h2>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {/* Altitude & air */}
            <div className="rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-[22px]">
              <div className="flex items-center justify-between">
                <p className="mono m-0 text-[10.5px] uppercase tracking-[0.14em] text-[rgba(233,228,218,0.45)]">
                  Altitude &amp; air
                </p>
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#7FB89C]" />
              </div>
              <div className="mt-3.5 flex items-center gap-[18px]">
                <svg viewBox="0 0 96 96" width="96" height="96" className="shrink-0">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(233,228,218,0.1)" strokeWidth="7" />
                  <circle
                    cx="48" cy="48" r="40" fill="none" stroke="#7FB89C" strokeWidth="7"
                    strokeLinecap="round" strokeDasharray="251" strokeDashoffset="88"
                    transform="rotate(-90 48 48)"
                  />
                  <text x="48" y="46" textAnchor="middle" fontSize="16" fontWeight="600" fill="#F3EFE6" className="mono">65%</text>
                  <text x="48" y="60" textAnchor="middle" fontSize="8" fill="rgba(233,228,218,0.45)" className="mono">O₂ vs sea</text>
                </svg>
                <div>
                  <p className="disp m-0 text-[25px] text-[#F3EFE6]">Thin air is a schedule item.</p>
                  <p className="mt-1.5 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                    Every destination carries its altitude, oxygen fraction and acclimatisation days — so 3,500 m is a plan, not a surprise.
                  </p>
                </div>
              </div>
            </div>

            {/* Roads & riding */}
            <div className="rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-[22px]">
              <div className="flex items-center justify-between">
                <p className="mono m-0 text-[10.5px] uppercase tracking-[0.14em] text-[rgba(233,228,218,0.45)]">
                  Roads &amp; riding
                </p>
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#E0A93B]" />
              </div>
              <svg viewBox="0 0 280 96" className="mt-2.5 h-24 w-full">
                <path d="M8 80 C60 76 70 30 130 40 S220 78 272 24" fill="none" stroke="rgba(233,228,218,0.12)" strokeWidth="6" strokeLinecap="round" />
                <path
                  d="M8 80 C60 76 70 30 130 40 S220 78 272 24" fill="none" stroke="#E0A93B" strokeWidth="2"
                  strokeLinecap="round" strokeDasharray="8 10" className="dash-move"
                />
                <circle cx="130" cy="40" r="4" fill="#0A1912" stroke="#E0A93B" strokeWidth="2" />
                <text x="130" y="26" textAnchor="middle" fontSize="9" className="mono" fill="rgba(233,228,218,0.5)">hairpin 22 of 36</text>
              </svg>
              <p className="disp mt-2 text-[25px] text-[#F3EFE6]">Roads, as they actually are.</p>
              <p className="mt-1.5 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                Surface, hairpins, checkpoints and seasonal closures — logged from the saddle, not scraped from brochures.
              </p>
            </div>

            {/* Trekking */}
            <div className="rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-[22px]">
              <div className="flex items-center justify-between">
                <p className="mono m-0 text-[10.5px] uppercase tracking-[0.14em] text-[rgba(233,228,218,0.45)]">
                  Trekking
                </p>
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#7FB89C]" />
              </div>
              <svg viewBox="0 0 280 96" className="mt-2.5 h-24 w-full">
                <polyline
                  points="8,84 48,60 84,68 128,34 168,46 216,16 272,40" fill="none" stroke="#7FB89C" strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round" className="draw-loop"
                />
                <circle cx="216" cy="16" r="3.5" fill="#0A1912" stroke="#E0A93B" strokeWidth="2" />
                <text x="216" y="8" textAnchor="middle" fontSize="9" className="mono" fill="#E0A93B">ridge camp</text>
              </svg>
              <p className="disp mt-2 text-[25px] text-[#F3EFE6]">Trails with honest numbers.</p>
              <p className="mt-1.5 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                Gain, exposure, water points and how long it really takes — graded by people who walked it.
              </p>
            </div>

            {/* Connectivity */}
            <div className="rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-[22px]">
              <div className="flex items-center justify-between">
                <p className="mono m-0 text-[10.5px] uppercase tracking-[0.14em] text-[rgba(233,228,218,0.45)]">
                  Connectivity
                </p>
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#7FB89C]" />
              </div>
              <div className="mt-3.5 flex h-[76px] items-end gap-1.5">
                {connectivityBars.map((b, i) => (
                  <div
                    key={i}
                    className="bar-wave flex-1 rounded-t-[3px]"
                    style={{
                      height: b.h,
                      background: b.c,
                      ['--bar-dur' as string]: b.dur,
                      ['--bar-delay' as string]: b.delay,
                    }}
                  />
                ))}
              </div>
              <p className="disp mt-3 text-[25px] text-[#F3EFE6]">WiFi you can bet a call on.</p>
              <p className="mt-1.5 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                Speed tests run on-site, per stay and per town — down, up, and whether it survives a power cut.
              </p>
            </div>

            {/* Weather & feel */}
            <div className="relative overflow-hidden rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-[22px]">
              <svg viewBox="0 0 300 110" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full opacity-50">
                <path d="M0 110 L0 70 L60 30 L110 62 L170 18 L230 58 L300 34 L300 110 Z" fill="#122A20" />
                <path d="M0 110 L0 88 L50 60 L120 84 L190 52 L260 80 L300 66 L300 110 Z" fill="#1C5240" opacity="0.6" />
                <g className="cloud-drift">
                  <ellipse cx="80" cy="26" rx="26" ry="7" fill="rgba(233,228,218,0.12)" />
                  <ellipse cx="210" cy="14" rx="34" ry="8" fill="rgba(233,228,218,0.09)" />
                </g>
              </svg>
              <div className="relative flex items-center justify-between">
                <p className="mono m-0 text-[10.5px] uppercase tracking-[0.14em] text-[rgba(233,228,218,0.45)]">
                  Weather &amp; feel
                </p>
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#E0A93B]" />
              </div>
              <p className="disp relative mt-[46px] text-[25px] text-[#F3EFE6]">Know what the morning feels like.</p>
              <p className="relative mt-1.5 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                Fog windows, monsoon months, the week the rhododendrons open — season data tuned to feeling, not just forecast.
              </p>
            </div>

            {/* Wildlife log - real WILDLIFE.ts entries, no fabricated timestamps */}
            <div className="rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-[22px]">
              <div className="flex items-center justify-between">
                <p className="mono m-0 text-[10.5px] uppercase tracking-[0.14em] text-[rgba(233,228,218,0.45)]">
                  Wildlife log
                </p>
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#7FB89C]" />
              </div>
              <div className="mt-3.5 flex flex-col gap-2">
                {wildlifeLog.map((s) => (
                  <div
                    key={s.animal + s.where}
                    className="flex items-center justify-between rounded-[10px] border border-white/[0.08] px-3 py-2"
                  >
                    <span className="mono text-xs text-[#E9E4DA]">{s.animal}</span>
                    <span className="mono text-[10.5px] text-[rgba(233,228,218,0.42)]">{s.where}</span>
                  </div>
                ))}
              </div>
              <p className="disp mt-3 text-[25px] text-[#F3EFE6]">You&apos;re a guest here.</p>
              <p className="mt-1.5 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                Protected-area sightings and corridor notes, so you slow down where the forest crosses the road.
              </p>
            </div>
          </div>
        </section>

        {/* ─── DESTINATIONS ─────────────────────────────────────────────────── */}
        <section>
          <div className="mb-[22px] flex items-end justify-between">
            <div>
              <p className="mono m-0 text-[11px] uppercase tracking-[0.16em] text-[#7FB89C]">Where to perch</p>
              <h2 className="disp mt-2.5 text-[clamp(32px,4.2vw,46px)] text-[#F3EFE6]">
                {settings.featured_heading?.trim() || SITE_DEFAULTS.featuredHeading}
              </h2>
            </div>
            <Link href="/destinations" className="mono text-[12.5px] text-[#7FB89C]">
              All {destCount} →
            </Link>
          </div>

          {/* Reorders by distance and grows real "+2,228 m / 13° cooler"
              badges the moment a visitor shares where they are. */}
          <FromHere destinations={fromHereDestinations} />
        </section>

        {/* ─── STAYS + EV ───────────────────────────────────────────────────── */}
        <section>
          <p className="mono mb-4 text-[11px] uppercase tracking-[0.16em] text-[#7FB89C]">
            Once you&apos;ve picked a town
          </p>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            <Link
              href="/stays"
              className="block rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] p-6"
            >
              <p className="mono m-0 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-[#7FB89C]">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#7FB89C]" />
                Stays · {STAY_TOTALS.total.toLocaleString()}+ mapped
              </p>
              <h3 className="disp mb-1.5 mt-2.5 text-[26px] text-[#F3EFE6]">A desk with a view, vetted.</h3>
              <p className="m-0 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                Homestays and hotels filtered by tested WiFi, workspace and winter heating.
              </p>
              <span className="mono mt-3.5 inline-block text-[12.5px] text-[#7FB89C]">Search stays →</span>
            </Link>
            <Link
              href="/charging"
              className="block rounded-[18px] border border-[rgba(224,169,59,0.2)] bg-[rgba(9,22,17,0.55)] p-6"
            >
              <p className="mono m-0 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-[#E0A93B]">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#E0A93B]" />
                EV charging · {EV_NETWORKS.length} networks
              </p>
              <h3 className="disp mb-1.5 mt-2.5 text-[26px] text-[#F3EFE6]">
                {settings.ev_heading?.trim() || SITE_DEFAULTS.evHeading}
              </h3>
              <p className="m-0 text-[13.5px] text-[rgba(233,228,218,0.55)]">
                {settings.ev_body?.trim() || SITE_DEFAULTS.evBody}
              </p>
              <span className="mono mt-3.5 inline-block text-[12.5px] text-[#E0A93B]">See charging maps →</span>
            </Link>
          </div>
        </section>

        {/* ─── CONTRIBUTE ───────────────────────────────────────────────────── */}
        <section
          className="rounded-[20px] border border-[rgba(127,184,156,0.16)] px-6 py-14 text-center sm:px-8"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(28,82,64,0.5), rgba(9,22,17,0.4) 70%)' }}
        >
          <p className="mono m-0 text-[11px] uppercase tracking-[0.16em] text-[#7FB89C]">
            Built by the people on the road
          </p>
          <h2 className="disp mx-auto mt-3 max-w-[580px] text-[clamp(28px,4vw,42px)] text-[#F3EFE6]">
            {settings.cta_heading?.trim() || SITE_DEFAULTS.ctaHeading}
          </h2>
          <p className="mx-auto mt-3.5 max-w-[440px] text-[14.5px] text-[rgba(233,228,218,0.6)]">
            {settings.cta_body?.trim() || SITE_DEFAULTS.ctaBody}
          </p>
          <Link
            href="/contribute"
            className="mt-6 inline-block rounded-xl bg-[#E0A93B] px-6 py-[13px] text-[15px] font-semibold text-[#0A1912]"
          >
            Add a trip report →
          </Link>
        </section>
      </div>
    </div>
    </VisitorProvider>
  )
}
