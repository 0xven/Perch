import { fieldLabel, fieldUnit, getKind, transportLabel } from './report-kinds'
import { getDestination } from './destinations'

/**
 * A trip report as plain Markdown, built in the browser from a Blob.
 *
 * No server round trip and no PDF library: the traveller asked for "a copy of
 * what I submitted", and a text file they can read in twenty years on anything
 * beats a 300KB dependency that renders a logo. It is also the honest artefact
 * to hand someone when we are explicitly NOT emailing them a copy.
 */

export interface ReportTextItem {
  kind: string
  name?: string | null
  area?: string | null
  lat?: number | null
  lng?: number | null
  rating?: number | null
  cost_inr?: number | null
  notes?: string | null
  details?: Record<string, string | number | boolean> | null
}

export interface ReportTextInput {
  publicId: string
  title?: string | null
  destinationSlug?: string | null
  originName?: string | null
  tripDate?: string | null
  transportMode?: string | null
  vehicle?: string | null
  days?: number | null
  travellers?: number | null
  totalCostInr?: number | null
  summary?: string | null
  authorName?: string | null
  items: ReportTextItem[]
  media: { url: string; caption?: string | null }[]
  /** Absolute URL of the shareable page, when we know the origin. */
  shareUrl?: string
}

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return `- **${label}:** ${value}`
}

/** "₹1,200" but "45 Mbps" - currency leads, everything else trails. */
export function withUnit(value: string | number, unit?: string): string {
  if (!unit) return String(value)
  return unit === '₹' ? `₹${value}` : `${value} ${unit}`
}

export function reportToMarkdown(input: ReportTextInput): string {
  const dest = input.destinationSlug ? getDestination(input.destinationSlug) : null

  const head = [
    `# ${input.title?.trim() || 'Trip report'}`,
    '',
    `**Report ID: ${input.publicId}**`,
    input.shareUrl ? `Shareable link: ${input.shareUrl}` : null,
    '',
    line('Destination', dest ? `${dest.name}, ${dest.state}` : input.destinationSlug),
    line('Starting from', input.originName),
    line('Date', input.tripDate),
    line('Travelled by', transportLabel(input.transportMode ?? null)),
    line('Vehicle', input.vehicle),
    line('Days', input.days),
    line('Travellers', input.travellers),
    line('Total spend', input.totalCostInr != null ? `₹${input.totalCostInr}` : null),
    line('Written by', input.authorName),
  ].filter(Boolean)

  const summary = input.summary?.trim()
    ? ['', '## The trip', '', input.summary.trim()]
    : []

  const items: string[] = []
  if (input.items.length > 0) {
    items.push('', `## What I found (${input.items.length})`, '')
    input.items.forEach((it, n) => {
      const kind = getKind(it.kind)
      items.push(`### ${n + 1}. ${kind.icon} ${kind.label}${it.name ? ` - ${it.name}` : ''}`)
      const rows = [
        line('Where', it.area),
        line('Coordinates', it.lat != null && it.lng != null ? `${it.lat}, ${it.lng}` : null),
        line('Rating', it.rating != null ? `${'★'.repeat(it.rating)} (${it.rating}/5)` : null),
        line('Cost', it.cost_inr != null ? `₹${it.cost_inr}` : null),
      ].filter(Boolean)

      for (const [key, value] of Object.entries(it.details ?? {})) {
        if (value === '' || value === null || value === undefined) continue
        const shown =
          typeof value === 'boolean'
            ? value ? 'Yes' : 'No'
            : withUnit(value, fieldUnit(it.kind, key))
        rows.push(`- **${fieldLabel(it.kind, key)}:** ${shown}`)
      }

      items.push(...(rows as string[]))
      if (it.notes?.trim()) items.push('', it.notes.trim())
      items.push('')
    })
  }

  const media = input.media.length > 0
    ? ['', `## Photos (${input.media.length})`, '', ...input.media.map((m, n) => `${n + 1}. ${m.caption?.trim() || 'Photo'} - ${m.url}`)]
    : []

  const foot = [
    '',
    '---',
    '',
    'Submitted to Perch. Keep this ID safe - it is how you find this report again.',
    'We do not email or text a copy: this file is your copy.',
  ]

  return [...head, ...summary, ...items, ...media, ...foot].join('\n')
}

/** Trigger a browser download of the markdown. Client-side only. */
export function downloadReportMarkdown(input: ReportTextInput): void {
  const blob = new Blob([reportToMarkdown(input)], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${input.publicId}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick - Safari needs the URL to still be live at click time.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
