import { requireAdmin } from '@/lib/supabase/admin-guard'
import { getAllTripReports } from '@/lib/queries/admin'
import { ReportsManager } from '@/components/admin/reports-manager'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Trip reports' }

export default async function AdminReportsPage() {
  await requireAdmin()

  const reports = await getAllTripReports()
  const pending = reports.filter((r) => !r.published).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">
          Trip reports
          {pending > 0 ? (
            <span className="ml-2 rounded-full bg-[var(--brand-gold)]/25 px-2.5 py-0.5 align-middle text-xs font-semibold text-[var(--clay)]">
              {pending} waiting
            </span>
          ) : null}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
          Anyone can submit one of these without an account, so this queue is the only thing
          between a stranger and the public <code>/reports</code> list. A pending report is already
          readable by anyone holding its link - like an unlisted video - but the read policy on{' '}
          <code>trip_reports_public</code> keeps it out of the listing until you approve it.
          Submitter emails are shown here and nowhere else: the public view does not have the
          column, and anon has no grant on it.
        </p>
      </div>

      <ReportsManager reports={reports} />
    </div>
  )
}
