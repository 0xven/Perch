import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { DESTINATIONS } from '@/lib/data/destinations'
import { getPublishedReports } from '@/lib/queries/trip-reports'

/**
 * Sitemap covering the static routes, every statically-generated destination
 * page, and every APPROVED trip report. Regenerates automatically as the
 * catalogue and the community layer grow.
 *
 * Async because of that last part. getPublishedReports() only ever returns
 * published rows and returns [] on any failure, so an unapproved report can
 * never end up here and a Supabase outage costs the report URLs, not the file.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/destinations`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/reports`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/stays`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/charging`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/journeys`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const destinationRoutes: MetadataRoute.Sitemap = DESTINATIONS.map((d) => ({
    url: `${SITE_URL}/destinations/${d.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const reportRoutes: MetadataRoute.Sitemap = (await getPublishedReports()).map((r) => ({
    url: `${SITE_URL}/report/${r.public_id}`,
    lastModified: new Date(r.created_at),
    changeFrequency: 'yearly',
    priority: 0.5,
  }))

  return [...staticRoutes, ...destinationRoutes, ...reportRoutes]
}
