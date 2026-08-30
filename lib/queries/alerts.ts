// Natural-disaster alerts via GDACS (Global Disaster Alert and Coordination
// System) - a joint EU/UN service. Public-domain RSS, no key, no registration,
// no billing - same keyless philosophy as weather.ts and OpenFreeMap tiles.
// https://www.gdacs.org/

export type AlertLevel = 'alert' | 'caution'

export interface DisasterAlert {
  id: string
  title: string
  description: string
  type: string
  alertLevel: 'Orange' | 'Red'
  level: AlertLevel
  date: string // ISO
  url: string
}

const GDACS_RSS_URL = 'https://www.gdacs.org/xml/rss.xml'

/** South Asia + Himalaya bounding box: India, Nepal, Bhutan, Bangladesh,
 * Pakistan, Sri Lanka, and Myanmar all fall inside this rectangle. Loose on
 * purpose - GDACS gives a point, not a country, so a wide box beats a
 * country-name match against free-text titles. */
const BBOX = { latMin: 4, latMax: 38, lonMin: 60, lonMax: 101 }

const EVENT_TYPE_LABEL: Record<string, string> = {
  EQ: 'Earthquake',
  TC: 'Tropical cyclone',
  FL: 'Flood',
  DR: 'Drought',
  VO: 'Volcanic activity',
  WF: 'Wildfire',
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() : null
}

/**
 * Current watch-worthy disasters (GDACS Orange/Red only - Green is minor/no
 * impact and would be mostly noise) whose point falls inside the South
 * Asia + Himalaya bounding box, freshest first.
 *
 * Returns [] on any failure - a down upstream feed costs the banner, not the
 * page. Revalidates every 4 hours, which is how often this feed meaningfully
 * changes and keeps traffic trivial for a public-domain service.
 */
export async function getDisasterAlerts(): Promise<DisasterAlert[]> {
  try {
    const res = await fetch(GDACS_RSS_URL, {
      next: { revalidate: 14400 }, // 4 hours
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    })
    if (!res.ok) {
      console.error('[alerts] HTTP', res.status)
      return []
    }
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []

    const now = Date.now()
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

    return items
      .map((item): DisasterAlert | null => {
        const alertLevel = tag(item, 'gdacs:alertlevel')
        if (alertLevel !== 'Orange' && alertLevel !== 'Red') return null

        const lat = Number(tag(item, 'geo:lat'))
        const lon = Number(tag(item, 'geo:long'))
        if (
          !Number.isFinite(lat) || !Number.isFinite(lon) ||
          lat < BBOX.latMin || lat > BBOX.latMax ||
          lon < BBOX.lonMin || lon > BBOX.lonMax
        ) {
          return null
        }

        const title = tag(item, 'title')
        const link = tag(item, 'link')
        const pubDate = tag(item, 'pubDate')
        const eventType = tag(item, 'gdacs:eventtype') ?? ''
        const guid = tag(item, 'guid')
        if (!title || !link || !pubDate || !guid) return null

        const dateIso = new Date(pubDate).toISOString()
        const ageMs = now - new Date(dateIso).getTime()

        return {
          id: guid,
          title,
          description: tag(item, 'description') ?? '',
          type: EVENT_TYPE_LABEL[eventType] ?? 'Disaster',
          alertLevel,
          level: alertLevel === 'Red' || ageMs <= FOURTEEN_DAYS_MS ? 'alert' : 'caution',
          date: dateIso,
          url: link,
        }
      })
      .filter((a): a is DisasterAlert => a !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch (e) {
    console.error('[alerts] unexpected error:', e)
    return []
  }
}
