import { z } from 'zod'
import { KIND_IDS, TRANSPORT_MODE_IDS } from '@/lib/data/report-kinds'

// ─── Public report ID ────────────────────────────────────────────────────────

/**
 * No 0/O/1/I/L. The ID gets read off a screen, written on the back of a hand,
 * and typed back in by someone who has just got off a bike, so the characters
 * that look like each other are simply not in the alphabet.
 */
const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const ID_LENGTH = 6

/** Matches the CHECK constraint in supabase/migrations/006_trip_reports.sql. */
export const PUBLIC_ID_RE = /^PERCH-[A-Z0-9]{6}$/

/**
 * A fresh public report ID, e.g. PERCH-7K2M9A.
 *
 * Generated here rather than by a DB sequence on purpose: PERCH-000001 would
 * let anyone walk the whole table, including every unapproved draft, since a
 * draft is readable by anyone holding its ID. 31^6 is ~887 million - not a
 * secret, but far too sparse to enumerate, and the ID is one of a PAIR with the
 * moderation queue rather than the only thing between a draft and the public
 * listing.
 *
 * crypto.getRandomValues, not Math.random - this is the unguessable part.
 */
export function newPublicId(): string {
  const bytes = new Uint32Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < ID_LENGTH; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length]
  return `PERCH-${out}`
}

// ─── Photos ──────────────────────────────────────────────────────────────────
// These numbers are duplicated in the bucket definition in migration 006
// (file_size_limit + allowed_mime_types). The bucket's copy is the one that
// enforces; this copy exists so the traveller gets a sentence instead of a 400.

export const REPORT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const REPORT_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const REPORT_PHOTO_MAX_COUNT = 6

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type PhotoCheck = { ok: true; ext: string; type: string } | { ok: false; error: string }

export function checkReportPhoto(file: File): PhotoCheck {
  if (!file || file.size === 0) return { ok: false, error: 'That file looks empty.' }

  if (file.size > REPORT_PHOTO_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return { ok: false, error: `${file.name} is ${mb}MB - the limit is 5MB per photo.` }
  }

  const type = file.type.toLowerCase()
  if (!(REPORT_PHOTO_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: `${file.name} is not a JPEG, PNG or WebP.` }
  }

  return { ok: true, ext: EXT_BY_TYPE[type], type }
}

// ─── Form schemas ────────────────────────────────────────────────────────────
//
// EVERY input field is a STRING on the way in and a typed value on the way out.
// That is deliberate: HTML form controls only ever produce strings, so a schema
// whose input type is `string` is a schema whose input type is the truth. It
// also keeps react-hook-form's inferred path/value types honest - z.preprocess
// would widen half this object to `unknown` and push casts into the JSX.
//
// Blank means "not answered", never "no" or "zero", so every optional field
// transforms '' to undefined rather than to a value.

const emptyToUndefined = <T,>(v: T | '' | undefined): T | undefined =>
  v === '' || v === undefined ? undefined : v

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform(emptyToUndefined)

/** A numeric text field: still a string in the form, a number in the payload. */
const optionalNumber = (opts: { min?: number; max?: number; int?: boolean; label: string }) =>
  z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true
        const n = Number(v)
        if (!Number.isFinite(n)) return false
        if (opts.int && !Number.isInteger(n)) return false
        if (opts.min !== undefined && n < opts.min) return false
        if (opts.max !== undefined && n > opts.max) return false
        return true
      },
      { message: `${opts.label} does not look right` },
    )
    .transform((v) => (v ? Number(v) : undefined))

const optionalEnum = (allowed: readonly string[], message: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || allowed.includes(v), { message })
    .transform(emptyToUndefined)

/**
 * A kind-specific answer. jsonb takes anything, so the guard is on the SHAPE -
 * flat, scalar, bounded - rather than on the keys, which come from
 * lib/data/report-kinds.ts and change every time a kind gains a field.
 * Booleans are here because the yes/no control emits real booleans; numbers are
 * converted at insert time from the kind config, so the wire format stays text.
 */
const detailValue = z.union([z.string().max(600), z.boolean()])

export const reportItemSchema = z.object({
  kind: z.string().refine((v) => KIND_IDS.includes(v), 'Pick what kind of thing this is'),
  name: optionalText(200),
  area: optionalText(160),
  lat: optionalNumber({ min: -90, max: 90, label: 'Latitude' }),
  lng: optionalNumber({ min: -180, max: 180, label: 'Longitude' }),
  rating: optionalNumber({ min: 1, max: 5, int: true, label: 'Rating' }),
  cost_inr: optionalNumber({ min: 0, max: 99_999_999, label: 'Cost' }),
  notes: optionalText(6000),
  details: z.record(z.string(), detailValue),
})

export const tripReportSchema = z.object({
  title: z.string().trim().min(4, 'Give the report a title - even a rough one').max(200),
  destination_slug: optionalText(80),
  origin_name: optionalText(120),
  trip_date: optionalText(20),
  transport_mode: optionalEnum(TRANSPORT_MODE_IDS, 'Pick how you travelled'),
  vehicle: optionalText(120),
  days: optionalNumber({ min: 1, max: 365, int: true, label: 'Number of days' }),
  travellers: optionalNumber({ min: 1, max: 60, int: true, label: 'Number of travellers' }),
  total_cost_inr: optionalNumber({ min: 0, max: 99_999_999, label: 'Total spend' }),
  summary: optionalText(6000),
  author_name: optionalText(80),
  // Optional, admin-only, and the form says exactly that. Never rendered on a
  // public page - the database will not even hand it to an anonymous reader.
  contact_email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'That does not look like an email')
    .transform(emptyToUndefined),
  items: z.array(reportItemSchema).max(80, 'That is a lot - consider splitting it into two reports'),
})

export type TripReportInput = z.input<typeof tripReportSchema>
export type TripReportData = z.output<typeof tripReportSchema>
export type ReportItemInput = z.input<typeof reportItemSchema>
export type ReportItemData = z.output<typeof reportItemSchema>

/** A blank item of a given kind, for the "add item" buttons. */
export function emptyItem(kind: string): ReportItemInput {
  return { kind, name: '', area: '', lat: '', lng: '', rating: '', cost_inr: '', notes: '', details: {} }
}

/** A blank report, for a first visit and for clearing a restored draft. */
export function emptyReport(destinationSlug?: string): TripReportInput {
  return {
    title: '',
    destination_slug: destinationSlug ?? '',
    origin_name: '',
    trip_date: '',
    transport_mode: '',
    vehicle: '',
    days: '',
    travellers: '',
    total_cost_inr: '',
    summary: '',
    author_name: '',
    contact_email: '',
    items: [],
  }
}
