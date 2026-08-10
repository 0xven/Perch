import type { Metadata } from 'next'
import Link from 'next/link'
import { DESTINATIONS, DEST_STATES, getDestination } from '@/lib/data/destinations'
import { filterStays, STAY_TYPES_PRESENT, STAY_TOTALS, type StaySort } from '@/lib/data/stays-all'
import { StaysFilterBar } from '@/components/stays/stays-filter-bar'
import { StayCard } from '@/components/stays/stay-card'
import { BookingLinks } from '@/components/stays/booking-links'
import { getStayNotes, stayNoteKey } from '@/lib/queries/stay-reports'

export const metadata: Metadata = {
  title: 'Stays - where to stay across South India',
  description:
    'Search and filter places to stay near every South Indian hill station - homestays, hotels, guesthouses and resorts from open data, plus live links to Airbnb, Booking.com, Agoda and more.',
}

const RESULT_CAP = 90

export default async function StaysPage({
  searchParams,
}: {
  searchParams: Promise<{ dest?: string; type?: string; wifi?: string; q?: string; sort?: string }>
}) {
  const sp = await searchParams
  const current = {
    dest: sp.dest ?? 'all',
    type: sp.type ?? 'all',
    wifi: sp.wifi === '1',
    q: sp.q ?? '',
    sort: sp.sort ?? 'relevance',
  }

  const all = filterStays({
    dest: current.dest,
    type: current.type,
    wifi: current.wifi,
    q: current.q,
    sort: current.sort as StaySort,
  })

  // One cached query for every card on the page rather than one per stay.
  // Empty until people file reports, and empty is a fine state - the card just
  // shows its generated cover and the outbound links.
  const stayNotes = await getStayNotes()

  const selectedDest = current.dest !== 'all' ? getDestination(current.dest) : undefined
  const capped = current.dest === 'all' ? all.slice(0, RESULT_CAP) : all
  const place = selectedDest ? `${selectedDest.name}, ${selectedDest.state}` : 'South India'

  const destinationOptions = DESTINATIONS.map((d) => ({ slug: d.slug, name: d.name, state: d.state }))

  return (
    <div>
      {/* Hero */}
      <section className="on-dark grain relative overflow-hidden bg-[var(--ink)]">
        <div className="pointer-events-none absolute -right-16 top-0 h-72 w-72 rounded-full bg-[var(--brand-mint)] opacity-15 blur-[110px]" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[var(--brand-gold)] opacity-15 blur-[110px]" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-16">
          <Link href="/" className="text-xs text-white/40 transition-colors hover:text-white/70">← Home</Link>
          <h1 className="rise mt-4 max-w-2xl font-display text-4xl leading-tight tracking-tight text-white sm:text-6xl">
            Find a stay <span className="italic text-[var(--brand-mint)]">worth working from.</span>
          </h1>
          <p className="rise delay-1 mt-5 max-w-xl text-lg text-white/70">
            Search homestays, hotels and resorts near every hill station - then jump straight to live
            availability on Airbnb, Booking.com, Agoda and more.
          </p>
          <div className="rise delay-2 mt-8 flex gap-8">
            {[
              { n: `${STAY_TOTALS.total}+`, l: 'Stays mapped' },
              { n: STAY_TOTALS.destinations, l: 'Destinations' },
              { n: STAY_TOTALS.withWifi, l: 'WiFi listed' },
            ].map((s) => (
              <div key={s.l}>
                <p className="font-display text-3xl text-white sm:text-4xl">{s.n}</p>
                <p className="text-xs text-white/50">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-12">
        <StaysFilterBar
          destinations={destinationOptions}
          states={[...DEST_STATES]}
          types={STAY_TYPES_PRESENT}
          current={current}
        />

        {/* Booking deep-links for the current place */}
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--ink-soft)]">
            See live availability for <span className="font-semibold text-[var(--ink)]">{place}</span>:
          </p>
          <BookingLinks place={place} />
        </div>

        {/* Results header */}
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">
            {all.length} {all.length === 1 ? 'stay' : 'stays'}
            {selectedDest ? ` near ${selectedDest.name}` : ''}
          </h2>
          {current.dest === 'all' && all.length > RESULT_CAP && (
            <p className="text-xs text-[var(--ink-soft)]">Showing first {RESULT_CAP} - pick a destination to see all</p>
          )}
        </div>

        {/* Results */}
        {capped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-10 text-center">
            <p className="text-2xl">🏕️</p>
            <p className="mt-2 font-semibold text-[var(--ink)]">No open-data stays match those filters</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--ink-soft)]">
              Open data is thin for some spots. Try the live booking links above for {place}, or{' '}
              <Link href="/contribute" className="font-medium text-[var(--brand)] underline">add one you know</Link>.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capped.map((s) => (
              <StayCard
                key={s.id}
                stay={s}
                notes={stayNotes[stayNoteKey(s.nearestDestSlug, s.name)] ?? []}
              />
            ))}
          </div>
        )}

        {/* Honest sourcing note */}
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-sm leading-relaxed text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)]">Where this comes from.</span> These stays
          are real places from OpenStreetMap open data (keyless, no billing), mapped to the nearest
          hill station.{' '}
          <span className="font-semibold text-[var(--ink)]">Why there are no photographs:</span> the
          pictures on Google Maps and the booking sites belong to those businesses and to the people
          who took them, so copying them here would be someone else&apos;s work on our page. Each
          stay gets a generated cover instead, and the <span className="whitespace-nowrap">📷 Photos</span>{' '}
          button opens the listing where the real ones legitimately live. Same reason we link out to
          Airbnb and the OTAs for prices and availability rather than mirroring them.{' '}
          <span className="font-semibold text-[var(--ink)]">The pictures we can show</span> are the
          ones travellers take themselves -{' '}
          <Link href="/contribute" className="font-medium text-[var(--brand)] underline">write a trip report</Link>{' '}
          and what you say about a place appears on its card here.
        </p>
      </div>
    </div>
  )
}
