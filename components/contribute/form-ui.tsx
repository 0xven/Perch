'use client'

import { useId } from 'react'

/**
 * Shared field chrome for the trip-report form.
 *
 * Everything here is token-driven (--line / --surface / --ink / --brand) so the
 * form sits on the same warm paper as the rest of the site, and every control
 * is label-linked: the form is long, so a screen reader announcing "edit text,
 * blank" thirty times would make it unusable.
 */

export const inputClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-soft)]/60 focus:border-[var(--brand)]'

export const labelClass = 'block text-xs font-medium text-[var(--ink)]'

export const eyebrowClass =
  'text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]'

/** Label + control + error, wired together by a generated id. */
export function Field({
  label,
  error,
  hint,
  children,
  className = '',
}: {
  label: string
  error?: string
  hint?: string
  children: (id: string) => React.ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children(id)}
      {hint ? (
        <p id={hintId} className="text-[11px] leading-snug text-[var(--ink-soft)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[11px] font-medium text-[var(--clay)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** The same chip the trip finder uses, so the two browse experiences match. */
export function Chip({
  active,
  onClick,
  children,
  small,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  small?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-full font-medium transition-colors ${small ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${
        active
          ? 'bg-[var(--brand)] text-[var(--paper)]'
          : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--brand-mint)]'
      }`}
    >
      {children}
    </button>
  )
}

/** 1-5 stars. A radiogroup, so arrow keys work and the value is announced. */
export function StarRating({
  value,
  onChange,
  label = 'Rating',
}: {
  value: number | null
  onChange: (v: number | null) => void
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 5`}
          onClick={() => onChange(value === n ? null : n)}
          className={`rounded text-lg leading-none transition-transform hover:scale-110 ${
            value != null && n <= value ? 'text-[var(--brand-gold)]' : 'text-[var(--line)]'
          }`}
        >
          ★
        </button>
      ))}
      {value != null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-[11px] text-[var(--ink-soft)] underline"
        >
          clear
        </button>
      ) : null}
    </div>
  )
}

/** A yes / no / not-said tri-state. "Unanswered" has to stay distinct from "no". */
export function BoolField({
  value,
  onChange,
  label,
}: {
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
  label: string
}) {
  return (
    <div className="space-y-1">
      <span className={labelClass}>{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {[
          { v: true, text: 'Yes' },
          { v: false, text: 'No' },
        ].map((o) => (
          <button
            key={o.text}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(value === o.v ? undefined : o.v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value === o.v
                ? 'bg-[var(--brand)] text-[var(--paper)]'
                : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--brand-mint)]'
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}
