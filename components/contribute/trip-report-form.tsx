'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { DESTINATIONS } from '@/lib/data/destinations'
import { ALL_PLACES, ORIGIN_CITIES, type Place } from '@/lib/data/places'
import {
  SUMMARY_PROMPTS, TRANSPORT_MODES, getKind, kindIcon, kindLabel,
} from '@/lib/data/report-kinds'
import type { ReportTextInput } from '@/lib/data/report-text'
import {
  emptyItem, emptyReport, newPublicId, tripReportSchema,
  type TripReportData, type TripReportInput,
} from '@/lib/validations/trip-report'
import { Combobox, type ComboOption } from './combobox'
import { Chip, Field, eyebrowClass, inputClass, labelClass } from './form-ui'
import { ItemCard, type SessionMemory } from './item-card'
import { KindPicker } from './kind-picker'
import { PhotoUploader, type ReportPhoto } from './photo-uploader'
import { Receipt } from './receipt'
import { WritingAssist } from './writing-assist'

const STEPS = [
  { id: 'trip', label: 'The trip', hint: 'Where, when, how' },
  { id: 'items', label: 'What you found', hint: 'Add anything and everything' },
  { id: 'extras', label: 'Photos & you', hint: 'Optional, but nice' },
  { id: 'review', label: 'Review & send', hint: 'One last look' },
] as const

/** Bumped when the saved shape changes, so an old draft is ignored not crashed. */
const DRAFT_KEY = 'perch:trip-report:draft:v1'

interface Draft {
  publicId: string
  values: TripReportInput
  photos: ReportPhoto[]
}

const DEST_OPTIONS: ComboOption<(typeof DESTINATIONS)[number]>[] = DESTINATIONS.map((d) => ({
  value: d.name,
  hint: d.state,
  data: d,
}))

const ORIGIN_OPTIONS: ComboOption<Place>[] = [...ORIGIN_CITIES, ...ALL_PLACES].map((p) => ({
  value: p.name,
  hint: p.state,
  data: p,
}))

export function TripReportForm({ prefillSlug }: { prefillSlug?: string }) {
  const [step, setStep] = useState(0)
  const [publicId, setPublicId] = useState('')
  const [photos, setPhotos] = useState<ReportPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReportTextInput | null>(null)
  const [restored, setRestored] = useState(false)
  // What is typed in the destination box, as opposed to the slug it resolves to.
  const [destQuery, setDestQuery] = useState(
    () => DESTINATIONS.find((d) => d.slug === prefillSlug)?.name ?? '',
  )
  const headingRef = useRef<HTMLHeadingElement>(null)

  const form = useForm<TripReportInput, unknown, TripReportData>({
    resolver: zodResolver(tripReportSchema),
    defaultValues: emptyReport(prefillSlug),
    mode: 'onBlur',
  })
  const { register, control, handleSubmit, watch, setValue, reset, formState } = form
  const { errors } = formState

  const items = useFieldArray({ control, name: 'items' })

  // ── Session memory ───────────────────────────────────────────────────────
  // Values already typed this visit, offered back on the next item of the same
  // shape. A ref, never persisted, gone when the tab closes.
  const memoryRef = useRef<Map<string, Set<string>>>(new Map())
  const memory: SessionMemory = useMemo(
    () => ({
      recall: (key) => [...(memoryRef.current.get(key) ?? [])].slice(-5).reverse(),
      remember: (key, value) => {
        const v = value.trim()
        if (v.length < 2) return
        const set = memoryRef.current.get(key) ?? new Set<string>()
        set.add(v)
        memoryRef.current.set(key, set)
      },
    }),
    [],
  )

  // ── Draft restore ────────────────────────────────────────────────────────
  // crypto.getRandomValues only exists in the browser, so the ID is minted here
  // rather than during render.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved) as Draft
        if (draft?.values && draft.publicId) {
          reset(draft.values)
          setPhotos(draft.photos ?? [])
          setPublicId(draft.publicId)
          setDestQuery(
            DESTINATIONS.find((d) => d.slug === draft.values.destination_slug)?.name ?? '',
          )
          setRestored(true)
          return
        }
      }
    } catch {
      // Corrupt or full storage - start clean rather than block the form.
    }
    setPublicId(newPublicId())
  }, [reset])

  // ── Autosave ─────────────────────────────────────────────────────────────
  const values = watch()
  useEffect(() => {
    if (!publicId || receipt) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ publicId, values, photos }))
      } catch {
        // Private mode / quota. Autosave is a convenience, not a requirement.
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [values, photos, publicId, receipt])

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* nothing to do */
    }
  }

  function startFresh() {
    clearDraft()
    reset(emptyReport(prefillSlug))
    setPhotos([])
    setPublicId(newPublicId())
    setDestQuery(DESTINATIONS.find((d) => d.slug === prefillSlug)?.name ?? '')
    setRestored(false)
    setStep(0)
  }

  // Move focus to the new step's heading so a keyboard user is not left at the
  // bottom of the page they just left.
  const goTo = useCallback((next: number) => {
    setStep(next)
    requestAnimationFrame(() => headingRef.current?.focus())
  }, [])

  // ── Derived summary ──────────────────────────────────────────────────────
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const it of values.items ?? []) counts[it.kind] = (counts[it.kind] ?? 0) + 1
    return counts
  }, [values.items])

  const itemCount = values.items?.length ?? 0
  const destination = DESTINATIONS.find((d) => d.slug === values.destination_slug)

  // ── Submit ───────────────────────────────────────────────────────────────
  async function onSubmit(data: TripReportData) {
    setSubmitting(true)
    setSubmitError(null)

    // Both IDs are minted in the browser. That is not a shortcut: anon has no
    // SELECT on an unpublished row (migration 006), so `insert().select()` would
    // come back empty and there would be no id to hang the items off. Generating
    // them here keeps the whole submission deterministic and needs no read-back.
    const reportId = crypto.randomUUID()
    let id = publicId || newPublicId()

    const supabase = createClient()

    try {
      const reportRow = (thisId: string) => ({
        id: reportId,
        public_id: thisId,
        destination_slug: data.destination_slug ?? null,
        origin_name: data.origin_name ?? null,
        trip_date: data.trip_date || null,
        transport_mode: data.transport_mode ?? null,
        vehicle: data.vehicle ?? null,
        days: data.days ?? null,
        travellers: data.travellers ?? null,
        total_cost_inr: data.total_cost_inr ?? null,
        title: data.title,
        summary: data.summary ?? null,
        author_name: data.author_name ?? null,
        contact_email: data.contact_email ?? null,
        published: false,
      })

      let { error } = await supabase.from('trip_reports').insert(reportRow(id))

      // 887 million IDs makes a collision unlikely, not impossible.
      if (error?.code === '23505') {
        id = newPublicId()
        ;({ error } = await supabase.from('trip_reports').insert(reportRow(id)))
      }
      if (error) throw error

      if (data.items.length > 0) {
        const { error: itemError } = await supabase.from('trip_report_items').insert(
          data.items.map((it, i) => ({
            report_id: reportId,
            kind: it.kind,
            name: it.name ?? null,
            lat: it.lat ?? null,
            lng: it.lng ?? null,
            area: it.area ?? null,
            rating: it.rating ?? null,
            cost_inr: it.cost_inr ?? null,
            notes: it.notes ?? null,
            details: cleanDetails(it.kind, it.details),
            sort: i,
          })),
        )
        if (itemError) throw itemError
      }

      if (photos.length > 0) {
        const { error: mediaError } = await supabase.from('trip_report_media').insert(
          photos.map((p, i) => ({
            report_id: reportId,
            url: p.url,
            caption: p.caption.trim() || null,
            sort: i,
          })),
        )
        if (mediaError) throw mediaError
      }

      clearDraft()
      setPublicId(id)
      setReceipt({
        publicId: id,
        title: data.title,
        destinationSlug: data.destination_slug ?? null,
        originName: data.origin_name ?? null,
        tripDate: data.trip_date ?? null,
        transportMode: data.transport_mode ?? null,
        vehicle: data.vehicle ?? null,
        days: data.days ?? null,
        travellers: data.travellers ?? null,
        totalCostInr: data.total_cost_inr ?? null,
        summary: data.summary ?? null,
        authorName: data.author_name ?? null,
        items: data.items.map((it) => ({
          kind: it.kind,
          name: it.name ?? null,
          area: it.area ?? null,
          lat: it.lat ?? null,
          lng: it.lng ?? null,
          rating: it.rating ?? null,
          cost_inr: it.cost_inr ?? null,
          notes: it.notes ?? null,
          details: cleanDetails(it.kind, it.details),
        })),
        media: photos.map((p) => ({ url: p.url, caption: p.caption })),
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      // The draft is deliberately NOT cleared here: whatever went wrong, the
      // traveller's twenty minutes of typing survives a reload.
      setSubmitError(friendlyError(e))
      console.error('[trip-report] submit failed:', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (receipt) {
    return (
      <Receipt
        payload={receipt}
        onAnother={() => {
          setReceipt(null)
          startFresh()
        }}
      />
    )
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-5">
        {/* ─── Progress ───────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  i === step
                    ? 'bg-[var(--brand)] text-[var(--paper)]'
                    : i < step
                      ? 'bg-[var(--brand-mint)]/25 text-[var(--brand-deep)]'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]'
                }`}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>
          <div
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label="Form progress"
            className="h-1 overflow-hidden rounded-full bg-[var(--line)]"
          >
            <div
              className="meter-fill h-full rounded-full bg-gradient-to-r from-[var(--brand-mint)] to-[var(--brand)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {restored ? (
          <div className="assist-in flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--brand-mint)] bg-[var(--brand-mint)]/12 px-3 py-2 text-xs">
            <span className="text-[var(--ink)]">
              Picked up where you left off - this browser had an unsent draft.
            </span>
            <button type="button" onClick={startFresh} className="font-semibold text-[var(--clay)] underline">
              Start fresh
            </button>
          </div>
        ) : null}

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl tracking-tight text-[var(--ink)] outline-none"
        >
          {STEPS[step].label}
          <span className="ml-2 align-middle text-xs font-normal text-[var(--ink-soft)]">
            {STEPS[step].hint}
          </span>
        </h2>

        {/* ─── Step 0: the trip ───────────────────────────────────────── */}
        {step === 0 ? (
          <div className="step-in space-y-4">
            <div className="card space-y-4 p-4">
              <Field label="Give it a title" error={errors.title?.message}>
                {(id) => (
                  <input
                    id={id}
                    {...register('title')}
                    placeholder="e.g. Bengaluru to Munnar on a Himalayan, four days in the rain"
                    className={inputClass}
                  />
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Where did you go?"
                  hint={destination ? `${destination.district} · ${destination.elevationM.toLocaleString()}m · ${destination.state}` : 'Pick from the catalogue and we fill in the rest'}
                >
                  {(id) => (
                    <Combobox
                      id={id}
                      // The stored field is a SLUG, but what the traveller types
                      // is a name, so the text they see needs its own state -
                      // binding this to the resolved destination would swallow
                      // every keystroke that has not yet matched a real place.
                      value={destQuery}
                      onChange={(v) => {
                        setDestQuery(v)
                        // Free text that matches nothing clears the link to the
                        // catalogue rather than storing a slug that is not real.
                        const match = DESTINATIONS.find((d) => d.name.toLowerCase() === v.toLowerCase())
                        setValue('destination_slug', match?.slug ?? '', { shouldDirty: true })
                      }}
                      options={DEST_OPTIONS}
                      onPick={(o) => o.data && setValue('destination_slug', o.data.slug, { shouldDirty: true })}
                      placeholder="Start typing a hill station…"
                    />
                  )}
                </Field>

                <Field label="Where did you start from?">
                  {(id) => (
                    <Combobox
                      id={id}
                      value={String(values.origin_name ?? '')}
                      onChange={(v) => setValue('origin_name', v, { shouldDirty: true })}
                      options={ORIGIN_OPTIONS}
                      placeholder="Your city"
                    />
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="When" error={errors.trip_date?.message}>
                  {(id) => <input id={id} type="date" {...register('trip_date')} className={inputClass} />}
                </Field>
                <Field label="How many days" error={errors.days?.message}>
                  {(id) => <input id={id} inputMode="numeric" {...register('days')} placeholder="e.g. 4" className={inputClass} />}
                </Field>
                <Field label="How many of you" error={errors.travellers?.message}>
                  {(id) => <input id={id} inputMode="numeric" {...register('travellers')} placeholder="e.g. 2" className={inputClass} />}
                </Field>
              </div>

              <div className="space-y-1.5">
                <span className={labelClass}>How did you travel?</span>
                <div className="flex flex-wrap gap-1.5">
                  {TRANSPORT_MODES.map((m) => (
                    <Chip
                      key={m.id}
                      small
                      active={values.transport_mode === m.id}
                      onClick={() =>
                        setValue('transport_mode', values.transport_mode === m.id ? '' : m.id, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <span aria-hidden>{m.icon}</span> {m.label}
                    </Chip>
                  ))}
                </div>
                {errors.transport_mode ? (
                  <p role="alert" className="text-[11px] font-medium text-[var(--clay)]">
                    {errors.transport_mode.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What were you in / on?" hint="Ride reports always start here.">
                  {(id) => (
                    <input
                      id={id}
                      {...register('vehicle')}
                      placeholder="e.g. Royal Enfield Himalayan 411, 2019"
                      className={inputClass}
                    />
                  )}
                </Field>
                <Field label="Roughly what it cost, all in (₹)" error={errors.total_cost_inr?.message}>
                  {(id) => (
                    <input id={id} inputMode="decimal" {...register('total_cost_inr')} placeholder="e.g. 18000" className={inputClass} />
                  )}
                </Field>
              </div>
            </div>

            <div className="card p-4">
              <WritingAssist
                label="The trip, in your words"
                value={String(values.summary ?? '')}
                onChange={(v) => setValue('summary', v, { shouldDirty: true })}
                prompts={SUMMARY_PROMPTS}
                placeholder="What happened. What you would tell someone about to do the same run."
                rows={6}
                target={80}
                error={errors.summary?.message}
              />
            </div>
          </div>
        ) : null}

        {/* ─── Step 1: items ──────────────────────────────────────────── */}
        {step === 1 ? (
          <div className="step-in space-y-4">
            <KindPicker
              counts={kindCounts}
              onAdd={(kind) => {
                items.append(emptyItem(kind))
                requestAnimationFrame(() => {
                  document.getElementById('report-items-end')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                })
              }}
            />

            {items.fields.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--ink-soft)]">
                Nothing added yet. Pick anything above - a petrol bunk, the WiFi speed, the SIM that
                worked, the house that put you up. There is no wrong order and no required item.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.fields.map((field, index) => (
                  <ItemCard
                    key={field.id}
                    index={index}
                    kind={field.kind}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    destinationSlug={String(values.destination_slug ?? '')}
                    memory={memory}
                    error={Array.isArray(errors.items) ? firstErrorMessage(errors.items[index]) : ''}
                    isFirst={index === 0}
                    isLast={index === items.fields.length - 1}
                    onRemove={() => items.remove(index)}
                    onMove={(dir) => items.move(index, index + dir)}
                  />
                ))}
              </ul>
            )}
            <div id="report-items-end" />
          </div>
        ) : null}

        {/* ─── Step 2: photos + who you are ───────────────────────────── */}
        {step === 2 ? (
          <div className="step-in space-y-4">
            <div className="card p-4">
              {publicId ? (
                <PhotoUploader photos={photos} onChange={setPhotos} publicId={publicId} />
              ) : (
                <p className="text-xs text-[var(--ink-soft)]">Getting ready…</p>
              )}
            </div>

            <div className="card space-y-4 p-4">
              <p className={eyebrowClass}>About you - both optional</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name or handle to credit" hint="Left blank, the report is simply anonymous.">
                  {(id) => <input id={id} {...register('author_name')} placeholder="e.g. Ravi, or @ghatrider" className={inputClass} />}
                </Field>
                <Field
                  label="Email"
                  error={errors.contact_email?.message}
                  hint="Only so an admin can ask if something is unclear. It is never shown on the site - the database will not even hand it to a public reader."
                >
                  {(id) => <input id={id} type="email" {...register('contact_email')} placeholder="you@example.com" className={inputClass} />}
                </Field>
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── Step 3: review ─────────────────────────────────────────── */}
        {step === 3 ? (
          <div className="step-in space-y-4">
            <div className="card space-y-3 p-4">
              <p className={eyebrowClass}>What you are sending</p>
              <h3 className="font-display text-xl text-[var(--ink)]">
                {String(values.title || 'Untitled report')}
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <ReviewStat label="Destination" value={destination?.name ?? '—'} />
                <ReviewStat label="Items" value={String(itemCount)} />
                <ReviewStat label="Photos" value={String(photos.length)} />
                <ReviewStat label="Kinds" value={String(Object.keys(kindCounts).length)} />
              </dl>
              {itemCount > 0 ? (
                <ul className="space-y-1 text-sm">
                  {(values.items ?? []).map((it, i) => (
                    <li key={i} className="flex items-center gap-2 text-[var(--ink-soft)]">
                      <span aria-hidden>{kindIcon(it.kind)}</span>
                      <span className="font-medium text-[var(--ink)]">{kindLabel(it.kind)}</span>
                      {it.name ? <span className="truncate">· {String(it.name)}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="card space-y-2 p-4 text-xs leading-relaxed text-[var(--ink-soft)]">
              <p className="text-sm font-semibold text-[var(--ink)]">Before you send</p>
              <p>
                Your report gets a unique ID and a link that works straight away. It joins the
                public <strong>Reports</strong> list once an admin has looked it over - that queue
                is the only thing standing between the internet and this site&apos;s front page.
              </p>
              <p>
                Nothing is emailed or texted to you. The next screen has your ID, a copy button and
                a download - save one of them.
              </p>
              <p>Only write down phone numbers and names you have permission to share.</p>
            </div>

            {submitError ? (
              <p role="alert" className="rounded-xl border border-[var(--clay)]/40 bg-[var(--clay)]/10 px-3 py-2.5 text-xs leading-relaxed text-[var(--clay)]">
                {submitError}
              </p>
            ) : null}

            {Object.keys(errors).length > 0 ? (
              <p role="alert" className="rounded-xl border border-[var(--clay)]/40 bg-[var(--clay)]/10 px-3 py-2 text-xs text-[var(--clay)]">
                Something above needs fixing: {submitBlockerMessage(errors)}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ─── Navigation ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className="btn-ghost text-sm">
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => goTo(step + 1)} className="btn-primary text-sm">
              Next: {STEPS[step + 1].label} →
            </button>
          ) : (
            <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-60">
              {submitting ? 'Sending…' : 'Send my report'}
            </button>
          )}
        </div>
      </div>

      {/* ─── Sticky running summary ───────────────────────────────────── */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-3 p-4">
          <p className={eyebrowClass}>Your report so far</p>
          <p className="font-display text-lg leading-tight text-[var(--ink)]">
            {String(values.title || 'Untitled')}
          </p>
          <p className="text-xs text-[var(--ink-soft)]">
            {destination ? destination.name : 'No destination yet'}
            {values.origin_name ? ` · from ${String(values.origin_name)}` : ''}
          </p>

          {itemCount > 0 ? (
            <ul className="space-y-1">
              {Object.entries(kindCounts).map(([kind, n]) => (
                <li key={kind} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--ink-soft)]">
                    <span aria-hidden>{getKind(kind).icon}</span> {kindLabel(kind)}
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--ink)]">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--ink-soft)]">No items yet.</p>
          )}

          <div className="border-t border-[var(--hairline)] pt-2 text-[11px] text-[var(--ink-soft)]">
            <p>{photos.length} photo{photos.length === 1 ? '' : 's'}</p>
            <p className="mt-1">Saved in this browser as you type.</p>
            {publicId ? (
              <p className="mt-1">
                ID reserved: <span className="font-mono text-[var(--brand)]">{publicId}</span>
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </form>
  )
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">{label}</dt>
      <dd className="truncate font-semibold text-[var(--ink)]">{value}</dd>
    </div>
  )
}

/**
 * Strip the unanswered fields and turn the numeric ones into numbers.
 *
 * Everything arrives as a string because HTML controls only make strings; the
 * kind config is what knows which of them were meant to be numbers, which is
 * the whole reason it is data rather than a switch statement.
 */
function cleanDetails(
  kind: string,
  details: Record<string, string | boolean>,
): Record<string, string | number | boolean> {
  const config = getKind(kind)
  const out: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(details ?? {})) {
    if (value === '' || value === undefined || value === null) continue
    const field = config.fields.find((f) => f.key === key)
    if (field?.type === 'number' && typeof value === 'string') {
      const n = Number(value)
      if (Number.isFinite(n)) out[key] = n
      continue
    }
    out[key] = value
  }
  return out
}

/**
 * The first real message anywhere in RHF's error tree.
 *
 * It has to recurse: `errors.items` is an ARRAY of per-item error objects, so a
 * shallow scan finds an object with no `message` and reports the useless "check
 * the fields marked in red" while the actual problem ("Latitude does not look
 * right", four cards down) stays invisible.
 */
function firstErrorMessage(node: unknown): string {
  if (!node || typeof node !== 'object') return ''

  const message = (node as { message?: unknown }).message
  if (typeof message === 'string' && message) return message

  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = firstErrorMessage(value)
    if (found) return found
  }
  return ''
}

/** Same walk, but labelled with which item card it came from. */
function submitBlockerMessage(errors: FieldErrors<TripReportInput>): string {
  const top = firstErrorMessage({ ...errors, items: undefined })
  if (top) return top

  const items = errors.items
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const found = firstErrorMessage(items[i])
      if (found) return `item ${i + 1} - ${found.charAt(0).toLowerCase()}${found.slice(1)}`
    }
  }
  return 'check the fields marked in red.'
}

/** Database failures, translated into something a traveller can act on. */
function friendlyError(e: unknown): string {
  const err = e as { code?: string; message?: string } | null
  const code = err?.code ?? ''
  const message = err?.message ?? ''

  if (code === '42P01' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)) {
    return 'Trip reports are not switched on for this site yet - the database tables have not been created (supabase/migrations/006_trip_reports.sql). Nothing was sent, and your draft is still here, so try again once the owner has run it.'
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'The database refused that write. Nothing was saved. Your draft is safe in this browser - please try again in a moment.'
  }
  if (/failed to fetch|networkerror/i.test(message)) {
    return 'Could not reach the server. Check your connection - your draft is saved in this browser, so nothing is lost.'
  }
  return `Something went wrong sending the report${message ? `: ${message}` : ''}. Nothing was lost - your draft is still saved in this browser.`
}
