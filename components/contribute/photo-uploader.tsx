'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadReportPhoto } from '@/lib/supabase/report-storage'
import {
  REPORT_PHOTO_MAX_COUNT, REPORT_PHOTO_TYPES, checkReportPhoto,
} from '@/lib/validations/trip-report'
import { eyebrowClass, inputClass } from './form-ui'

export interface ReportPhoto {
  url: string
  caption: string
  /** Local blob URL, used for the thumbnail until the bucket URL is live. */
  preview?: string
}

interface Props {
  photos: ReportPhoto[]
  onChange: (photos: ReportPhoto[]) => void
  /** The report's public_id - photos are foldered under it. */
  publicId: string
}

export function PhotoUploader({ photos, onChange, publicId }: Props) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)

    const room = REPORT_PHOTO_MAX_COUNT - photos.length
    if (room <= 0) {
      setError(`That is the limit - ${REPORT_PHOTO_MAX_COUNT} photos per report.`)
      return
    }

    const files = Array.from(fileList).slice(0, room)
    if (files.length < fileList.length) {
      setError(`Only the first ${files.length} were taken - the limit is ${REPORT_PHOTO_MAX_COUNT} per report.`)
    }

    // Size and type first, before a single byte goes over the wire. The bucket
    // enforces the same two rules server-side; this is just the good error
    // message (see lib/validations/trip-report.ts).
    const valid: File[] = []
    for (const f of files) {
      const check = checkReportPhoto(f)
      if (check.ok) valid.push(f)
      else setError(check.error)
    }
    if (valid.length === 0) return

    setBusy(true)
    setProgress({ done: 0, total: valid.length })

    const supabase = createClient()
    const added: ReportPhoto[] = []

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i]
      const result = await uploadReportPhoto(supabase, file, publicId)
      if (result.ok) {
        added.push({ url: result.url, caption: '', preview: URL.createObjectURL(file) })
      } else {
        setError(result.error)
      }
      setProgress({ done: i + 1, total: valid.length })
    }

    onChange([...photos, ...added])
    setBusy(false)
    setProgress(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeAt(i: number) {
    const p = photos[i]
    if (p.preview) URL.revokeObjectURL(p.preview)
    onChange(photos.filter((_, n) => n !== i))
  }

  function setCaption(i: number, caption: string) {
    onChange(photos.map((p, n) => (n === i ? { ...p, caption } : p)))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={eyebrowClass}>
          Photos · {photos.length} / {REPORT_PHOTO_MAX_COUNT}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || photos.length >= REPORT_PHOTO_MAX_COUNT}
          className="btn-ghost text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Uploading…' : '＋ Add photos'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={REPORT_PHOTO_TYPES.join(',')}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
        aria-label="Choose photos to add to this report"
      />

      {progress ? (
        <div className="space-y-1">
          <div className="h-1 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="meter-fill h-full rounded-full bg-[var(--brand)]"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--ink-soft)]">
            Uploading {progress.done} of {progress.total}…
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-[var(--clay)]/40 bg-[var(--clay)]/10 px-3 py-2 text-xs text-[var(--clay)]">
          {error}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {photos.map((p, i) => (
            <li key={p.url} className="item-in card overflow-hidden">
              {/* Plain <img>: this is a just-uploaded blob preview swapping to a
                  bucket URL, which is the one case next/image's optimiser adds
                  a round trip and buys nothing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.preview ?? p.url}
                alt=""
                className="h-32 w-full object-cover"
              />
              <div className="space-y-2 p-2.5">
                <input
                  value={p.caption}
                  onChange={(e) => setCaption(i, e.target.value)}
                  placeholder="Caption (optional)"
                  maxLength={300}
                  aria-label={`Caption for photo ${i + 1}`}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-[11px] font-medium text-[var(--clay)] underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--line)] p-4 text-center text-xs text-[var(--ink-soft)]">
          JPEG, PNG or WebP · up to 5MB each · {REPORT_PHOTO_MAX_COUNT} max.
          <br />
          Photos are public once your report is approved.
        </p>
      )}
    </div>
  )
}
