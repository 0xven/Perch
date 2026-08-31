'use client'

import { useEffect, useRef, useState } from 'react'

export interface Stat {
  value: number
  /** Rendered after the counted number, e.g. "+" or " m". */
  suffix?: string
  label: string
  sub: string
  accent?: boolean
}

/**
 * Counts from 0 to `value` once, the first time the row scrolls into view.
 *
 * Starts AT the final value and only rewinds to 0 after the observer is
 * confirmed to be running, so a visitor with JS disabled (or one who never
 * scrolls this far) reads the real number rather than a permanent zero.
 * prefers-reduced-motion skips the animation entirely.
 */
function useCountUp(value: number, start: boolean, durationMs = 1100): number {
  const [n, setN] = useState(value)
  const done = useRef(false)

  useEffect(() => {
    if (!start || done.current) return
    done.current = true

    // State already holds `value`, so the reduced-motion path is simply
    // "leave it alone" - no setState needed, and nothing animates.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / durationMs, 1)
      // easeOutExpo - fast out of the gate, settles gently on the real figure
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      setN(Math.round(value * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    // The first frame lands at p≈0, so the count starts from zero without a
    // synchronous setState in the effect body.
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [start, value, durationMs])

  return n
}

function StatCell({ stat, start }: { stat: Stat; start: boolean }) {
  const n = useCountUp(stat.value, start)
  return (
    <div className="flex-1 px-4 py-5 text-center sm:px-6">
      {/* Flex + baseline rather than vertical-align: the suffix stays welded
          to the number on one line at every clamp size, which `align-top`
          inside a wrapping <p> did not. */}
      <p
        className={`disp m-0 flex items-baseline justify-center gap-[0.08em] text-[clamp(30px,4.6vw,46px)] leading-none tabular-nums ${
          stat.accent ? 'text-[#E0A93B]' : 'text-[#F3EFE6]'
        }`}
      >
        <span>{n.toLocaleString('en-IN')}</span>
        {stat.suffix && <span className="text-[0.55em] font-normal">{stat.suffix}</span>}
      </p>
      <p className="mono mt-2 text-[10.5px] uppercase tracking-[0.15em] text-[#7FB89C]">
        {stat.label}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-[rgba(233,228,218,0.45)]">{stat.sub}</p>
    </div>
  )
}

/**
 * The proof band: what the catalogue actually contains, counted up on first
 * view. Every figure is derived from the real data at build time by the
 * caller - nothing here is a marketing round number.
 */
export function Scoreboard({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  return (
    <div
      ref={ref}
      className="flex flex-wrap divide-y divide-[rgba(127,184,156,0.14)] overflow-hidden rounded-[18px] border border-[rgba(127,184,156,0.16)] bg-[rgba(9,22,17,0.55)] sm:divide-x sm:divide-y-0"
    >
      {stats.map((s) => (
        <div key={s.label} className="min-w-[45%] grow basis-0 sm:min-w-0">
          <StatCell stat={s} start={seen} />
        </div>
      ))}
    </div>
  )
}
