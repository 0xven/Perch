'use client'

import { useVisitor } from './visitor-context'

/**
 * The hero's eyebrow line.
 *
 * It leads with an altitude, and that altitude has to agree with the dial sitting
 * next to it - otherwise the page shouts "ALT 5,091 M" while the instrument
 * beside it reads 12 m, and the whole conceit falls apart. So the figure is the
 * reference high point until the visitor tells us where they are, and theirs
 * afterwards.
 */
export function HeroBadge({
  referenceAltitude,
  children,
}: {
  referenceAltitude: number
  /** The rest of the badge - the catalogue-count line, server-rendered. */
  children: React.ReactNode
}) {
  const { place } = useVisitor()
  const altitude = place?.elevationM ?? referenceAltitude

  return (
    <p className="rise mono m-0 inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] text-[#7FB89C]">
      <span className="pulse-dot h-[5px] w-[5px] rounded-full bg-[#E0A93B]" />
      ALT {altitude.toLocaleString()} M · {children}
    </p>
  )
}
