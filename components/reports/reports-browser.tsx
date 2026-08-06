'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DESTINATIONS } from '@/lib/data/destinations'
import {
  KIND_GROUPS, REPORT_KINDS, TRANSPORT_MODES, getKind, kindLabel, transportIcon, transportLabel,
} from '@/lib/data/report-kinds'
import type { TripReportSummary } from '@/lib/types/database'

type SortKey = 'newest' | 'rating' | 'detailed' | 'photos'

const DEST_NAME = new Map(DESTINATIONS.map((d) => [d.slug, d.name]))

const DATE_PRESETS: { id: string; label: string; months: number | null }[] = [
  { id: 'any', label: 'Any time', months: null },
  { id: '6m', label: 'Last 6 months', months: 6 },
  { id: '1y', label: 'Last year', months: 12 },
  { id: '2y', label: 'Last 2 years', months: 24 },
]

/**
 * The browse experience for community reports.
 *
 * Same shape as components/trip-finder/trip-finder-browser.tsx: the server
 * hands over every published row once, and every filter is a useMemo over that
 * array. No round trip per keystroke, no per-filter query, nothing to bill.
 */
export function ReportsBrowser({ reports }: { reports: TripReportSummary[] }) {
  const [query, setQuery] = useState('')
  const [destFilter, setDestFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState<string[]>([])
  const [kindFilter, setKindFilter] = useState<string[]>([])
  const [minRating, setMinRating] = useState(0)
  const [photosOnly, setPhotosOnly] = useState(false)
  const [datePreset, setDatePreset] = useState('any')
  const [sortBy, setSortBy] = useState<SortKey>('newest')

  // Only the destinations and kinds that actually appear - a filter for
  // something with no results is just a dead end.
  const destOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of reports) {
      if (!r.destination_slug) continue
      counts.set(r.destination_slug, (counts.get(r.destination_slug) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([slug, n]) => ({ slug, name: DEST_NAME.get(slug) ?? slug, n }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [reports])

  const kindsPresent = useMemo(() => {
    const present = new Set<string>()
    for (const r of reports) for (const k of r.kinds) present.add(k)
    return present
  }, [reports])

  const modesPresent = useMemo(() => {
    const present = new Set<string>()
    for (const r of reports) if (r.transport_mode) present.add(r.transport_mode)
    return present
  }, [reports])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const cutoff = (() => {
      const preset = DATE_PRESETS.find((p) => p.id === datePreset)
      if (!preset?.months) return null
      const d = new Date()
      d.setMonth(d.getMonth() - preset.months)
      return d
    })()

    return reports
      .filter((r) => {
        if (destFilter !== 'all' && r.destination_slug !== destFilter) return false
        if (modeFilter.length > 0 && !modeFilter.includes(r.transport_mode ?? '')) return false
        if (kindFilter.length > 0 && !kindFilter.every((k) => r.kinds.includes(k))) return false
        if (minRating > 0 && (r.avgRating ?? 0) < minRating) return false
        if (photosOnly && r.photoCount === 0) return false
        if (cutoff) {
          const when = new Date(r.trip_date ?? r.created_at)
          if (Number.isNaN(when.getTime()) || when < cutoff) return false
        }
        if (q) {
          const haystack = [
            r.title, r.summary, r.author_name, r.origin_name, r.vehicle,
            r.destination_slug ? DEST_NAME.get(r.destination_slug) : '',
            ...r.kinds.map(kindLabel),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return (b.avgRating ?? 0) - (a.avgRating ?? 0)
        if (sortBy === 'detailed') return b.itemCount - a.itemCount
        if (sortBy === 'photos') return b.photoCount - a.photoCount
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [reports, query, destFilter, modeFilter, kindFilter, minRating, photosOnly, datePreset, sortBy])

  const activeFilters =
    (destFilter !== 'all' ? 1 : 0) + modeFilter.length + kindFilter.length +
    (minRating > 0 ? 1 : 0) + (photosOnly ? 1 : 0) + (datePreset !== 'any' ? 1 : 0) + (query ? 1 : 0)

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  function clearAll() {
    setQuery('')
    setDestFilter('all')
    setModeFilter([])
    setKindFilter([])
    setMinRating(0)
    setPhotosOnly(false)
    setDatePreset('any')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-2 p-4">
          <label htmlFor="report-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Search
          </label>
          <input
            id="report-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Road, town, bike, anything…"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
          />
          {activeFilters > 0 ? (
            <button type="button" onClick={clearAll} className="text-[11px] text-[var(--clay)] underline">
              Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>

        {destOptions.length > 0 ? (
          <div className="card space-y-2 p-4">
            <label htmlFor="report-dest" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              Destination
            </label>
            <select
              id="report-dest"
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            >
              <option value="all">Everywhere ({reports.length})</option>
              {destOptions.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name} ({d.n})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {modesPresent.size > 0 ? (
          <div className="card space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              How they travelled
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TRANSPORT_MODES.filter((m) => modesPresent.has(m.id)).map((m) => (
                <FilterChip
                  key={m.id}
                  active={modeFilter.includes(m.id)}
                  onClick={() => toggle(modeFilter, setModeFilter, m.id)}
                >
                  <span aria-hidden>{m.icon}</span> {m.label}
                </FilterChip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Must mention
          </p>
          {KIND_GROUPS.map((group) => {
            const kinds = REPORT_KINDS.filter((k) => k.group === group.id && kindsPresent.has(k.id))
            if (kinds.length === 0) return null
            return (
              <div key={group.id} className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]/70">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {kinds.map((k) => (
                    <FilterChip
                      key={k.id}
                      active={kindFilter.includes(k.id)}
                      onClick={() => toggle(kindFilter, setKindFilter, k.id)}
                    >
                      <span aria-hidden>{k.icon}</span> {k.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            )
          })}
          {kindsPresent.size === 0 ? (
            <p className="text-xs text-[var(--ink-soft)]">Nothing tagged yet.</p>
          ) : null}
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Rating &amp; date
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[0, 3, 4].map((n) => (
              <FilterChip key={n} active={minRating === n} onClick={() => setMinRating(n)}>
                {n === 0 ? 'Any rating' : `${n}★ and up`}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => (
              <FilterChip key={p.id} active={datePreset === p.id} onClick={() => setDatePreset(p.id)}>
                {p.label}
              </FilterChip>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={photosOnly}
              onChange={(e) => setPhotosOnly(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Has photos
          </label>
        </div>
      </aside>

      {/* ─── Results ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--ink-soft)]" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'report' : 'reports'}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Sort reports"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
          >
            <option value="newest">Sort: newest</option>
            <option value="rating">Sort: best rated</option>
            <option value="detailed">Sort: most detailed</option>
            <option value="photos">Sort: most photos</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] p-12 text-center">
            <p className="text-[var(--ink-soft)]">
              {reports.length === 0
                ? 'No reports yet. The first one could be yours.'
                : 'Nothing matches those filters.'}
            </p>
            <Link href="/contribute" className="btn-primary mt-4 text-sm">
              Write a trip report
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((r, i) => (
              <ReportCard key={r.id} report={r} index={i} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ReportCard({ report, index }: { report: TripReportSummary; index: number }) {
  const dest = report.destination_slug ? DEST_NAME.get(report.destination_slug) : null
  return (
    <li
      className="result-in"
      // Stagger, capped so a hundred results do not take five seconds to appear.
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <Link href={`/report/${report.public_id}`} className="card card-hover group flex h-full flex-col overflow-hidden">
        {report.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={report.coverUrl}
            alt=""
            loading="lazy"
            className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-soft)]">
            {dest ? (
              <span className="rounded-md bg-[var(--paper-deep)] px-2 py-0.5 font-medium">{dest}</span>
            ) : null}
            {report.transport_mode ? (
              <span>
                <span aria-hidden>{transportIcon(report.transport_mode)}</span>{' '}
                {transportLabel(report.transport_mode)}
              </span>
            ) : null}
            {report.days ? <span>· {report.days}d</span> : null}
          </div>

          <h3 className="font-display text-lg leading-snug text-[var(--ink)]">
            {report.title || 'Trip report'}
          </h3>

          {report.summary ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              {report.summary}
            </p>
          ) : null}

          <div className="mt-auto space-y-2 pt-1">
            <div className="flex flex-wrap gap-1">
              {report.kinds.slice(0, 7).map((k) => (
                <span key={k} title={kindLabel(k)} className="text-sm" aria-label={kindLabel(k)}>
                  {getKind(k).icon}
                </span>
              ))}
              {report.kinds.length > 7 ? (
                <span className="text-[11px] text-[var(--ink-soft)]">+{report.kinds.length - 7}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-soft)]">
              <span className="font-mono text-[var(--brand)]">{report.public_id}</span>
              <span>· {report.itemCount} item{report.itemCount === 1 ? '' : 's'}</span>
              {report.photoCount > 0 ? <span>· 📷 {report.photoCount}</span> : null}
              {report.avgRating != null ? (
                <span className="text-[var(--brand-gold)]">★ {report.avgRating}</span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </li>
  )
}

function FilterChip({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? 'bg-[var(--brand)] text-[var(--paper)]'
          : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--brand-mint)]'
      }`}
    >
      {children}
    </button>
  )
}
