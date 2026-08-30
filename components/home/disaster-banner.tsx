import Link from 'next/link'
import type { DisasterAlert } from '@/lib/queries/alerts'

/**
 * A slim strip above the fold naming the single freshest watch-worthy
 * disaster in the region, with a count and a link to the full list. Renders
 * nothing when there is nothing current - this is a warning, not decoration,
 * so an empty state must not show a placeholder banner.
 */
export function DisasterBanner({ alerts }: { alerts: DisasterAlert[] }) {
  if (alerts.length === 0) return null

  const top = alerts[0]
  const isRed = top.alertLevel === 'Red'

  return (
    <Link
      href="/alerts"
      className={`group flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-5 py-2.5 text-center text-[13px] transition-colors ${
        isRed
          ? 'border-[rgba(224,90,59,0.35)] bg-[rgba(224,90,59,0.12)] text-[#F3D9CF] hover:bg-[rgba(224,90,59,0.18)]'
          : 'border-[rgba(224,169,59,0.3)] bg-[rgba(224,169,59,0.1)] text-[#F3E4C7] hover:bg-[rgba(224,169,59,0.16)]'
      }`}
    >
      <span className={`mono text-[10px] font-semibold uppercase tracking-[0.14em] ${isRed ? 'text-[#E05A3B]' : 'text-[#E0A93B]'}`}>
        {isRed ? '⚠ Alert' : '⚠ Caution'}
      </span>
      <span className="max-w-[560px] truncate">{top.title}</span>
      <span className="mono text-[11px] underline decoration-dotted underline-offset-2 group-hover:decoration-solid">
        {alerts.length > 1 ? `See all ${alerts.length} alerts →` : 'Details →'}
      </span>
    </Link>
  )
}
