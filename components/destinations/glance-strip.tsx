import { oxygenPercentAt, altitudeAdvice } from '@/lib/data/altitude'
import type { HillStation } from '@/lib/data/destinations'

/**
 * The four instruments at the top of a destination's Overview.
 *
 * These replace a vertical stack of label/value rows that sat in a side column
 * below the fold on a phone. The numbers were always the fastest way to judge a
 * place - how high, how thin the air, when to come - so they now lead the page.
 *
 * Both animated readings are REAL: the ring sweeps to the barometric oxygen
 * fraction for this exact elevation, and the bar fills to where the town sits on
 * a 0-6,000 m scale. Nothing here animates for the sake of moving.
 */

const CATEGORY_TAG: Record<string, string> = {
  hill_station: 'Hill station',
  high_point: 'High pass / peak',
  forest: 'Forest & wildlife',
  gateway: 'Gateway',
  coastal: 'Coastal',
}

/** Top of the elevation bar's scale - Umling La, the highest place in the catalogue. */
const SCALE_MAX_M = 6000

const TONE = {
  calm: 'text-[var(--brand)]',
  watch: 'text-[var(--brand-gold)]',
  care: 'text-[var(--clay)]',
} as const

function Tile({
  label,
  children,
  delay,
}: {
  label: string
  children: React.ReactNode
  delay: number
}) {
  return (
    <div
      className="sheen card card-hover rise flex flex-col justify-between p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
        {label}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

export function GlanceStrip({ dest }: { dest: HillStation }) {
  const oxygen = oxygenPercentAt(dest.elevationM)
  const advice = altitudeAdvice(dest.elevationM)

  // Ring geometry: r=26 → circumference ≈ 163.4. The dash offset is the unfilled
  // remainder, so the stroke ends exactly at the oxygen fraction.
  const R = 26
  const LEN = +(2 * Math.PI * R).toFixed(1)
  const OFFSET = +(LEN * (1 - oxygen / 100)).toFixed(1)

  const elevPct = Math.min(100, Math.round((dest.elevationM / SCALE_MAX_M) * 100))

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* ── Elevation, with the town's place on a 0-6,000 m scale ── */}
      <Tile label="Elevation" delay={0}>
        <p className="font-display text-[30px] leading-none text-[var(--ink)]">
          {dest.elevationM.toLocaleString()}
          <span className="ml-1 text-base text-[var(--ink-soft)]">m</span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--paper-deep)]">
          <div
            className="bar-fill h-full rounded-full bg-gradient-to-r from-[var(--brand-mint)] to-[var(--brand)]"
            style={{ width: `${elevPct}%`, animationDelay: '180ms' }}
          />
        </div>
        <p className="mt-1.5 text-[10.5px] text-[var(--ink-soft)]">
          {elevPct}% of the way to Umling La
        </p>
      </Tile>

      {/* ── Oxygen, from the barometric formula ── */}
      <Tile label="Air up there" delay={70}>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--paper-deep)" strokeWidth="6" />
            <circle
              cx="32" cy="32" r={R} fill="none"
              stroke="var(--brand)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={LEN}
              strokeDashoffset={OFFSET}
              className="ring-draw"
              style={{ ['--ring-len' as string]: `${LEN}`, animationDelay: '220ms' }}
            />
          </svg>
          <div className="min-w-0">
            <p className="font-display text-[26px] leading-none text-[var(--ink)]">{oxygen}%</p>
            <p className="mt-1 text-[10.5px] leading-tight text-[var(--ink-soft)]">
              of sea-level oxygen
            </p>
          </div>
        </div>
        <p className={`mt-2 text-[10.5px] font-medium leading-tight ${TONE[advice.tone]}`}>
          {advice.label}
        </p>
      </Tile>

      {/* ── Best season ── */}
      <Tile label="Best season" delay={140}>
        <p className="font-display text-[21px] leading-tight text-[var(--ink)]">
          {dest.bestSeason.split('(')[0].trim()}
        </p>
        {dest.bestSeason.includes('(') ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-soft)]">
            {dest.bestSeason.slice(dest.bestSeason.indexOf('(')).replace(/[()]/g, '')}
          </p>
        ) : null}
      </Tile>

      {/* ── Where it is ── */}
      <Tile label="Where" delay={210}>
        <p className="font-display text-[21px] leading-tight text-[var(--ink)]">{dest.region}</p>
        <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
          {dest.district}, {dest.state}
        </p>
        <span className="mt-2.5 inline-block rounded-full border border-[var(--line)] bg-[var(--paper-deep)] px-2.5 py-0.5 text-[10.5px] font-medium text-[var(--ink)]">
          {CATEGORY_TAG[dest.category] ?? dest.category}
        </span>
      </Tile>
    </section>
  )
}
