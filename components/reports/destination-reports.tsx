import Link from 'next/link'
import { getKind, kindLabel, transportIcon, transportLabel } from '@/lib/data/report-kinds'
import { getReportsForDestination } from '@/lib/queries/trip-reports'

/**
 * The community reports filed against one destination.
 *
 * A server component reading the same unstable_cache'd query as /reports, so it
 * adds no dynamic signal and the destination page stays prerendered. It renders
 * nothing at all when there are none - an empty "no reports yet" panel on 97
 * pages is worse than silence.
 */
export async function DestinationReports({ slug, name }: { slug: string; name: string }) {
  const reports = await getReportsForDestination(slug, 4)
  if (reports.length === 0) return null

  return (
    <section className="mt-10 space-y-3 border-t border-[var(--line)] pt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl tracking-tight text-[var(--ink)]">
            Trip reports from {name}
          </h2>
          <p className="text-sm text-[var(--ink-soft)]">
            First-hand, from people who went. Not checked by us.
          </p>
        </div>
        <Link href="/reports" className="text-sm font-medium text-[var(--brand)] underline">
          All reports →
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <li key={r.id}>
            <Link href={`/report/${r.public_id}`} className="card card-hover block h-full p-4">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-soft)]">
                {r.transport_mode ? (
                  <span>
                    <span aria-hidden>{transportIcon(r.transport_mode)}</span>{' '}
                    {transportLabel(r.transport_mode)}
                  </span>
                ) : null}
                {r.days ? <span>· {r.days} days</span> : null}
                <span className="font-mono text-[var(--brand)]">· {r.public_id}</span>
              </div>
              <h3 className="mt-1 font-display text-lg leading-snug text-[var(--ink)]">
                {r.title || 'Trip report'}
              </h3>
              {r.summary ? (
                <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">{r.summary}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {r.kinds.slice(0, 8).map((k) => (
                  <span key={k} title={kindLabel(k)} aria-label={kindLabel(k)} className="text-sm">
                    {getKind(k).icon}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
