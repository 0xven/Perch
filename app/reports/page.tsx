import Link from 'next/link'
import { ReportsBrowser } from '@/components/reports/reports-browser'
import { REPORT_KINDS } from '@/lib/data/report-kinds'
import { getPublishedReports } from '@/lib/queries/trip-reports'

/**
 * Prerendered with ISR, like the rest of the public site.
 *
 * getPublishedReports() wraps its Supabase read in unstable_cache, so the fetch
 * inside is not a dynamic signal and this page stays `○`. Approving a report in
 * /admin/reports calls updateTag(TRIP_REPORTS_TAG), which is what actually
 * refreshes this list; the 30 minute revalidate is only the backstop.
 */
export const revalidate = 1800

export const metadata = {
  title: 'Trip reports',
  description:
    'First-hand reports from the road: stays, WiFi speeds, which SIM had signal, petrol bunks, service centres, road conditions and viewpoints across the Indian hills.',
  alternates: { canonical: '/reports' },
}

export default async function ReportsPage() {
  const reports = await getPublishedReports()

  const totals = reports.reduce(
    (acc, r) => ({
      items: acc.items + r.itemCount,
      photos: acc.photos + r.photoCount,
      kinds: new Set([...acc.kinds, ...r.kinds]),
    }),
    { items: 0, photos: 0, kinds: new Set<string>() },
  )

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
          From the road
        </p>
        <h1 className="font-display text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          Trip reports
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          What people actually found - not what a brochure says. Filter by the thing you care
          about: which SIM worked, whether the bunk was open, how the ghat road was in the rain,
          the homestay that had hot water.
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-xs text-[var(--ink-soft)]">
          <Stat n={reports.length} label={reports.length === 1 ? 'report' : 'reports'} />
          <Stat n={totals.items} label="things noted" />
          <Stat n={totals.kinds.size} label={`of ${REPORT_KINDS.length} kinds`} />
          <Stat n={totals.photos} label="photos" />
        </div>
        <p className="pt-1 text-xs text-[var(--ink-soft)]">
          Been somewhere?{' '}
          <Link href="/contribute" className="font-semibold text-[var(--brand)] underline">
            Write your own
          </Link>{' '}
          - no account, takes as long as you want it to.
        </p>
      </header>

      <div className="mt-8">
        <ReportsBrowser reports={reports} />
      </div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1">
      <strong className="text-[var(--ink)]">{n.toLocaleString('en-IN')}</strong> {label}
    </span>
  )
}
