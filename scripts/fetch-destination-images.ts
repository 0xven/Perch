/**
 * Build-time destination image fetcher + self-hoster (NATURE-biased).
 *
 * For each destination it searches Wikimedia Commons (keyless MediaWiki API, $0)
 * for candidate photos, SCORES them toward nature/wildlife and AWAY from towns,
 * buildings, streets and maps, picks the best, then DOWNLOADS it (re-encoded with
 * sharp to a lean ~1920px JPEG) into public/dest-images/<slug>.jpg. Serving from
 * our own origin means next/image never calls Wikimedia at runtime (no 429 bursts
 * when a grid loads, faster paints) while staying $0.
 *
 * Search seeds come from each destination's own `highlights` (e.g. "Pillar Rocks",
 * "Catherine Falls", "Eravikulam National Park") plus nature/wildlife terms, so
 * the picks are scenic landscapes/forests/animals rather than cityscapes.
 *
 * Run:  npx tsx scripts/fetch-destination-images.ts
 * Then commit lib/data/destination-images.ts AND public/dest-images/.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { DESTINATIONS, type HillStation } from '../lib/data/destinations'
import { DESTINATION_IMAGES } from '../lib/data/destination-images'

// Incremental by default: keep already-resolved images and only fetch new/missing
// destinations. Pass --all to re-fetch everything from scratch.
const REFETCH_ALL = process.argv.includes('--all')

// Places where Commons only has townscape / vehicle / signboard shots that fail
// the nature-only bar - leave them on the clean elevation gradient instead.
const NO_IMAGE = new Set(['umling-la', 'kufri', 'ranikhet'])

const UA = 'PerchTripPlanner/1.0 (https://github.com/perch; hobby project) contact: hello@perch.app'
const SRC_WIDTH = 2560   // thumbnail width fetched from Commons
const STORE_WIDTH = 1920 // final stored width after sharp re-encode
const JPEG_QUALITY = 78
const PUBLIC_DIR = resolve(import.meta.dirname, '../public/dest-images')

// Optional first-priority search query for places whose obvious shot is a town -
// steer them straight to a scenic/nature subject.
const NATURE_OVERRIDE: Record<string, string> = {
  ooty: 'Doddabetta Nilgiri hills',
  coonoor: 'Coonoor tea estate valley',
  kotagiri: 'Catherine Falls Kotagiri',
  kodaikanal: 'Pillar Rocks Kodaikanal',
  munnar: 'Munnar tea estate hills',
  coorg: 'Coorg coffee plantation hills',
  chikmagalur: 'Mullayanagiri hills',
  mullayanagiri: 'Mullayanagiri peak',
  nilgiris: 'Nilgiri mountains',
  puducherry: 'Paradise Beach Pondicherry',
  'araku-valley': 'Araku Valley coffee hills',
  // Scenic places that missed on the first pass - seed nature-rich queries.
  pachamalai: 'Pachamalai hills forest',
  vythiri: 'Vythiri Wayanad waterfall forest',
  peermade: 'Peermade tea estate hills',
  lakkidi: 'Lakkidi Wayanad ghat viewpoint',
  ramakkalmedu: 'Ramakkalmedu hills viewpoint',
  gavi: 'Gavi Kerala forest lake',
  sakleshpur: 'Sakleshpur Western Ghats hills',
  kemmanagundi: 'Kemmanagundi hills waterfall',
  'br-hills': 'Biligiriranga Hills forest',
  skandagiri: 'Skandagiri hills sunrise',
  charmadi: 'Charmadi Ghat western ghats',
  mandalpatti: 'Mandalpatti hills Coorg',
  lambasingi: 'Lambasingi hills Andhra',
  nallamala: 'Nallamala forest hills',
  farahabad: 'Nallamala forest Amrabad',
  // Himalaya - steer famous-but-urban-named places to their scenic subject.
  srinagar: 'Dal Lake Srinagar mountains',
  gulmarg: 'Gulmarg meadow Kashmir snow',
  pahalgam: 'Pahalgam Lidder valley',
  sonamarg: 'Sonamarg Thajiwas glacier',
  doodhpathri: 'Doodhpathri meadows',
  yusmarg: 'Yusmarg meadow Kashmir',
  'gurez-valley': 'Gurez valley Habba Khatoon',
  patnitop: 'Patnitop meadow forest',
  bhaderwah: 'Bhaderwah valley meadows',
  'sinthan-top': 'Sinthan Top snow pass',
  leh: 'Leh Ladakh landscape mountains',
  'nubra-valley': 'Nubra Valley sand dunes Ladakh',
  'pangong-tso': 'Pangong Tso lake Ladakh',
  'khardung-la': 'Khardung La pass Ladakh',
  'tso-moriri': 'Tso Moriri lake Ladakh',
  hemis: 'Hemis National Park Ladakh mountains',
  lamayuru: 'Lamayuru moonland Ladakh',
  zanskar: 'Zanskar valley river Ladakh',
  'umling-la': 'Umling La snow mountains Ladakh',
  shimla: 'Shimla hills Himalaya snow',
  kufri: 'Mahasu Peak Kufri snow forest',
  manali: 'Solang Valley Manali snow mountains',
  'rohtang-pass': 'Rohtang Pass snow Manali',
  dharamshala: 'Dhauladhar Dharamshala mountains',
  dalhousie: 'Dalhousie hills forest',
  khajjiar: 'Khajjiar meadow lake',
  kasol: 'Parvati Valley Kasol river',
  kalpa: 'Kinner Kailash Kalpa',
  chitkul: 'Chitkul Baspa valley',
  'spiti-valley': 'Spiti Valley landscape Key monastery',
  'tirthan-valley': 'Tirthan Valley river forest',
  mussoorie: 'Mussoorie hills Himalaya',
  nainital: 'Naini Lake Nainital',
  auli: 'Gorson Bugyal Auli meadow snow',
  chopta: 'Chopta meadow Tungnath',
  munsiyari: 'Munsiyari Panchachuli peaks',
  'valley-of-flowers': 'Valley of Flowers Uttarakhand',
  kausani: 'Kausani Himalaya Nanda Devi',
  ranikhet: 'Ranikhet golf course pine forest meadow',
  binsar: 'Binsar forest Himalaya',
  rishikesh: 'Ganga river Rishikesh hills',
}

// Reject non-photos, artworks and structures outright (checked on the filename).
// Includes old engravings/lithographs (often "... - British Library") and idols.
const BAD = /(\bmap\b|locator|\bflag\b|coat[_ ]?of[_ ]?arms|\bseal\b|emblem|\blogo\b|diagram|\bchart\b|signboard|name[_ ]?board|milestone|poster|\bbook\b|\bstamp\b|\bportrait\b|engraving|sketch|\bdrawing\b|lithograph|\bprint\b|painting|illustration|\blibrary\b|amman|\bidol\b|deity|goddess|\bzoo\b|\bcage|caged|enclosure|\.svg|\.tiff?|\.gif)/i

// Urban / built-environment terms - strong negative (we want nature, not buildings).
const URBAN_G = /(town|city|cityscape|street|\bmarket\b|bus[_ ]?stand|bus[_ ]?stop|\bshops?\b|hotel|resort|hospital|\bschool\b|college|university|airport|railway|\bstadium\b|\bhouses?\b|residential|junction|\bbuildings?\b|\btemple\b|\bamman\b|\bidol\b|church|mosque|\bfort\b|palace|museum|\bstatue\b|monument|\bmall\b|\boffice\b|rickshaw|\bcar\b|vehicle|\bbus\b|\btruck\b|motorcycle|motorbike|\bbike\b|scooter|\bsign\b|signboard)/gi

// Subjects that are almost always urban - hard-reject on the FILENAME (the
// strongest signal of what a photo actually shows), even if the description is
// padded with scenery words (e.g. "Street views from Coorg").
const STRONG_URBAN = /(\btown\b|\bcity\b|\bstreet\b|\bmarket\b|bus[_ ]?stand|\bjunction\b|downtown|bazaar)/i

// Nature / wildlife / scenery terms - positive.
const NATURE_G = /(hills?|valley|forest|jungle|\btea\b|coffee|plantation|estate|viewpoint|\bview\b|\bpoint\b|\brocks?\b|ghats?|peak|summit|waterfalls?|\bfalls\b|cascade|\blake\b|river|stream|\bdam\b|backwater|sunrise|sunset|meadow|grass(?:land)?|shola|wildlife|sanctuary|national[_ ]?park|tiger|elephant|\bdeer\b|leopard|macaque|tahr|bison|gaur|\bbirds?\b|hornbill|landscape|scenic|scenery|mist|\bfog\b|clouds?|mountains?|\bgreen|nature|trek|trail|beach|coast|\bsea\b|\bdunes?\b|gardens?|panorama|flower|bloom)/gi

interface ImageResult {
  url: string
  thumbUrl: string
  width: number
  height: number
  attribution: string
  license: string
  sourceUrl: string
}

interface Candidate {
  file: string       // bare filename, underscores -> spaces (for scoring/logging)
  thumbUrl: string
  width: number
  mime: string
  attribution: string
  license: string
  sourceUrl: string
  score: number
}

function stripHtml(s: string): string {
  // Tags and entities are resolved together, to a fixed point, because doing
  // either one once is not enough:
  //   - one strip pass turns `<scr<b>ipt>` into `<script>` (CodeQL
  //     js/incomplete-multi-character-sanitization)
  //   - unescaping after stripping can rebuild markup the strip just removed
  //     (`&amp;lt;b&amp;gt;` -> `&lt;b&gt;`) (CodeQL js/double-escaping)
  // Looping until the string stops changing handles both orderings.
  let out = s
  for (let i = 0; i < 5; i++) {
    const before = out
    out = out
      .replace(/<[^>]*>/g, '')
      .replace(/&(?:amp|#0*38);/gi, '&')
      .replace(/&(?:lt|#0*60);/gi, '<')
      .replace(/&(?:gt|#0*62);/gi, '>')
      .replace(/&(?:quot|#0*34);/gi, '"')
      .replace(/&(?:apos|#0*39);/gi, "'")
    if (out === before) break
  }
  // Belt and braces: whatever survives, no angle bracket leaves this function,
  // so the result cannot open an element no matter what Commons sent us.
  return out.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
}

function uniqueMatches(re: RegExp, text: string): number {
  const m = text.match(re)
  if (!m) return 0
  return new Set(m.map((s) => s.toLowerCase())).size
}

// The filename is the strongest signal of what a photo actually shows; the
// description is capped so a townscape can't win on nature-padded prose alone
// (e.g. an ID-named photo of a settlement whose caption lists "tea, hills…").
function scoreCand(file: string, desc: string): number {
  const d = desc.slice(0, 400)
  const natF = uniqueMatches(NATURE_G, file)
  const urbF = uniqueMatches(URBAN_G, file)
  const natD = uniqueMatches(NATURE_G, d)
  const urbD = uniqueMatches(URBAN_G, d)
  return 3 * natF - 5 * urbF + Math.min(natD, 2) - 2 * urbD
}

interface CommonsMetaField {
  value?: string
}

interface CommonsImageInfo {
  thumburl?: string
  url?: string
  descriptionurl?: string
  width?: number
  mime?: string
  extmetadata?: Record<string, CommonsMetaField | undefined>
}

interface CommonsPage {
  title?: string
  imageinfo?: CommonsImageInfo[]
}

interface CommonsResponse {
  query?: {
    pages?: Record<string, CommonsPage | undefined>
  }
}

async function commons(params: Record<string, string>): Promise<CommonsResponse> {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('format', 'json')
  url.searchParams.set('action', 'query')
  url.searchParams.set('redirects', '1')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Commons HTTP ${res.status}`)
  return res.json() as Promise<CommonsResponse>
}

/** Search Commons (File namespace) and return scored, photo-only candidates. */
async function searchImages(query: string): Promise<Candidate[]> {
  const data = await commons({
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: String(SRC_WIDTH),
  })
  const pages = data?.query?.pages ?? {}
  const out: Candidate[] = []
  for (const id of Object.keys(pages)) {
    const p = pages[id]
    if (!p) continue
    const ii = p.imageinfo?.[0]
    if (!ii?.thumburl) continue
    const mime: string = ii.mime ?? ''
    if (mime !== 'image/jpeg' && mime !== 'image/png') continue
    if ((ii.width ?? 0) < 1200) continue
    const title = p.title ?? ''
    const fileRaw: string = title.replace(/^File:/, '')
    if (BAD.test(fileRaw)) continue
    const file = fileRaw.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ')
    if (STRONG_URBAN.test(file)) continue
    const meta = ii.extmetadata ?? {}
    const desc = meta.ImageDescription?.value ? stripHtml(meta.ImageDescription.value) : ''
    const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : 'Wikimedia Commons'
    const license = meta.LicenseShortName?.value ? stripHtml(meta.LicenseShortName.value) : 'CC / public domain'
    out.push({
      file,
      thumbUrl: ii.thumburl,
      width: ii.width ?? 0,
      mime,
      attribution: artist.slice(0, 80),
      license,
      sourceUrl: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      score: scoreCand(file, desc),
    })
  }
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Build nature-biased search queries from the destination's own data. */
function buildQueries(d: HillStation): string[] {
  const base = d.name.replace(/\s*\(.*?\)\s*/g, '').trim()
  const hi = d.highlights.map((h) => h.replace(/\s*\(.*?\)\s*/g, '').trim())
  const catTerm =
    d.category === 'forest' ? `${base} wildlife forest`
    : d.category === 'coastal' ? `${base} beach`
    : `${base} hills landscape`
  return [
    NATURE_OVERRIDE[d.slug],
    ...hi.map((h) => `${h} ${base}`),
    catTerm,
    `${base} ${d.region} scenery`,
    `${base} ${d.state}`,
    base,
  ].filter(Boolean) as string[]
}

async function resolveImage(d: HillStation): Promise<Candidate | null> {
  const pool = new Map<string, Candidate>() // dedupe by file
  for (const q of buildQueries(d)) {
    let cands: Candidate[] = []
    try {
      cands = await searchImages(q)
    } catch (e) {
      console.warn(`  ${d.slug}: search "${q}" failed - ${(e as Error).message}`)
    }
    for (const c of cands) {
      const prev = pool.get(c.file)
      if (!prev || c.score > prev.score) pool.set(c.file, c)
    }
    await sleep(120)
    // Stop early once we have a couple of clearly-good (nature-rich) options.
    if ([...pool.values()].filter((c) => c.score >= 4).length >= 2) break
  }
  const ranked = [...pool.values()].sort((a, b) => b.score - a.score || b.width - a.width)
  // Significant tokens of the place name/slug, used to confirm a candidate is
  // actually about THIS place (guards against the bare-name query matching an
  // unrelated foreign location, e.g. "Farahabad" -> a castle in Iran).
  const tokens = [...d.name.toLowerCase().split(/[\s()]+/), ...d.slug.split('-')]
    .filter((t) => t.length >= 4)
  const onTopic = (c: Candidate) => tokens.some((t) => c.file.toLowerCase().includes(t))
  // Accept the best candidate with a real nature signal (score >= 1), OR a
  // neutral shot (score 0, no urban words) that is clearly about this place.
  // Net-urban (negative) and off-topic neutrals fall back to the gradient.
  return ranked.find((c) => c.score >= 1 || (c.score >= 0 && onTopic(c))) ?? null
}

/** Download + re-encode to public/dest-images/<slug>.jpg; returns bytes + dims.
 *  Retries once - large Wikimedia thumbs occasionally arrive truncated. */
async function download(url: string, slug: string): Promise<{ bytes: number; width: number; height: number }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`download HTTP ${res.status}`)
      const src = Buffer.from(await res.arrayBuffer())
      const { data, info } = await sharp(src)
        .rotate()
        .resize({ width: STORE_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true })
      writeFileSync(resolve(PUBLIC_DIR, `${slug}.jpg`), data)
      return { bytes: data.length, width: info.width, height: info.height }
    } catch (e) {
      lastErr = e
      await sleep(400)
    }
  }
  throw lastErr
}

async function main() {
  mkdirSync(PUBLIC_DIR, { recursive: true })

  // Carry forward already-resolved images (file still on disk) unless --all.
  const out: Record<string, ImageResult> = {}
  if (!REFETCH_ALL) {
    for (const [slug, img] of Object.entries(DESTINATION_IMAGES)) {
      if (existsSync(resolve(PUBLIC_DIR, `${slug}.jpg`))) out[slug] = img
    }
  }
  const todo = DESTINATIONS.filter((d) => !out[d.slug] && !NO_IMAGE.has(d.slug))
  console.log(`Finding nature/wildlife photos: ${todo.length} to fetch, ${Object.keys(out).length} kept (${DESTINATIONS.length} total).`)

  const misses: string[] = []
  let totalBytes = 0

  for (const d of todo) {
    const best = await resolveImage(d)
    if (!best) {
      misses.push(d.slug)
      console.log(`  ✗ ${d.slug.padEnd(20)} (no suitable nature image)`)
      continue
    }
    try {
      const { bytes, width, height } = await download(best.thumbUrl, d.slug)
      totalBytes += bytes
      const localPath = `/dest-images/${d.slug}.jpg`
      out[d.slug] = {
        url: localPath,
        thumbUrl: localPath,
        width,
        height,
        attribution: best.attribution,
        license: best.license,
        sourceUrl: best.sourceUrl,
      }
      console.log(`  ✓ ${d.slug.padEnd(20)} s${String(best.score).padEnd(3)} ${best.file.slice(0, 38).padEnd(38)} ${(bytes / 1024).toFixed(0)}KB`)
    } catch (e) {
      misses.push(d.slug)
      console.log(`  ✗ ${d.slug.padEnd(20)} download failed - ${(e as Error).message}`)
    }
    await sleep(120)
  }

  const header = `// AUTO-GENERATED by scripts/fetch-destination-images.ts - do not edit by hand.
// Source: Wikimedia Commons (keyless MediaWiki API). Generated: ${new Date().toISOString().slice(0, 10)}
// Images are NATURE-biased (scored toward landscapes/forests/wildlife, away from
// towns/buildings) then downloaded + self-hosted under public/dest-images/ so
// next/image never hits Wikimedia at runtime. ${Object.keys(out).length}/${DESTINATIONS.length} resolved.
// CC-licensed; 'attribution' + 'license' + 'sourceUrl' credit authors.
// Re-run: npx tsx scripts/fetch-destination-images.ts

export interface DestinationImage {
  url: string        // local path - full-screen hero
  thumbUrl: string   // local path - card grids (next/image sizes per device)
  width: number
  height: number
  attribution: string
  license: string
  sourceUrl: string
}

export const DESTINATION_IMAGES: Record<string, DestinationImage> = ${JSON.stringify(out, null, 2)}

export function destinationImage(slug: string): DestinationImage | undefined {
  return DESTINATION_IMAGES[slug]
}
`

  const outPath = resolve(import.meta.dirname, '../lib/data/destination-images.ts')
  writeFileSync(outPath, header)
  console.log(`\nWrote ${outPath}`)
  console.log(`Hits: ${Object.keys(out).length} | Misses: ${misses.length}${misses.length ? ' -> ' + misses.join(', ') : ''}`)
  console.log(`Total: ${(totalBytes / 1024 / 1024).toFixed(1)} MB into public/dest-images/`)
}

main().catch((e) => { console.error(e); process.exit(1) })
