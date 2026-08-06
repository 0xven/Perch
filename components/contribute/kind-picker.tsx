'use client'

import { useMemo, useState } from 'react'
import { KIND_GROUPS, REPORT_KINDS } from '@/lib/data/report-kinds'
import { eyebrowClass } from './form-ui'

/**
 * The "add anything" tray.
 *
 * Every kind in lib/data/report-kinds.ts appears here automatically - the
 * picker has no list of its own. Adding a kind to the taxonomy adds a button
 * here, a set of fields in the item card, a filter on /reports and a section on
 * the report page, with no other edit anywhere.
 */
export function KindPicker({
  onAdd,
  counts,
}: {
  onAdd: (kindId: string) => void
  counts: Record<string, number>
}) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return REPORT_KINDS
    return REPORT_KINDS.filter(
      (k) =>
        k.label.toLowerCase().includes(q) ||
        k.blurb.toLowerCase().includes(q) ||
        k.id.includes(q) ||
        k.fields.some((f) => f.label.toLowerCase().includes(q)),
    )
  }, [query])

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={eyebrowClass}>Add anything you saw</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            A fuel stop, the WiFi speed, which SIM worked, the house that put you up. Add as many
            as you like, in any order.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search the kinds of thing you can add"
          className="w-32 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--brand)] sm:w-44"
        />
      </div>

      {KIND_GROUPS.map((group) => {
        const kinds = matches.filter((k) => k.group === group.id)
        if (kinds.length === 0) return null
        return (
          <div key={group.id} className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]/70">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => onAdd(k.id)}
                  title={k.blurb}
                  className="group flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--elev-sm)]"
                >
                  <span aria-hidden>{k.icon}</span>
                  {k.label}
                  {counts[k.id] ? (
                    <span className="rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-semibold text-[var(--paper)]">
                      {counts[k.id]}
                    </span>
                  ) : (
                    <span className="text-[var(--ink-soft)] transition-colors group-hover:text-[var(--brand)]">
                      ＋
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {matches.length === 0 ? (
        <p className="text-xs text-[var(--ink-soft)]">
          Nothing matches &ldquo;{query}&rdquo;. Use <strong>Something else</strong> - it takes
          anything.
        </p>
      ) : null}
    </div>
  )
}
