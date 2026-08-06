import type { Path, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import type { TripReportInput } from '@/lib/validations/trip-report'

/**
 * Typed access to a field inside the `items` array.
 *
 * react-hook-form derives its path union from the form's type, and this form's
 * items carry a `details` record whose keys come from lib/data/report-kinds.ts
 * at runtime - so `items.3.details.download_mbps` is a perfectly real path that
 * no static type can enumerate. Rather than sprinkle casts through the JSX, the
 * cast lives here, once, behind three functions.
 *
 * RHF resolves these paths correctly at runtime; only the compiler needs the
 * help. Nothing else in the form casts.
 */
export function itemPath(index: number, leaf: string): Path<TripReportInput> {
  return `items.${index}.${leaf}` as Path<TripReportInput>
}

export function readItem(
  watch: UseFormWatch<TripReportInput>,
  index: number,
  leaf: string,
): unknown {
  return watch(itemPath(index, leaf))
}

/**
 * Write one field of one item.
 *
 * Numbers are stringified on the way in. Every text-ish field in this form is a
 * STRING on the input side by design (see lib/validations/trip-report.ts - HTML
 * controls only ever produce strings, so the schema's input type says string),
 * and the places that write programmatically rather than through an input -
 * autofilled coordinates, the star rating - are the only ones that would ever
 * hand over a real number and quietly fail validation four cards down.
 * Booleans pass through untouched: the yes/no control genuinely stores those.
 */
export function writeItem(
  setValue: UseFormSetValue<TripReportInput>,
  index: number,
  leaf: string,
  value: unknown,
): void {
  const normalised = typeof value === 'number' ? String(value) : value
  setValue(itemPath(index, leaf) as never, normalised as never, { shouldDirty: true })
}

/** `watch` gives back `unknown` through the cast above; these narrow it safely. */
export function asText(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

export function asNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function asBoolOrUndefined(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}
