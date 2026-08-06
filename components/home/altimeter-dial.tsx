'use client'

import { oxygenPercentAt } from '@/lib/data/altitude'
import { useVisitor } from './visitor-context'

/**
 * The hero's altimeter.
 *
 * Two states, and the difference matters:
 *
 *   IDLE - the needle sweeps and the readout shows a REFERENCE altitude (the
 *   high point of the Kashmir circuit). It is labelled as such, because a
 *   number on a dial that isn't yours is decoration.
 *
 *   READY - once the visitor has told us where they are, every number on the
 *   dial is theirs: real ground elevation from Open-Meteo, real oxygen
 *   availability from the barometric formula, real current temperature. The
 *   sweep animation stops and the needle points at their actual altitude on the
 *   scale, because now it means something.
 *
 * There is deliberately no fake jitter. An earlier version wobbled the altitude
 * with a sine wave to look "live"; that was decoration pretending to be
 * telemetry, which is exactly what this page is supposed to be the opposite of.
 */

interface Tick {
  x1: number
  y1: number
  x2: number
  y2: number
  major: boolean
}

const CX = 200
const CY = 200

/** The dial covers 0 -> 6,000 m over a full turn; labels sit every 1,500 m. */
const DIAL_RANGE_M = 6000

function buildTicks(): Tick[] {
  return Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2
    const major = i % 4 === 0
    const r1 = major ? 148 : 154
    const r2 = 162
    return {
      x1: +(CX + r1 * Math.cos(a)).toFixed(1),
      y1: +(CY + r1 * Math.sin(a)).toFixed(1),
      x2: +(CX + r2 * Math.cos(a)).toFixed(1),
      y2: +(CY + r2 * Math.sin(a)).toFixed(1),
      major,
    }
  })
}

function buildLabels(): { x: number; y: number; t: string }[] {
  return [0, 1500, 3000, 4500].map((m, i) => {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2
    return { x: Math.round(CX + 134 * Math.cos(a)), y: Math.round(CY + 134 * Math.sin(a)) + 3, t: `${m}` }
  })
}

// Fixed geometry - no props or state feed it, so it is computed once at module
// load rather than memoised on every render.
const TICKS = buildTicks()
const LABELS = buildLabels()

export function AltimeterDial({
  referenceAltitude,
  referenceLabel,
}: {
  /** Shown until the visitor shares a location - e.g. the Kashmir circuit's high point. */
  referenceAltitude: number
  referenceLabel: string
}) {
  const { place, status } = useVisitor()

  const isPersonal = place?.elevationM != null
  const altitude = isPersonal ? place.elevationM! : referenceAltitude
  const oxygen = oxygenPercentAt(altitude)

  // Clamped so a Himalayan pass past the top of the scale still parks the
  // needle at the ceiling instead of wrapping around to look like sea level.
  const needleDeg = (Math.min(altitude, DIAL_RANGE_M) / DIAL_RANGE_M) * 360

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[400px]">
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <circle cx="200" cy="200" r="192" fill="none" stroke="rgba(233,228,218,0.08)" strokeWidth="1" />
        <g className="dial-ring" style={{ transformOrigin: '200px 200px' }}>
          <circle cx="200" cy="200" r="176" fill="none" stroke="rgba(127,184,156,0.3)" strokeWidth="1" strokeDasharray="1 6" />
        </g>
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.major ? 'rgba(233,228,218,0.4)' : 'rgba(233,228,218,0.16)'}
            strokeWidth={t.major ? 1.4 : 1}
          />
        ))}
        {LABELS.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            fontSize="9.5"
            className="mono"
            fill="rgba(233,228,218,0.4)"
          >
            {l.t}
          </text>
        ))}
        <circle cx="200" cy="200" r="118" fill="rgba(233,228,218,0.03)" stroke="rgba(233,228,218,0.1)" strokeWidth="1" />

        {/* Idle: the shared sweep keyframe. Personal: a real bearing, eased into
            place once, so the movement itself reads as "it found you". */}
        <g
          className={isPersonal ? undefined : 'dial-needle'}
          style={
            isPersonal
              ? {
                  transformOrigin: '200px 200px',
                  transform: `rotate(${needleDeg}deg)`,
                  transition: 'transform 1.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }
              : { transformOrigin: '200px 200px' }
          }
        >
          <line x1="200" y1="200" x2="200" y2="96" stroke="#E0A93B" strokeWidth="2" strokeLinecap="round" />
          <circle cx="200" cy="200" r="5" fill="#E0A93B" />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <p className="mono mt-[88px] text-[10px] uppercase tracking-[0.18em] text-[rgba(233,228,218,0.45)]">
          {isPersonal ? 'Your altitude' : 'Altimeter'}
        </p>
        <p className="disp mt-0.5 text-[44px] leading-none text-[#F3EFE6]">
          {status === 'locating' && !isPersonal ? (
            <span className="text-[26px] text-[rgba(233,228,218,0.6)]">Locating…</span>
          ) : (
            <>
              {altitude.toLocaleString()}
              <span className="text-[19px] text-[rgba(233,228,218,0.5)]"> m</span>
            </>
          )}
        </p>
        <p className="mono mt-1 text-[11px] text-[#7FB89C]">
          O₂ {oxygen}%{place?.tempC != null ? ` · ${place.tempC}°C` : ''}
        </p>
        <p className="mono mt-1 max-w-[190px] text-[9.5px] uppercase leading-relaxed tracking-[0.1em] text-[rgba(233,228,218,0.35)]">
          {isPersonal ? place!.label : referenceLabel}
        </p>
      </div>
    </div>
  )
}
