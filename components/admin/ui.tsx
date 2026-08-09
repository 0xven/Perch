'use client'

import { useFormStatus } from 'react-dom'

/**
 * Shared bits for the admin forms. Everything here is token-driven
 * (var(--paper) / --ink / --brand / --line / --surface / --clay) so the panel
 * stays on the same warm-paper theme as the public site.
 */

export const fieldClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-soft)]/60 focus:border-[var(--brand)]'

export const labelClass =
  'block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]'

/** Submit button that disables + relabels itself while the action is in flight. */
export function SubmitButton({
  children,
  pendingLabel = 'Working...',
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode
  pendingLabel?: string
  variant?: 'primary' | 'ghost'
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} text-sm disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

/** Destructive submit - asks first, since these deletes are not undoable. */
export function DeleteButton({
  confirm,
  children = 'Delete',
}: {
  confirm: string
  children?: React.ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!globalThis.confirm(confirm)) e.preventDefault()
      }}
      className="rounded-xl border border-[var(--clay)]/40 px-3 py-2 text-xs font-semibold text-[var(--clay)] transition-colors hover:bg-[var(--clay)]/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Deleting...' : children}
    </button>
  )
}

export function Notice({ state }: { state: { error?: string; message?: string } }) {
  if (state.error) {
    return (
      <p className="rounded-xl border border-[var(--clay)]/40 bg-[var(--clay)]/10 px-3 py-2 text-xs text-[var(--clay)]">
        {state.error}
      </p>
    )
  }
  if (state.message) {
    return (
      <p className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3 py-2 text-xs text-[var(--brand)]">
        {state.message}
      </p>
    )
  }
  return null
}
