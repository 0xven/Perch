import { monthName, normalsFor } from '@/lib/data/climate-normals'

/**
 * The honest answer to "what's the weather like 2 months from now": nobody can
 * forecast that at daily resolution, so this shows CLIMATOLOGY instead - what
 * this month and next have actually looked like on average over the last few
 * years (see scripts/fetch-climate-normals.ts). Labelled "Typical", never
 * "forecast", so nothing here overstates its own certainty.
 */
export function ClimateOutlook({ slug }: { slug: string }) {
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const nextMonth = ((thisMonth) % 12) + 1

  const thisNormal = normalsFor(slug, thisMonth)
  const nextNormal = normalsFor(slug, nextMonth)

  if (!thisNormal && !nextNormal) return null

  const months = [
    { label: monthName(thisMonth), normal: thisNormal, current: true },
    { label: monthName(nextMonth), normal: nextNormal, current: false },
  ]

  return (
    <div className="card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-soft)]">
        Climate outlook
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {months.map((m) => (
          <div key={m.label} className="rounded-xl border border-[var(--line)] bg-[var(--paper-deep)] p-3.5">
            <p className="text-xs font-semibold text-[var(--ink)]">
              {m.current ? 'Typical now' : `Typical in ${m.label}`}
            </p>
            {m.normal ? (
              <>
                <p className="mt-1.5 text-lg font-display text-[var(--ink)]">
                  {m.normal.avgHighC}° <span className="text-sm text-[var(--ink-soft)]">/ {m.normal.avgLowC}°</span>
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
                  ~{Math.round(m.normal.rainyDaysAvg)} rainy days
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--ink-soft)]">No data</p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[var(--ink-soft)]">
        Averages from recent years&apos; actual weather (Open-Meteo historical data), not a forecast -
        no one can predict specific days this far out. Use it to plan around, not to pack by.
      </p>
    </div>
  )
}
