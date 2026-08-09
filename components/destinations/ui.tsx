import Link from 'next/link'
import type { WorkSpot, Accommodation } from '@/lib/types/database'

// Shared presentational pieces for the destination page tabs. Server-renderable
// (no client hooks); extracted so each tab panel component can reuse them.

export const WIFI_LABEL = ['', 'Poor', 'Weak', 'OK', 'Good', 'Excellent']

const OUTLET_LABEL: Record<string, string> = {
  plenty: 'Many outlets', some: 'Some outlets', few: 'Few outlets', none: 'No outlets',
}
const NOISE_LABEL: Record<string, string> = {
  quiet: 'Quiet', moderate: 'Moderate noise', noisy: 'Noisy',
}

// `Fact` lived here - a label/value row used only by the Overview tab's old
// right-hand rail. GlanceStrip replaced that rail with four instrument tiles,
// leaving this with no callers, so it is gone rather than left to rot.

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="font-display text-2xl text-[var(--ink)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{label}</p>
    </div>
  )
}

export function WorkSpotCard({ spot }: { spot: WorkSpot }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[var(--ink)]">{spot.name}</p>
          <p className="text-xs capitalize text-[var(--ink-soft)]">{spot.type?.replace('_', ' ') ?? 'spot'}</p>
        </div>
        {spot.wifi_rating && (
          <span className="rounded-lg bg-[var(--brand)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
            WiFi: {WIFI_LABEL[spot.wifi_rating]}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {spot.power_outlets && <Badge>{OUTLET_LABEL[spot.power_outlets]}</Badge>}
        {spot.noise_level && <Badge>{NOISE_LABEL[spot.noise_level]}</Badge>}
      </div>
      {spot.price_notes && <p className="text-xs text-[var(--ink-soft)]">{spot.price_notes}</p>}
    </div>
  )
}

export function StayCard({ stay }: { stay: Accommodation }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[var(--ink)]">{stay.name}</p>
          <p className="text-xs capitalize text-[var(--ink-soft)]">
            {stay.type?.replace('_', ' ') ?? 'accommodation'}{stay.price_range_inr && ` · ₹${stay.price_range_inr}/night`}
          </p>
        </div>
        {stay.wifi_rating && (
          <span className="rounded-lg bg-[var(--brand)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
            WiFi: {WIFI_LABEL[stay.wifi_rating]}
          </span>
        )}
      </div>
      {stay.wifi_notes && <p className="text-xs text-[var(--ink-soft)]">{stay.wifi_notes}</p>}
      {stay.has_backup_power && <Badge className="border-[var(--clay)]/30 bg-[var(--clay)]/12 text-[var(--clay)]">⚡ Backup power</Badge>}
    </div>
  )
}

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--ink-soft)] ${className}`}>{children}</span>
}

export function EmptyState({ icon, title, text, slug, cta }: { icon: string; title: string; text: string; slug: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] p-10 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="mt-3 font-semibold text-[var(--ink)]">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--ink-soft)]">{text}</p>
      <Link href={`/contribute?destination=${slug}`} className="btn-primary mt-4 text-sm">{cta}</Link>
    </div>
  )
}
