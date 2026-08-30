import { getDisasterAlerts } from '@/lib/queries/alerts'

/**
 * Prerendered with ISR. getDisasterAlerts() wraps its fetch in a 4-hour
 * `next.revalidate`, so the fetch inside is not a dynamic signal and this page
 * stays static between refreshes - same pattern as weather.ts. The route-level
 * revalidate here just matches that window as a backstop.
 */
export const revalidate = 14400

export const metadata = {
  title: 'Alerts & cautions',
  description:
    'Current natural-disaster watches for South India and the Himalaya - floods, earthquakes and cyclones affecting India, Nepal, Bhutan, Bangladesh, Pakistan, Sri Lanka and Myanmar - sourced from GDACS.',
  alternates: { canonical: '/alerts' },
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function AlertsPage() {
  const alerts = await getDisasterAlerts()

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
          Before you go
        </p>
        <h1 className="font-display text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          Alerts &amp; cautions
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          Current natural-disaster watches for the region this site covers - South India and the
          Himalaya, including Nepal, Bhutan, Bangladesh, Pakistan, Sri Lanka and Myanmar. Sourced
          from <a href="https://www.gdacs.org/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">GDACS</a>,
          the EU/UN Global Disaster Alert and Coordination System, and refreshed every 4 hours.
          This is a heads-up, not an official advisory - always check your government&apos;s
          travel advisory and local authorities before and during a trip.
        </p>
      </header>

      <div className="mt-10 space-y-4">
        {alerts.length === 0 && (
          <div className="card rounded-2xl border border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
            No active watch-level disasters reported for this region right now.
          </div>
        )}

        {alerts.map((a) => {
          const isRed = a.alertLevel === 'Red'
          return (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="card block rounded-2xl border border-[var(--line)] p-5 transition-colors hover:border-[var(--brand)]/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                    isRed
                      ? 'bg-[rgba(224,90,59,0.12)] text-[#B5432A]'
                      : 'bg-[rgba(224,169,59,0.15)] text-[#8A6A1F]'
                  }`}
                >
                  {isRed ? 'Alert' : 'Caution'}
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                  {a.type}
                </span>
                <span className="ml-auto text-xs text-[var(--ink-soft)]">{timeAgo(a.date)}</span>
              </div>
              <h2 className="mt-2.5 text-lg font-semibold text-[var(--ink)]">{a.title}</h2>
              {a.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
                  {a.description}
                </p>
              )}
              <span className="mt-3 inline-block text-xs font-medium text-[var(--brand)]">
                View on GDACS →
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
