'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { getKind, type KindField } from '@/lib/data/report-kinds'
import { ALL_PLACES, DESTINATION_PLACES, haversineKm, type Place } from '@/lib/data/places'
import type { TripReportInput } from '@/lib/validations/trip-report'
import { Combobox, type ComboOption } from './combobox'
import { BoolField, Field, StarRating, eyebrowClass, inputClass, labelClass } from './form-ui'
import { WritingAssist } from './writing-assist'
import { asBoolOrUndefined, asNumberOrNull, asText, itemPath, readItem, writeItem } from './rhf-paths'

/**
 * Values the traveller has already typed this session, keyed by field.
 *
 * Somebody filing six fuel stops types the same brand six times, and somebody
 * reporting two SIMs types the same two networks in five places. Remembering
 * within the session costs nothing and is never persisted anywhere.
 */
export interface SessionMemory {
  recall: (key: string) => string[]
  remember: (key: string, value: string) => void
}

interface StaySuggestion {
  name: string
  area: string
  state: string
  lat: number
  lng: number
  type: string
  wifi: boolean | null
}

interface Props {
  index: number
  kind: string
  register: UseFormRegister<TripReportInput>
  watch: UseFormWatch<TripReportInput>
  setValue: UseFormSetValue<TripReportInput>
  /** The trip's destination, used to scope the stay lookup. */
  destinationSlug: string
  memory: SessionMemory
  /** First validation message for this item, surfaced on the card itself. */
  error?: string
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}

const PLACE_OPTIONS: ComboOption<Place>[] = ALL_PLACES.map((p) => ({
  value: p.name,
  hint: p.state,
  data: p,
}))

export function ItemCard({
  index, kind, register, watch, setValue, destinationSlug, memory, error,
  onRemove, onMove, isFirst, isLast,
}: Props) {
  const config = getKind(kind)
  const [open, setOpen] = useState(true)

  const name = asText(readItem(watch, index, 'name'))
  const area = asText(readItem(watch, index, 'area'))
  const notes = asText(readItem(watch, index, 'notes'))
  const rating = asNumberOrNull(readItem(watch, index, 'rating'))
  const lat = asNumberOrNull(readItem(watch, index, 'lat'))
  const lng = asNumberOrNull(readItem(watch, index, 'lng'))

  // ── Stay autocomplete, from the OpenStreetMap set ────────────────────────
  // Server-side lookup: the full stays list is ~470KB and deliberately never
  // shipped to the browser (see app/api/stay-suggest/route.ts).
  const [stayOptions, setStayOptions] = useState<ComboOption<StaySuggestion>[]>([])
  const stayAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (config.id !== 'stay') return

    const timer = setTimeout(async () => {
      // Nothing to search on yet - clear rather than leave a stale list up.
      if (!destinationSlug && name.trim().length < 2) {
        setStayOptions([])
        return
      }
      stayAbort.current?.abort()
      const controller = new AbortController()
      stayAbort.current = controller
      try {
        const params = new URLSearchParams({ dest: destinationSlug, q: name.trim() })
        const res = await fetch(`/api/stay-suggest?${params}`, { signal: controller.signal })
        if (!res.ok) return
        const json = (await res.json()) as { stays: StaySuggestion[] }
        setStayOptions(
          json.stays.map((s) => ({
            value: s.name,
            hint: `${s.type}${s.wifi ? ' · wifi' : ''} · ${s.area}`,
            data: s,
          })),
        )
      } catch {
        // Offline or aborted - the field is free text anyway.
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [config.id, destinationSlug, name])

  // The nearest catalogued destination to whatever coordinate we ended up with.
  // Cheap orientation: "is this pin actually where I think it is".
  const nearest = useMemo(() => {
    if (lat == null || lng == null) return null
    let best: { place: Place; km: number } | null = null
    for (const p of DESTINATION_PLACES) {
      const km = haversineKm({ lat, lng }, p)
      if (!best || km < best.km) best = { place: p, km }
    }
    return best
  }, [lat, lng])

  function applyPlace(p: Place) {
    writeItem(setValue, index, 'area', `${p.name}, ${p.state}`)
    writeItem(setValue, index, 'lat', p.lat)
    writeItem(setValue, index, 'lng', p.lng)
  }

  function applyStay(s: StaySuggestion) {
    writeItem(setValue, index, 'name', s.name)
    writeItem(setValue, index, 'area', `${s.area}, ${s.state}`)
    writeItem(setValue, index, 'lat', s.lat)
    writeItem(setValue, index, 'lng', s.lng)
    if (s.type) writeItem(setValue, index, 'details.stay_type', titleCase(s.type))
  }

  return (
    <li className="item-in card overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] bg-[var(--surface-2)] px-3 py-2">
        <span className="text-lg" aria-hidden>{config.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {config.label}
            {name ? <span className="font-normal text-[var(--ink-soft)]"> · {name}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>↑</IconButton>
          <IconButton label="Move down" disabled={isLast} onClick={() => onMove(1)}>↓</IconButton>
          <IconButton label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((o) => !o)}>
            {open ? '▾' : '▸'}
          </IconButton>
          <IconButton label={`Remove this ${config.label}`} danger onClick={onRemove}>✕</IconButton>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 p-3.5">
          <p className="text-[11px] leading-snug text-[var(--ink-soft)]">{config.blurb}</p>

          {/* Item-level validation lives on the card, not only in the summary at
              the bottom of the form - a card can be twenty fields long. */}
          {error ? (
            <p role="alert" className="rounded-lg border border-[var(--clay)]/40 bg-[var(--clay)]/10 px-2.5 py-1.5 text-[11px] font-medium text-[var(--clay)]">
              {error}
            </p>
          ) : null}

          {/* ─── Name ───────────────────────────────────────────────────── */}
          <Field label="Name">
            {(id) =>
              config.id === 'stay' ? (
                <Combobox<StaySuggestion>
                  id={id}
                  value={name}
                  onChange={(v) => writeItem(setValue, index, 'name', v)}
                  options={stayOptions}
                  onPick={(o) => o.data && applyStay(o.data)}
                  preFiltered
                  placeholder={config.namePlaceholder}
                />
              ) : (
                <input
                  id={id}
                  {...register(itemPath(index, 'name'))}
                  placeholder={config.namePlaceholder}
                  className={inputClass}
                />
              )
            }
          </Field>

          {/* ─── Location ───────────────────────────────────────────────── */}
          <div className="space-y-1.5 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-3">
            <p className={eyebrowClass}>
              {config.geo === 'stretch' ? 'Roughly where this stretch is' : 'Where'}
            </p>
            <Field label="Town, city or destination">
              {(id) => (
                <Combobox<Place>
                  id={id}
                  value={area}
                  onChange={(v) => writeItem(setValue, index, 'area', v)}
                  options={PLACE_OPTIONS}
                  onPick={(o) => o.data && applyPlace(o.data)}
                  placeholder="Start typing - we fill in the coordinates"
                />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Latitude">
                {(id) => (
                  <input
                    id={id}
                    inputMode="decimal"
                    {...register(itemPath(index, 'lat'))}
                    placeholder="e.g. 11.4102"
                    className={inputClass}
                  />
                )}
              </Field>
              <Field label="Longitude">
                {(id) => (
                  <input
                    id={id}
                    inputMode="decimal"
                    {...register(itemPath(index, 'lng'))}
                    placeholder="e.g. 76.6950"
                    className={inputClass}
                  />
                )}
              </Field>
            </div>
            {nearest ? (
              <p className="text-[11px] text-[var(--brand)]">
                📍 Nearest catalogued destination: {nearest.place.name}
                {nearest.km > 0 ? ` · about ${nearest.km} km away` : ''}
              </p>
            ) : (
              <p className="text-[11px] text-[var(--ink-soft)]">
                Coordinates are optional - without them this item just will not sit on the map.
              </p>
            )}
          </div>

          {/* ─── Kind-specific fields, straight from the taxonomy ───────── */}
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((f) => (
              <KindFieldInput
                key={f.key}
                field={f}
                index={index}
                register={register}
                watch={watch}
                setValue={setValue}
                memory={memory}
              />
            ))}
          </div>

          {/* ─── Universal: rating + cost ───────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className={labelClass}>Your rating</span>
              <StarRating
                value={rating}
                label={`Rating for this ${config.label}`}
                onChange={(v) => writeItem(setValue, index, 'rating', v ?? '')}
              />
            </div>
            <Field label="What it cost you (₹)">
              {(id) => (
                <input
                  id={id}
                  inputMode="decimal"
                  {...register(itemPath(index, 'cost_inr'))}
                  placeholder="Total, in rupees"
                  className={inputClass}
                />
              )}
            </Field>
          </div>

          {/* ─── Notes, with the writing help ───────────────────────────── */}
          <WritingAssist
            label="Notes - the bit people actually read"
            value={notes}
            onChange={(v) => writeItem(setValue, index, 'notes', v)}
            prompts={config.prompts}
            placeholder="What would you tell a friend heading here?"
            rows={3}
            target={35}
          />
        </div>
      ) : null}
    </li>
  )
}

// ─── One declared field ──────────────────────────────────────────────────────
// Rendered from the config rather than a switch on the kind, so a new field in
// lib/data/report-kinds.ts appears here with no edit at all.

function KindFieldInput({
  field, index, register, watch, setValue, memory,
}: {
  field: KindField
  index: number
  register: UseFormRegister<TripReportInput>
  watch: UseFormWatch<TripReportInput>
  setValue: UseFormSetValue<TripReportInput>
  memory: SessionMemory
}) {
  const leaf = `details.${field.key}`
  const raw = readItem(watch, index, leaf)

  if (field.type === 'bool') {
    return (
      <BoolField
        label={field.label}
        value={asBoolOrUndefined(raw)}
        onChange={(v) => writeItem(setValue, index, leaf, v === undefined ? '' : v)}
      />
    )
  }

  if (field.type === 'select' && field.options) {
    // `open` lists are suggestions; closed ones are a real <select>.
    if (field.open) {
      // Anything already typed into this field elsewhere in the report is
      // offered first: the sixth fuel stop should not mean typing "Indian Oil"
      // a sixth time.
      const seen = memory.recall(field.key)
      const options = [
        ...seen.map((v) => ({ value: v, hint: 'used earlier' })),
        ...field.options!.filter((o) => !seen.includes(o)).map((o) => ({ value: o })),
      ]
      return (
        <Field label={field.label} hint={field.help}>
          {(id) => (
            <Combobox
              id={id}
              value={asText(raw)}
              onChange={(v) => writeItem(setValue, index, leaf, v)}
              onCommit={(v) => memory.remember(field.key, v)}
              options={options}
              placeholder={field.placeholder ?? 'Type or pick one'}
            />
          )}
        </Field>
      )
    }
    return (
      <Field label={field.label} hint={field.help}>
        {(id) => (
          <select id={id} {...register(itemPath(index, leaf))} className={inputClass}>
            <option value="">—</option>
            {field.options!.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
      </Field>
    )
  }

  if (field.type === 'textarea') {
    return (
      <Field label={field.label} hint={field.help} className="sm:col-span-2">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            {...register(itemPath(index, leaf))}
            placeholder={field.placeholder}
            className={`${inputClass} resize-y`}
          />
        )}
      </Field>
    )
  }

  return (
    <Field label={field.unit ? `${field.label} (${field.unit})` : field.label} hint={field.help}>
      {(id) => (
        <input
          id={id}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          {...register(itemPath(index, leaf))}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
    </Field>
  )
}

function IconButton({
  children, label, onClick, disabled, danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-lg px-1.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'text-[var(--clay)] hover:bg-[var(--clay)]/10'
          : 'text-[var(--ink-soft)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]'
      }`}
    >
      {children}
    </button>
  )
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
