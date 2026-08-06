'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface ComboOption<T = unknown> {
  value: string
  /** Right-hand context line: state, area, distance - whatever disambiguates. */
  hint?: string
  /** Carried through to onPick so the caller can auto-fill neighbouring fields. */
  data?: T
}

interface Props<T> {
  id?: string
  value: string
  onChange: (v: string) => void
  options: readonly ComboOption<T>[]
  /** Called when a suggestion is chosen (not when free text is typed). */
  onPick?: (option: ComboOption<T>) => void
  /**
   * Called with the SETTLED value - on blur, or when a suggestion is chosen.
   * Deliberately not per keystroke: a "remember what I typed" consumer that
   * fires on every change learns "i", "in", "ind" as well as "Indian Oil".
   */
  onCommit?: (value: string) => void
  placeholder?: string
  /** Options already filtered by the source (a server route). Skips local filtering. */
  preFiltered?: boolean
  /** Free text is the default: a curated list must never be a cage. */
  limit?: number
  className?: string
  'aria-describedby'?: string
}

/**
 * A combobox that suggests without insisting.
 *
 * Every option list in this form is curated (SIM networks, fuel brands, stay
 * types, place names), and every one of them will be wrong the day someone
 * reports from a place or a brand we have not heard of. So this is
 * `aria-autocomplete="list"` over a free-text input: typing "ji" offers "Jio",
 * and typing "Jio (roaming, borrowed phone)" is also just fine.
 *
 * Follows the same interaction contract as components/search/place-combobox.tsx
 * - arrow keys, Enter, Escape, outside-click, roving aria-activedescendant - so
 * the two feel like the same control.
 */
export function Combobox<T>({
  id,
  value,
  onChange,
  options,
  onPick,
  onCommit,
  placeholder,
  preFiltered = false,
  limit = 8,
  className = '',
  'aria-describedby': describedBy,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const listId = `${generatedId}-list`
  const inputId = id ?? `${generatedId}-input`

  const results = useMemo(() => {
    if (preFiltered) return options.slice(0, limit)
    const q = value.trim().toLowerCase()
    if (!q) return options.slice(0, limit)
    return options
      .filter((o) => o.value.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
      .slice(0, limit)
  }, [options, value, preFiltered, limit])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function choose(o: ComboOption<T>) {
    onChange(o.value)
    onPick?.(o)
    onCommit?.(o.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      if (e.key === 'ArrowDown') e.preventDefault()
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      // Only swallow Enter when a suggestion is actually highlighted, so free
      // text plus Enter still submits nothing unexpected.
      if (open && results[active]) {
        e.preventDefault()
        choose(results[active])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => onCommit?.(value)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-soft)]/60 focus:border-[var(--brand)] ${className}`}
      />

      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="combo-pop absolute z-50 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--elev-lg)]"
        >
          {results.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(o)
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                i === active ? 'bg-[var(--paper)]' : ''
              }`}
            >
              <span className="font-medium text-[var(--ink)]">{o.value}</span>
              {o.hint ? (
                <span className="shrink-0 text-[11px] text-[var(--ink-soft)]">{o.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
