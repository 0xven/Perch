import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReportView } from '@/components/reports/report-view'
import { getDestination } from '@/lib/data/destinations'
import { getReportDetail } from '@/lib/queries/trip-reports'
import { absoluteUrl } from '@/lib/site'
import { PUBLIC_ID_RE } from '@/lib/validations/trip-report'

/**
 * A single report, by its shareable ID.
 *
 * DYNAMIC on purpose. This is the link the submitter is handed at the moment
 * they press send, and it has to work a second later - a cached or prerendered
 * page would tell them their own report does not exist. It is also the only
 * route that can show an UNAPPROVED report, which by definition cannot be known
 * at build time. See getReportDetail() and migration 006 for how that read is
 * narrowed to exactly one row.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>
}): Promise<Metadata> {
  const { publicId } = await params
  const detail = PUBLIC_ID_RE.test(publicId) ? await getReportDetail(publicId) : null

  if (!detail) return { title: 'Report not found', robots: { index: false, follow: false } }

  const { report } = detail
  const dest = report.destination_slug ? getDestination(report.destination_slug) : null
  const description =
    report.summary?.slice(0, 200) ??
    `A trip report${dest ? ` from ${dest.name}` : ''} with ${detail.items.length} first-hand notes.`

  return {
    title: report.title || `Trip report ${report.public_id}`,
    description,
    alternates: { canonical: `/report/${report.public_id}` },
    // An unapproved report is reachable by link but must never be indexed:
    // nothing has been read by a human yet.
    robots: report.published
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
  }
}

export default async function ReportPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params

  // Cheap shape check before touching the database - a public_id is a known
  // format, so anything else is a 404 without a round trip.
  if (!PUBLIC_ID_RE.test(publicId)) notFound()

  const detail = await getReportDetail(publicId)
  if (!detail) notFound()

  return <ReportView detail={detail} shareUrl={absoluteUrl(`/report/${detail.report.public_id}`)} />
}
