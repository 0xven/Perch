import type { DestinationCategory } from './destinations'

/**
 * A simple derived "climate type" label for filtering, computed from elevation
 * and category - not a sourced/fabricated per-place field. This is a heuristic,
 * not a scientific Köppen classification: it exists so a visitor can filter
 * "Alpine" vs "Tropical" without the catalogue needing a new hand-curated
 * column for all 97 entries.
 */
export type ClimateType = 'alpine' | 'temperate' | 'subtropical' | 'tropical'

export const CLIMATE_TYPE_LABEL: Record<ClimateType, string> = {
  alpine: 'Alpine (high Himalaya/Ladakh)',
  temperate: 'Temperate hill',
  subtropical: 'Subtropical hill',
  tropical: 'Tropical / coastal',
}

export function climateType(elevationM: number, category: DestinationCategory): ClimateType {
  if (category === 'coastal') return 'tropical'
  if (elevationM >= 3000) return 'alpine'
  if (elevationM >= 1500) return 'temperate'
  if (elevationM >= 800) return 'subtropical'
  return 'tropical'
}

export const CLIMATE_TYPES: ClimateType[] = ['alpine', 'temperate', 'subtropical', 'tropical']
