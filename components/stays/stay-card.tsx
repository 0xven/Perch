import Link from 'next/link'
import { type OsmStay, STAY_TYPE_LABELS, stayMapsLink } from '@/lib/data/stays'
import { stayVisual, CONTOUR_PATHS } from '@/lib/data/stay-visual'
import type { StayReportNote } from '@/lib/queries/stay-reports'

/**
 * One stay.
 *
 * The cover is GENERATED, not photographic, and that is a deliberate choice
 * rather than a gap waiting to be filled. Lifting photos from Google Maps
 * business listings would mean re-hosting images owned by the businesses and
 * the people who took them. The Wikimedia photos used elsewhere on this site
 * are there because their CC licences allow it - which is why each carries a
 * credit. So each stay gets a consistent generated cover instead, plus a link
 * to where the real photos legitimately live, and - the part actually worth
 * having - whatever a traveller who stayed there wrote about it.
 */
export function StayCard({
  stay,
  showDistance = true,
  notes = [],
}: {
  stay: OsmStay
  showDistance?: boolean
  /** Published trip-report notes matched to this stay, if any. */
  notes?: StayReportNote[]
}) {
  const v = stayVisual(stay)
  const note = notes[0]

  return (
    <div className="card card-hover flex flex-col overflow-hidden">
      {/* ─── Generated cover ─── */}
      <div className={`relative h-24 overflow-hidden bg-gradient-to-br ${v.wash}`}>
        <svg
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full opacity-[0.22]"
          aria-hidden="true"
        >
          <g fill="none" stroke="white" strokeWidth="1.2">
            <path d={CONTOUR_PATHS[v.variant]} />
            <path d={CONTOUR_PATHS[(v.variant + 1) % 4]} transform="translate(0,18)" />
            <path d={CONTOUR_PATHS[(v.variant + 2) % 4]} transform="translate(0,-16)" />
          </g>
        </svg>

        <div className="relative flex h-full items-center justify-between px-4">
          <span
            className="font-display text-3xl leading-none text-white/95 drop-shadow-sm"
            aria-hidden="true"
          >
            {v.monogram}
          </span>
          <span className="text-2xl leading-none opacity-90" aria-hidden="true">
            {v.glyph}
          </span>
        </div>

        {stay.stars ? (
          <span className="absolute bottom-2 left-4 rounded-md bg-black/35 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand-gold)] backdrop-blur-sm">
            {'★'.repeat(stay.stars)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="font-semibold leading-snug text-[var(--ink)]">{stay.name}</p>
        <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
          {STAY_TYPE_LABELS[stay.type]} · {stay.area}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {stay.hasInternet ? (
            <span className="rounded-md bg-[var(--brand)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]">
              📶 WiFi listed
            </span>
          ) : null}
          {showDistance ? (
            <span className="rounded-md bg-[var(--paper-deep)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
              {stay.distanceToDestKm <= 0 ? 'In town' : `~${stay.distanceToDestKm} km away`}
            </span>
          ) : null}
          <span className="rounded-md bg-[var(--paper-deep)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
            {stay.state}
          </span>
        </div>

        {/* ─── What a traveller actually said ─── */}
        {note ? (
          <Link
            href={`/report/${note.publicId}`}
            className="mt-3 block rounded-xl border border-[var(--brand-mint)]/40 bg-[var(--brand-mint)]/8 p-3 transition-colors hover:border-[var(--brand-mint)]"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">
              ✍️ From a trip report
              {note.rating ? (
                <span className="text-[var(--brand-gold)]">{'★'.repeat(note.rating)}</span>
              ) : null}
            </p>
            {note.notes ? (
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--ink)]">
                {note.notes}
              </p>
            ) : null}
            <p className="mt-1.5 text-[10.5px] text-[var(--ink-soft)]">
              {note.costInr ? `₹${note.costInr.toLocaleString()} · ` : ''}
              {notes.length > 1 ? `${notes.length} reports · ` : ''}
              read it →
            </p>
          </Link>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <a
            href={stayMapsLink(stay)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--paper)] transition-colors hover:bg-[var(--brand-deep)]"
          >
            Map ↗
          </a>
          {/* Photos live on Google's listing, where the rights sit. We link
              rather than re-host. */}
          <a
            href={stayMapsLink(stay)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-mint)]"
          >
            📷 Photos ↗
          </a>
          {stay.website ? (
            <a
              href={stay.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-mint)]"
            >
              Website ↗
            </a>
          ) : null}
          {stay.phone ? (
            <a
              href={`tel:${stay.phone}`}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-mint)]"
            >
              Call
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
