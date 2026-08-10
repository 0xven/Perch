import type { StayType } from './stays'

/**
 * A deterministic visual identity for a stay that has no photograph.
 *
 * Almost none of these 1,645 places have a usable picture. OpenStreetMap
 * rarely carries one for a small hill-town homestay, and the obvious
 * shortcut - lifting photos off Google Maps business listings - is not ours to
 * take: those images belong to the business or the person who uploaded them,
 * and re-hosting them would be infringement. The Wikimedia photos elsewhere on
 * this site are here precisely because their CC licences permit it, which is
 * why every one carries a credit line.
 *
 * So instead of a grey box or a fake stock photo, each stay gets a consistent
 * generated cover: a wash keyed to what KIND of place it is, a glyph, and a
 * monogram. Same stay, same cover, every time - derived from the id, so the
 * grid looks composed rather than broken, and nobody is misled into thinking
 * they are looking at the actual building.
 */

/** Per-type wash. Deliberately within the site palette rather than rainbow. */
const TYPE_WASH: Record<StayType, string> = {
  homestay:    'from-[#1C5240] via-[#25664F] to-[#143C2F]',
  guest_house: 'from-[#25664F] via-[#2F7A5E] to-[#1C5240]',
  hotel:       'from-[#1A3F55] via-[#245A76] to-[#132E3E]',
  resort:      'from-[#2B6F7A] via-[#357A5B] to-[#1C5240]',
  hostel:      'from-[#5A4A7A] via-[#6E5C93] to-[#3D3154]',
  apartment:   'from-[#4A4A5C] via-[#5E5E73] to-[#33333F]',
  chalet:      'from-[#7A5C3A] via-[#96723F] to-[#4F3B24]',
  motel:       'from-[#6B4A3A] via-[#8A5F49] to-[#452F25]',
}

const TYPE_GLYPH: Record<StayType, string> = {
  homestay: '🏡', guest_house: '🏠', hotel: '🏨', resort: '🌴',
  hostel: '🛏️', apartment: '🏢', chalet: '🛖', motel: '🚗',
}

/**
 * Small deterministic hash of the stay id, used only to vary the decorative
 * contour offset so neighbouring cards of the same type do not look stamped.
 */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export interface StayVisual {
  wash: string
  glyph: string
  monogram: string
  /** 0-3, picks one of the contour paths so cards of a type still differ. */
  variant: number
}

export function stayVisual(stay: { id: string; name: string; type: StayType }): StayVisual {
  // Monogram from the first two "real" words, so "The Nilgiri Lodge" -> NL.
  const words = stay.name
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^(the|a|an|of|at|in|and)$/i.test(w))
  const monogram = (words.slice(0, 2).map((w) => w[0]).join('') || stay.name[0] || '?').toUpperCase()

  return {
    wash: TYPE_WASH[stay.type] ?? TYPE_WASH.hotel,
    glyph: TYPE_GLYPH[stay.type] ?? TYPE_GLYPH.hotel,
    monogram,
    variant: hash(stay.id) % 4,
  }
}

/** Four contour paths, so a grid of the same stay type still has rhythm. */
export const CONTOUR_PATHS = [
  'M0 60 C60 30 120 80 200 45 S320 20 400 55',
  'M0 40 C80 70 140 20 220 60 S330 85 400 35',
  'M0 75 C70 45 130 95 210 55 S340 40 400 70',
  'M0 50 C50 85 130 35 200 75 S310 55 400 40',
] as const
