'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { WritingPrompt } from '@/lib/data/report-kinds'
import { labelClass } from './form-ui'

// ─── Why this is not an LLM ──────────────────────────────────────────────────
//
// "Help me write this" here is a set of QUESTION CHIPS that drop a half-finished
// sentence into the box, not a model that writes prose for the traveller. That
// is a deliberate choice, on three grounds:
//
//   1. Cost. An LLM call per keystroke-pause, per field, per visitor is a
//      metered bill on a site whose entire premise is $0 and keyless. There is
//      no free tier that survives a form with thirty textareas on it.
//   2. Latency. A chip is instant. A model round-trip is not, and a hesitation
//      in the middle of typing is worse than no help at all.
//   3. Data quality, which is the real argument. This form is not asking for an
//      essay - it is asking what the road surface was and where the signal
//      died. Generated prose fills the box with confident sentences nobody
//      witnessed; a question the traveller answers themselves produces a fact.
//      "Where did you last refuel?" beats any paragraph a model could invent.
//
// The grammar check IS a network call, but to LanguageTool's free public
// endpoint: no key, no signup, no billing relationship to get wrong. It is
// strictly optional decoration - every failure path below is silent, and
// submission never waits on it.

const LT_ENDPOINT = 'https://api.languagetool.org/v2/check'
const DEBOUNCE_MS = 800
const MIN_CHARS = 15

/**
 * The public endpoint allows roughly 20 requests a minute per IP. This form can
 * have dozens of textareas alive at once, and they all share the visitor's one
 * IP, so the budget is tracked at MODULE level rather than per component.
 */
const REQUEST_LOG: number[] = []
const MAX_PER_MINUTE = 14
let cooldownUntil = 0

function mayCheck(): boolean {
  const now = Date.now()
  if (now < cooldownUntil) return false
  while (REQUEST_LOG.length > 0 && now - REQUEST_LOG[0] > 60_000) REQUEST_LOG.shift()
  return REQUEST_LOG.length < MAX_PER_MINUTE
}

interface LtMatch {
  message: string
  shortMessage?: string
  offset: number
  length: number
  replacements: { value: string }[]
  rule?: { id?: string; issueType?: string }
}

interface Suggestion {
  message: string
  offset: number
  length: number
  original: string
  replacements: string[]
}

function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** 0-1. Words are most of it; a couple of concrete details nudge it up. */
function quality(text: string, target: number): number {
  const words = wordCount(text)
  const base = Math.min(words / target, 1) * 0.8
  const hasNumbers = /\d/.test(text) ? 0.1 : 0
  const hasPlace = /[A-Z][a-z]{2,}/.test(text) ? 0.1 : 0
  return Math.min(base + hasNumbers + hasPlace, 1)
}

function qualityNote(score: number, words: number): string {
  if (words === 0) return 'Anything you write here is more than what is out there now.'
  if (score < 0.35) return 'Keep going - a couple more specifics is what makes this useful.'
  if (score < 0.7) return 'Good. A number or a place name would make it better still.'
  return 'That is genuinely useful detail. Thank you.'
}

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  prompts: readonly WritingPrompt[]
  placeholder?: string
  rows?: number
  /** Word count the quality meter treats as "full marks". */
  target?: number
  error?: string
}

export function WritingAssist({
  label,
  value,
  onChange,
  prompts,
  placeholder,
  rows = 4,
  target = 45,
  error,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [checking, setChecking] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastCheckedRef = useRef('')
  const fieldId = useId()
  const helpId = `${fieldId}-help`

  const words = wordCount(value)
  const score = quality(value, target)

  // Suggestions carry offsets into the text they were computed from, so they
  // are derived away rather than cleared: delete the box back down to nothing
  // and they are gone on the same render, no effect involved.
  const visible = value.trim().length < MIN_CHARS ? [] : suggestions

  // ── Grammar / spelling, debounced ────────────────────────────────────────
  useEffect(() => {
    const text = value.trim()

    // Too short or already checked - nothing to do. The "too short" case does
    // not need to clear state here: `visible` below derives that from the text.
    if (text.length < MIN_CHARS || text === lastCheckedRef.current) return

    const timer = setTimeout(async () => {
      if (!mayCheck()) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setChecking(true)
      REQUEST_LOG.push(Date.now())

      try {
        const body = new URLSearchParams({ text, language: 'en-US', level: 'default' })
        const res = await fetch(LT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        })

        if (res.status === 429) {
          // Backed off for a minute rather than hammering a free service.
          cooldownUntil = Date.now() + 60_000
          return
        }
        if (!res.ok) return

        const json = (await res.json()) as { matches?: LtMatch[] }
        lastCheckedRef.current = text

        setSuggestions(
          (json.matches ?? [])
            .filter((m) => m.replacements.length > 0)
            .slice(0, 6)
            .map((m) => ({
              message: m.shortMessage || m.message,
              offset: m.offset,
              length: m.length,
              original: text.slice(m.offset, m.offset + m.length),
              replacements: m.replacements.slice(0, 3).map((r) => r.value),
            })),
        )
      } catch {
        // Offline, blocked, aborted, rate-limited, service down - all the same
        // answer: no suggestions, no error, nothing in the traveller's way.
      } finally {
        setChecking(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [value])

  // Applying one fix shifts every later offset, so the rest are dropped and the
  // debounce re-checks the new text a moment later.
  const applySuggestion = useCallback(
    (s: Suggestion, replacement: string) => {
      const text = value.trim()
      onChange(text.slice(0, s.offset) + replacement + text.slice(s.offset + s.length))
      setSuggestions([])
      lastCheckedRef.current = ''
      textareaRef.current?.focus()
    },
    [value, onChange],
  )

  function applyPrompt(p: WritingPrompt) {
    const sep = value.trim() === '' ? '' : value.trimEnd().endsWith('.') ? ' ' : '. '
    const next = `${value.trimEnd()}${sep}${p.scaffold}`
    onChange(next)
    // Drop the caret at the end of the scaffold so they just keep typing.
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.length, next.length)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={fieldId} className={labelClass}>
          {label}
        </label>
        {prompts.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowPrompts((s) => !s)}
            aria-expanded={showPrompts}
            className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] font-semibold text-[var(--brand)] transition-colors hover:border-[var(--brand-mint)]"
          >
            {showPrompts ? 'Hide prompts' : '✍️ Help me write this'}
          </button>
        ) : null}
      </div>

      {showPrompts ? (
        <div className="assist-in space-y-2 rounded-xl border border-dashed border-[var(--brand-mint)] bg-[var(--brand-mint)]/8 p-3">
          <p className="text-[11px] text-[var(--ink-soft)]">
            Tap a question and we will start the sentence. You finish it.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {prompts.map((p) => (
              <button
                key={p.q}
                type="button"
                onClick={() => applyPrompt(p)}
                className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--paper)]"
              >
                {p.q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <textarea
        id={fieldId}
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={helpId}
        className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-soft)]/60 focus:border-[var(--brand)]"
      />

      {/* Quality meter - a nudge toward detail, never a gate. */}
      <div id={helpId} className="flex items-center gap-2.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="meter-fill h-full rounded-full bg-gradient-to-r from-[var(--brand-mint)] to-[var(--brand)]"
            style={{ width: `${Math.round(score * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-soft)]">
          {words} {words === 1 ? 'word' : 'words'}
        </span>
      </div>
      <p className="text-[11px] text-[var(--ink-soft)]">{qualityNote(score, words)}</p>

      {/* Grammar + spelling. Silent when it has nothing to say. */}
      {checking && visible.length === 0 ? (
        <p className="text-[11px] text-[var(--ink-soft)]/70">Checking spelling…</p>
      ) : null}

      {visible.length > 0 ? (
        <div className="assist-in space-y-1.5 rounded-xl border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/8 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Spelling &amp; grammar
          </p>
          <ul className="space-y-1.5">
            {visible.map((s) => (
              <li key={`${s.offset}-${s.original}`} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded bg-[var(--clay)]/15 px-1.5 py-0.5 font-medium text-[var(--clay)] line-through">
                  {s.original}
                </span>
                <span className="text-[var(--ink-soft)]">→</span>
                {s.replacements.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => applySuggestion(s, r)}
                    className="rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 font-medium text-[var(--brand)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--paper)]"
                  >
                    {r}
                  </button>
                ))}
                <span className="w-full text-[10px] text-[var(--ink-soft)]">{s.message}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-[var(--ink-soft)]/80">
            Checked by LanguageTool. Ignore any of it - none of this blocks your report.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[11px] font-medium text-[var(--clay)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
