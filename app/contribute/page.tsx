import Link from 'next/link'
import { TripReportForm } from '@/components/contribute/trip-report-form'
import { KIND_GROUPS, REPORT_KINDS } from '@/lib/data/report-kinds'

export const metadata = {
  title: 'Write a trip report',
  description:
    'Anything and everything you found on the road - stays, WiFi, which SIM worked, petrol bunks, service centres, viewpoints. No account needed.',
}

export default async function ContributePage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string }>
}) {
  const { destination: prefillSlug } = await searchParams

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
          Contribute
        </p>
        <h1 className="font-display text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          Write a trip report
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          Not a review site. A record of what was actually there: the homestay with no sign, the
          bunk that was shut, the network that had signal at the pass, the mechanic who did not
          overcharge you. Fill in as much or as little as you like - there are{' '}
          <strong className="text-[var(--ink)]">{REPORT_KINDS.length} kinds of thing</strong> you
          can add and not one of them is required.
        </p>
        <p className="text-xs text-[var(--ink-soft)]">
          No account, no sign-in. You get a unique ID and a shareable link the moment you send it ·{' '}
          <Link href="/reports" className="underline hover:text-[var(--ink)]">
            read what others have left
          </Link>
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {KIND_GROUPS.map((g) => (
            <span
              key={g.id}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)]"
            >
              {g.label}
            </span>
          ))}
        </div>
      </header>

      <div className="mt-8">
        <TripReportForm prefillSlug={prefillSlug} />
      </div>
    </div>
  )
}
