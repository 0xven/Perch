'use client'

import dynamic from 'next/dynamic'

// Defer the MapLibre bundle (~200KB) until this client wrapper renders.
const DestinationPinMap = dynamic(
  () => import('./route-map').then((mod) => mod.DestinationPinMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[var(--paper-deep)]" />,
  },
)

interface Props {
  lat: number
  lng: number
  label?: string
  /** Tailwind height classes. Defaults to the compact size used in side rails. */
  heightClass?: string
}

export function DestinationPinMapClient({
  lat,
  lng,
  label,
  heightClass = 'h-[240px]',
}: Props) {
  return (
    <div className={`${heightClass} overflow-hidden rounded-2xl border border-white/15`}>
      <DestinationPinMap lat={lat} lng={lng} label={label} />
    </div>
  )
}
