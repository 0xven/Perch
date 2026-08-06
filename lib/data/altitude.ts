/**
 * Altitude physics.
 *
 * These are real formulae, not decorative numbers. The homepage shows a
 * visitor their own oxygen availability once they tell us where they are, and
 * "roughly right" is not good enough for something people use to judge whether
 * a 5,000 m pass is a sensible idea.
 */

/**
 * Oxygen availability at an altitude, as a percentage of sea level.
 *
 * The barometric formula for the troposphere (ISA): pressure falls to
 * (1 - 2.25577e-5 * h)^5.25588 of sea-level pressure at h metres. The FRACTION
 * of oxygen in air stays ~20.9% all the way up - what actually changes is the
 * partial pressure, which is what your lungs care about - so the pressure ratio
 * IS the "percent oxygen vs sea level" people mean.
 *
 * Sanity: 3,500 m (Leh) -> 65%, 5,091 m (Shinku La) -> 53%. Both match the
 * published figures.
 */
export function oxygenPercentAt(altitudeM: number): number {
  if (altitudeM <= 0) return 100
  const ratio = Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588)
  return Math.round(ratio * 100)
}

/**
 * The honest one-line read on what an altitude does to a body.
 *
 * Thresholds follow the usual mountain-medicine guidance: AMS is essentially
 * unheard of below ~2,000 m, becomes a real consideration above ~2,500 m, and
 * above ~3,500 m acclimatisation stops being optional.
 */
export function altitudeAdvice(altitudeM: number): { label: string; tone: 'calm' | 'watch' | 'care' } {
  if (altitudeM >= 4500) return { label: 'Extreme altitude - acclimatise for days, not hours', tone: 'care' }
  if (altitudeM >= 3500) return { label: 'Very high - plan acclimatisation days', tone: 'care' }
  if (altitudeM >= 2500) return { label: 'High enough that AMS is a real risk', tone: 'watch' }
  if (altitudeM >= 1500) return { label: 'Comfortable hill altitude', tone: 'calm' }
  return { label: 'Low altitude', tone: 'calm' }
}

/** Standard atmosphere temperature lapse: ~6.5°C cooler per 1,000 m climbed. */
export const LAPSE_RATE_C_PER_KM = 6.5
