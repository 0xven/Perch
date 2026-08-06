'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  deleteReport, publishReport, unpublishReport, type ReportModerationState,
} from '@/app/admin/(panel)/reports/actions'
import { DeleteButton, Notice, SubmitButton } from '@/components/admin/ui'
import { getKind, kindLabel, transportLabel } from '@/lib/data/report-kinds'
import { getDestination } from '@/lib/data/destinations'
import type { AdminTripReport } from '@/lib/queries/admin'

type Tab = 'pending' | 'published' | 'all'

export function ReportsManager({ reports }: { reports: AdminTripReport[] }) {
  const [tab, setTab] = useState<Tab>('pending')

  const counts = useMemo(
    () => ({
      pending: reports.filter((r) => !r.published).length,
      published: reports.filter((r) => r.published).length,
      all: reports.length,
    }),
    [reports],
  )

  const shown = useMemo(() => {
    if (tab === 'pending') return reports.filter((r) => !r.published)
    if (tab === 'published') return reports.filter((r) => r.published)
    return reports
  }, [reports, tab])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {(['pending', 'published', 'all'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              tab === t
                ? 'bg-[var(--brand)] text-[var(--paper)]'
                : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--brand-mint)]'
            }`}
          >
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--ink-soft)]">
          {tab === 'pending' ? 'Nothing waiting. Queue is clear.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReportRow({ report }: { report: AdminTripReport }) {
  const [publishState, publishAction] = useActionState<ReportModerationState, FormData>(publishReport, {})
  const [withdrawState, withdrawAction] = useActionState<ReportModerationState, FormData>(unpublishReport, {})
  const [deleteState, deleteAction] = useActionState<ReportModerationState, FormData>(deleteReport, {})
  const [open, setOpen] = useState(false)

  const dest = report.destination_slug ? getDestination(report.destination_slug) : null

  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                report.published
                  ? 'bg-[var(--brand)]/15 text-[var(--brand)]'
                  : 'bg-[var(--brand-gold)]/20 text-[var(--clay)]'
              }`}
            >
              {report.published ? 'Published' : 'Pending'}
            </span>
            <span className="font-mono text-[var(--brand)]">{report.public_id}</span>
            <span className="text-[var(--ink-soft)]">
              {new Date(report.created_at).toLocaleString('en-IN')}
            </span>
          </div>
          <h3 className="font-display text-lg leading-snug text-[var(--ink)]">
            {report.title || 'Untitled report'}
          </h3>
          <p className="text-xs text-[var(--ink-soft)]">
            {[
              dest?.name,
              report.origin_name ? `from ${report.origin_name}` : null,
              transportLabel(report.transport_mode),
              report.author_name ? `by ${report.author_name}` : 'anonymous',
              `${report.itemCount} items`,
              `${report.photoCount} photos`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/report/${report.public_id}`} target="_blank" className="btn-ghost text-xs">
            Preview ↗
          </Link>
          <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs">
            {open ? 'Hide detail' : 'Detail'}
          </button>
        </div>
      </div>

      {report.kinds.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {report.kinds.map((k) => (
            <span
              key={k}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--ink-soft)]"
            >
              {getKind(k).icon} {kindLabel(k)}
            </span>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-xs">
          {report.summary ? (
            <p className="whitespace-pre-wrap leading-relaxed text-[var(--ink)]">{report.summary}</p>
          ) : (
            <p className="text-[var(--ink-soft)]">No summary written.</p>
          )}
          <dl className="grid gap-1 sm:grid-cols-2">
            <Row label="Vehicle" value={report.vehicle} />
            <Row label="Trip date" value={report.trip_date} />
            <Row label="Days" value={report.days} />
            <Row label="Travellers" value={report.travellers} />
            <Row label="Total spend" value={report.total_cost_inr != null ? `₹${report.total_cost_inr}` : null} />
            {/* The only place in the app this is ever rendered. */}
            <Row label="Contact email (private)" value={report.contact_email} />
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {report.published ? (
          <form action={withdrawAction}>
            <input type="hidden" name="id" value={report.id} />
            <input type="hidden" name="public_id" value={report.public_id} />
            <SubmitButton variant="ghost" pendingLabel="Withdrawing...">
              Withdraw from list
            </SubmitButton>
          </form>
        ) : (
          <form action={publishAction}>
            <input type="hidden" name="id" value={report.id} />
            <input type="hidden" name="public_id" value={report.public_id} />
            <SubmitButton pendingLabel="Approving...">Approve &amp; publish</SubmitButton>
          </form>
        )}

        <form action={deleteAction}>
          <input type="hidden" name="id" value={report.id} />
          <input type="hidden" name="public_id" value={report.public_id} />
          <DeleteButton
            confirm={`Delete ${report.public_id} for good, including its photos? This cannot be undone.`}
          />
        </form>
      </div>

      <Notice state={publishState} />
      <Notice state={withdrawState} />
      <Notice state={deleteState} />
    </li>
  )
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] pb-1">
      <dt className="text-[var(--ink-soft)]">{label}</dt>
      <dd className="font-medium text-[var(--ink)]">{value}</dd>
    </div>
  )
}
