import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getDestination, DESTINATIONS } from '@/lib/data/destinations'
import { destinationImage } from '@/lib/data/destination-images'
import {
  applyOverride, getDestinationOverride, overrideImageUrl,
} from '@/lib/queries/destination-overrides'
import { OverviewTab } from '@/components/destinations/overview-tab'
import { StaysTab } from '@/components/destinations/stays-tab'
import {
  WifiTabStream, WorkSpotsTabStream, JourneysTabStream, StaysCommunityStream, HeroWifiBadge,
} from '@/components/destinations/community-streams'
import { TabSkeleton, StaysCommunitySkeleton } from '@/components/destinations/tab-skeletons'
import { DestinationTabs } from '@/components/destinations/tabs-client'
import { DestinationReports } from '@/components/reports/destination-reports'

export const revalidate = 3600

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const base = getDestination(slug)
  if (!base) return { title: 'Destination not found' }
  // An overridden summary is the one that should show up in search results too.
  const d = applyOverride(base, await getDestinationOverride(slug))
  return {
    title: `${d.name} - remote work & road trip guide`,
    description: d.summary,
  }
}

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'wifi',      label: '📶 WiFi' },
  { id: 'work',      label: '💻 Work spots' },
  { id: 'stay',      label: '🏡 Stays' },
  { id: 'journeys',  label: '🗺 Getting here' },
] as const

const CATEGORY_TAG: Record<string, string> = {
  hill_station: 'Hill station', high_point: 'High pass / peak', forest: 'Forest & wildlife', gateway: 'Gateway', coastal: 'Coastal',
}

function elevationTone(e: number): string {
  if (e > 2000) return 'from-[#23413a] via-[#1c5240] to-[#0f2a22]'
  if (e > 1500) return 'from-[#1c5240] via-[#1c5240] to-[#143c2f]'
  if (e > 1000) return 'from-[#2a6049] via-[#1c5240] to-[#143c2f]'
  if (e > 400)  return 'from-[#357a5b] via-[#2a6049] to-[#1c5240]'
  return 'from-[#2b6f7a] via-[#357a5b] to-[#1c5240]'
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  // searchParams is deliberately NOT read here. Awaiting it is a dynamic signal
  // and it was silently discarding this route's own generateStaticParams, so
  // every visit re-rendered the page instead of being served from the edge.
  // The `?tab=` parameter is read in the browser instead - see DestinationTabs.
  const { slug } = await params

  // Catalogue is the source of truth for the destination itself - this renders
  // immediately. The Supabase community layer streams in behind Suspense below.
  const base = getDestination(slug)
  if (!base) notFound()

  // The owner's override layer wins where it has a value. It uses the
  // cookie-less public client, so this page still statically generates and
  // falls back to the catalogue whenever the DB is unreachable.
  const override = await getDestinationOverride(slug)
  const dest = applyOverride(base, override)

  const staticImg = destinationImage(slug)
  const replacementImg = overrideImageUrl(override)
  const heroImg = replacementImg
    ? { url: replacementImg, attribution: null, license: null, sourceUrl: null }
    : staticImg

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className={`on-dark grain relative overflow-hidden bg-gradient-to-br ${elevationTone(dest.elevationM)}`}>
        {heroImg ? (
          <Image
            src={heroImg.url}
            alt={`${dest.name} landscape`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : null}
        {/* Scrim keeps the white hero text legible over any photo (bright or dark). */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/40" />
        {/* Credit belongs to the Wikimedia photo only. An owner-uploaded
            replacement is his own, so it carries no attribution line. */}
        {heroImg?.sourceUrl ? (
          <a
            href={heroImg.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-3 z-20 text-[10px] text-white/70 transition-colors hover:text-white"
          >
            📷 {heroImg.attribution} / {heroImg.license} · Wikimedia
          </a>
        ) : null}
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-10">
          <Link href="/destinations" className="text-xs text-white/50 transition-colors hover:text-white/80">
            ← All destinations
          </Link>

          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3 text-white">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/55">
                  {dest.region} · {dest.state}
                </p>
                <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{dest.name}</h1>
                <p className="mt-0.5 text-sm text-white/60">
                  {dest.district} · {dest.elevationM.toLocaleString()}m · {CATEGORY_TAG[dest.category]}
                </p>
              </div>

              <p className="max-w-lg text-sm leading-relaxed text-white/85">{dest.summary}</p>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs text-white">
                  Best season: {dest.bestSeason}
                </span>
                {/* WiFi avg is the only DB-backed hero piece - stream it. */}
                <Suspense fallback={null}>
                  <HeroWifiBadge slug={slug} />
                </Suspense>
              </div>

              <Link href={`/contribute?destination=${slug}`} className="inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-deep)] transition-colors hover:bg-white/90">
                Add a trip report
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tabs ───────────────────────────────────────────────────────────
          Every panel is server-rendered here and handed to a client switcher
          that reads ?tab=. The panels are still Server Components - they are
          rendered on the server and passed down as props, so the browser only
          decides which one is visible. */}
      <DestinationTabs
        slug={slug}
        tabs={TABS}
        panels={{
          overview: (
            <>
              <OverviewTab dest={dest} />
              {/* Cached read, so this stays prerendered like the rest of the tab. */}
              <DestinationReports slug={slug} name={dest.name} />
            </>
          ),
          wifi: (
            <Suspense fallback={<TabSkeleton />}>
              <WifiTabStream slug={slug} />
            </Suspense>
          ),
          work: (
            <Suspense fallback={<TabSkeleton />}>
              <WorkSpotsTabStream slug={slug} />
            </Suspense>
          ),
          stay: (
            <StaysTab
              dest={dest}
              slug={slug}
              communitySlot={
                <Suspense fallback={<StaysCommunitySkeleton />}>
                  <StaysCommunityStream slug={slug} />
                </Suspense>
              }
            />
          ),
          journeys: (
            <Suspense fallback={<TabSkeleton />}>
              <JourneysTabStream slug={slug} destName={dest.name} />
            </Suspense>
          ),
        }}
      />
    </div>
  )
}
