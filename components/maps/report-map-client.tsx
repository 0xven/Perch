'use client'

import dynamic from 'next/dynamic'
import type { ReportPoint } from './route-map'

// Defer the MapLibre bundle (~200KB) until this client wrapper renders, exactly
// as destination-pin-map-client.tsx does.
const ReportPointsMap = dynamic(
  () => import('./route-map').then((mod) => mod.ReportPointsMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[var(--paper-deep)]" />,
  },
)

export function ReportMapClient({ points }: { points: ReportPoint[] }) {
  if (points.length === 0) return null
  return (
    <div className="h-[320px] overflow-hidden rounded-2xl border border-[var(--line)]">
      <ReportPointsMap points={points} />
    </div>
  )
}
