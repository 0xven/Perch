'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getDestination } from '@/lib/data/destinations'
import {
  KIND_GROUPS, fieldLabel, fieldUnit, getKind, transportIcon, transportLabel,
} from '@/lib/data/report-kinds'
import { downloadReportMarkdown, withUnit } from '@/lib/data/report-text'
import type { TripReportDetail, TripReportItem } from '@/lib/types/database'
import { ReportMapClient } from '@/components/maps/report-map-client'

/**
 * One trip report, rendered whole.
 *
 * Items are grouped by the taxonomy's own groups rather than by a hand-written
 * order, so a kind added to lib/data/report-kinds.ts gets a section here for
 * free. Every kind-specific field is labelled through fieldLabel(), which falls
 * back to a de-snake-cased key - so an old report whose kind has since lost a
 * field still renders that field rather than dropping data on the floor.
 */
export function ReportView({ detail, shareUrl }: { detail: TripReportDetail; shareUrl: string }) {
  const { report, items, media } = detail
  const [copied, setCopied] = useState(false)

  const dest = report.destination_slug ? getDestination(report.destination_slug) : null

  const points = items
    .filter((i) => i.lat != null && i.lng != null)
    .map((i) => ({
      lat: i.lat as number,
      lng: i.lng as number,
      label: i.name || getKind(i.kind).label,
      icon: getKind(i.kind).icon,
      sub: i.area ?? undefined,
    }))

  async function copyId() {
    try {
      await navigator.clipboard.writeText(report.public_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked - the ID is on screen to select by hand.
    }
  }

  return (
    <article className="mx-auto max-w-4xl px-5 py-10 space-y-8">
      {/* ─── Unlisted banner ────────────────────────────────────────────── */}
      {!report.published ? (
        <div className="assist-in rounded-2xl border border-[var(--brand-gold)]/50 bg-[var(--brand-gold)]/12 px-4 py-3">
          <p className="text-sm font-semibold text-[var(--ink)]">
            Unlisted - waiting to be looked over
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-soft)]">
            Anyone with this link can read it, and it is not in search results or on the public
            reports list. It joins the list once an admin has approved it.
          </p>
        </div>
      ) : null}

      {/* ─── Head ───────────────────────────────────────────────────────── */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
          <Link href="/reports" className="underline hover:text-[var(--ink)]">
            ← All reports
          </Link>
          <span>·</span>
          <span className="font-mono text-[var(--brand)]">{report.public_id}</span>
          <button
            type="button"
            onClick={copyId}
            className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:border-[var(--brand-mint)]"
          >
            {copied ? 'Copied ✓' : 'Copy ID'}
          </button>
        </div>

        <h1 className="font-display text-4xl tracking-tight text-[var(--ink)]">
          {report.title || 'Trip report'}
        </h1>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {dest ? (
            <Link
              href={`/destinations/${dest.slug}`}
              className="rounded-full bg-[var(--brand)] px-3 py-1 font-medium text-[var(--paper)]"
            >
              {dest.name}
            </Link>
          ) : null}
          {report.transport_mode ? (
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[var(--ink-soft)]">
              <span aria-hidden>{transportIcon(report.transport_mode)}</span>{' '}
              {transportLabel(report.transport_mode)}
            </span>
          ) : null}
          {report.origin_name ? (
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[var(--ink-soft)]">
              from {report.origin_name}
            </span>
          ) : null}
          {report.trip_date ? (
            <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[var(--ink-soft)]">
              {formatDate(report.trip_date)}
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Items" value={String(items.length)} />
          <Stat label="Days" value={report.days ? String(report.days) : '—'} />
          <Stat label="Travellers" value={report.travellers ? String(report.travellers) : '—'} />
          <Stat
            label="Total spend"
            value={report.total_cost_inr != null ? `₹${Number(report.total_cost_inr).toLocaleString('en-IN')}` : '—'}
          />
        </dl>

        {report.vehicle ? (
          <p className="text-sm text-[var(--ink-soft)]">
            Vehicle: <span className="font-medium text-[var(--ink)]">{report.vehicle}</span>
          </p>
        ) : null}
      </header>

      {/* ─── Summary ────────────────────────────────────────────────────── */}
      {report.summary ? (
        <section className="card p-5">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">
            {report.summary}
          </p>
          {report.author_name ? (
            <p className="mt-4 text-xs text-[var(--ink-soft)]">— {report.author_name}</p>
          ) : null}
        </section>
      ) : null}

      {/* ─── Map ────────────────────────────────────────────────────────── */}
      {points.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">On the map</h2>
          <ReportMapClient points={points} />
          <p className="text-[11px] text-[var(--ink-soft)]">
            {points.length} of {items.length} items had coordinates. Map tiles by OpenFreeMap ·
            data © OpenStreetMap contributors.
          </p>
        </section>
      ) : null}

      {/* ─── Items, grouped ─────────────────────────────────────────────── */}
      {KIND_GROUPS.map((group) => {
        const groupItems = items.filter((i) => getKind(i.kind).group === group.id)
        if (groupItems.length === 0) return null
        return (
          <section key={group.id} className="space-y-3">
            <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">
              {group.label}
              <span className="ml-2 align-middle text-sm font-normal text-[var(--ink-soft)]">
                {groupItems.length}
              </span>
            </h2>
            <ul className="space-y-3">
              {groupItems.map((item) => (
                <ItemBlock key={item.id} item={item} />
              ))}
            </ul>
          </section>
        )
      })}

      {/* ─── Photos ─────────────────────────────────────────────────────── */}
      {media.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">Photos</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {media.map((m) => (
              <li key={m.id} className="card overflow-hidden">
                {/* Traveller uploads in a bucket next/image is not configured
                    to optimise; a plain img keeps the page honest and cheap. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.caption ?? ''} loading="lazy" className="w-full object-cover" />
                {m.caption ? (
                  <p className="px-3 py-2 text-xs text-[var(--ink-soft)]">{m.caption}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="space-y-3 border-t border-[var(--line)] pt-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadReportMarkdown({
                publicId: report.public_id,
                title: report.title,
                destinationSlug: report.destination_slug,
                originName: report.origin_name,
                tripDate: report.trip_date,
                transportMode: report.transport_mode,
                vehicle: report.vehicle,
                days: report.days,
                travellers: report.travellers,
                totalCostInr: report.total_cost_inr,
                summary: report.summary,
                authorName: report.author_name,
                items,
                media,
                shareUrl,
              })
            }
            className="btn-ghost text-sm"
          >
            ⤓ Download this report
          </button>
          <Link href="/contribute" className="btn-primary text-sm">
            Write your own →
          </Link>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--ink-soft)]">
          One traveller&apos;s account of one trip, submitted anonymously and not verified by
          anyone. Prices, road conditions and opening hours change. Report ID {report.public_id},
          filed {formatDate(report.created_at)}.
        </p>
      </footer>
    </article>
  )
}

function ItemBlock({ item }: { item: TripReportItem }) {
  const kind = getKind(item.kind)
  const details = Object.entries(item.details ?? {}).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined,
  )

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg" aria-hidden>{kind.icon}</span>
        <h3 className="font-semibold text-[var(--ink)]">{item.name || kind.label}</h3>
        <span className="rounded-full bg-[var(--paper-deep)] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          {kind.label}
        </span>
        {item.rating != null ? (
          <span className="text-sm text-[var(--brand-gold)]" aria-label={`${item.rating} out of 5`}>
            {'★'.repeat(item.rating)}
            <span className="text-[var(--line)]">{'★'.repeat(5 - item.rating)}</span>
          </span>
        ) : null}
        {item.cost_inr != null ? (
          <span className="text-sm font-medium text-[var(--brand)]">
            ₹{Number(item.cost_inr).toLocaleString('en-IN')}
          </span>
        ) : null}
      </div>

      {item.area ? <p className="mt-1 text-xs text-[var(--ink-soft)]">📍 {item.area}</p> : null}

      {details.length > 0 ? (
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {details.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] pb-1">
              <dt className="text-xs text-[var(--ink-soft)]">{fieldLabel(item.kind, key)}</dt>
              <dd className="text-right text-xs font-medium text-[var(--ink)]">
                {typeof value === 'boolean'
                  ? value ? 'Yes' : 'No'
                  : withUnit(value, fieldUnit(item.kind, key))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {item.notes ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
          {item.notes}
        </p>
      ) : null}
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">{label}</dt>
      <dd className="font-display text-xl text-[var(--ink)]">{value}</dd>
    </div>
  )
}

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
