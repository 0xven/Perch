'use client'

import { useState } from 'react'
import Link from 'next/link'
import { downloadReportMarkdown, type ReportTextInput } from '@/lib/data/report-text'

/**
 * What you get instead of an email.
 *
 * We are NOT emailing or texting a confirmation, and this screen says so in
 * words rather than implying a mail is on its way. Both channels were priced
 * and rejected: SMS to Indian numbers needs TRAI DLT registration plus a paid
 * gateway, and transactional email needs a keyed provider - either one breaks
 * the $0, keyless rule the whole site is built on. So the receipt is the
 * artefact: an ID to copy, a file to keep, and a link that works immediately.
 */
export function Receipt({
  payload,
  onAnother,
}: {
  payload: ReportTextInput
  onAnother: () => void
}) {
  const [copied, setCopied] = useState<'id' | 'link' | null>(null)

  // Read once, in a lazy initialiser rather than an effect. This screen only
  // ever mounts after a successful client-side submit, so there is no server
  // render to disagree with.
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin))
  const shareUrl = `${origin}/report/${payload.publicId}`

  async function copy(text: string, what: 'id' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard permission refused - the value is on screen to select by hand.
    }
  }

  return (
    <div className="rise space-y-6">
      <div className="card overflow-hidden">
        <div className="on-dark bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] px-6 py-8 text-center">
          <p className="text-3xl" aria-hidden>✓</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight text-white">Report saved</h2>
          <p className="mt-1 text-sm text-white/70">
            It is live at the link below right now. It joins the public list once it has been
            looked over.
          </p>

          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Your report ID
            </p>
            <p className="id-pop mt-1 select-all font-display text-3xl tracking-[0.08em] text-[var(--brand-gold)]">
              {payload.publicId}
            </p>
            <button
              type="button"
              onClick={() => copy(payload.publicId, 'id')}
              className="mt-3 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-white/60"
            >
              {copied === 'id' ? 'Copied ✓' : 'Copy ID'}
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {/* The honest bit. */}
          <div className="rounded-2xl border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">
              Save this ID. We are not emailing it to you.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">
              There is no email and no SMS coming - Perch has no mail service and no SMS gateway,
              on purpose, because both cost money and this site does not. Copy the ID, or download
              the file below, and you will always be able to find this report again.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadReportMarkdown({ ...payload, shareUrl })}
              className="btn-primary text-sm"
            >
              ⤓ Download my copy
            </button>
            <button
              type="button"
              onClick={() => copy(shareUrl, 'link')}
              className="btn-ghost text-sm"
            >
              {copied === 'link' ? 'Link copied ✓' : '🔗 Copy the share link'}
            </button>
            <Link href={`/report/${payload.publicId}`} className="btn-ghost text-sm">
              Open my report →
            </Link>
          </div>

          <div className="space-y-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              Shareable link
            </p>
            <p className="break-all font-mono text-xs text-[var(--brand)]">{shareUrl}</p>
            <p className="text-[11px] text-[var(--ink-soft)]">
              Anyone with this link can read the report already - like an unlisted video. It
              appears on the public <Link href="/reports" className="underline">reports list</Link>{' '}
              once it is approved.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Items" value={payload.items.length} />
            <Stat label="Photos" value={payload.media.length} />
            <Stat label="Kinds" value={new Set(payload.items.map((i) => i.kind)).size} />
            <Stat label="Words" value={countWords(payload)} />
          </dl>

          <button
            type="button"
            onClick={onAnother}
            className="text-sm font-medium text-[var(--brand)] underline"
          >
            Write another report
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">{label}</dt>
      <dd className="font-display text-2xl text-[var(--ink)]">{value}</dd>
    </div>
  )
}

function countWords(payload: ReportTextInput): number {
  const text = [payload.summary ?? '', ...payload.items.map((i) => i.notes ?? '')].join(' ').trim()
  return text ? text.split(/\s+/).length : 0
}
