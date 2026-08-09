/**
 * Build-time WILDLIFE photo fetcher + self-hoster (ANIMAL-biased).
 *
 * For every destination in lib/data/wildlife.ts this searches Wikimedia Commons
 * (keyless MediaWiki API, $0) for a real photo of the place's HEADLINE species
 * (usually species[0] - e.g. mudumalai -> tiger, hemis -> snow leopard, kabini ->
 * black panther, eravikulam -> Nilgiri tahr). It scores candidates toward
 * in-the-wild wildlife photography and AWAY from zoos, cages, illustrations,
 * maps, logos and skins/mounts, picks the best, then DOWNLOADS it (re-encoded
 * with sharp to a lean ~1600px JPEG) into public/wildlife/<slug>.jpg. Serving
 * from our own origin means next/image never calls Wikimedia at runtime while
 * staying $0 and fully CC-attributed.
 *
 * SOURCE POLICY: Wikimedia Commons only (CC / public-domain). Never National
 * Geographic, Discovery, stock libraries or any copyrighted source.
 *
 * Run:  npx tsx scripts/fetch-wildlife-images.ts          (incremental)
 *       npx tsx scripts/fetch-wildlife-images.ts --all    (re-fetch everything)
 * Then commit lib/data/wildlife-images.ts AND public/wildlife/.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { WILDLIFE } from '../lib/data/wildlife'

// Incremental by default: keep already-resolved images (file still on disk) and
// only fetch new/missing slugs. Pass --all to re-fetch everything.
const REFETCH_ALL = process.argv.includes('--all')

const UA = 'PerchTripPlanner/1.0 (https://github.com/perch; hobby project) contact: hello@perch.app'
const SRC_WIDTH = 2400    // thumbnail width fetched from Commons
const STORE_WIDTH = 1600  // final stored width after sharp re-encode
const JPEG_QUALITY = 78
const PUBLIC_DIR = resolve(import.meta.dirname, '../public/wildlife')

// Best search query per slug. Derived from species[0], but several headline
// species need a more precise Commons term than their display label:
//  - "Black panther" in India IS a melanistic Indian leopard; query both.
//  - "Hangul (Kashmir stag)" searches better as "Kashmir stag hangul".
//  - "Kiang (wild ass)" is the Tibetan wild ass.
//  - generic "Elephant"/"Leopard" get an "Indian"/"wild" qualifier so we land on
//    Asian/Indian animals in the wild, not African or captive ones.
// Queries lead with the species, so the filename (the strongest signal) tends to
// name the animal. A scientific name is added where it sharpens the search.
const SPECIES_QUERY: Record<string, string> = {
  valparai: 'Lion-tailed macaque Macaca silenus wild',
  megamalai: 'Asian elephant Elephas maximus wild forest',
  topslip: 'Bengal tiger Panthera tigris wild',
  mudumalai: 'Bengal tiger wild forest India',
  munnar: 'Nilgiri tahr Nilgiritragus hylocrius',
  eravikulam: 'Nilgiri tahr Eravikulam wild',
  thekkady: 'Asian elephant Periyar wild herd',
  gavi: 'Lion-tailed macaque Macaca silenus wild',
  'silent-valley': 'Lion-tailed macaque rainforest wild',
  wayanad: 'Asian elephant wild Wayanad forest',
  'br-hills': 'Bengal tiger wild India forest',
  kabini: 'melanistic leopard black panther Panthera pardus wild',
  kudremukh: 'Lion-tailed macaque Western Ghats wild',
  nallamala: 'Bengal tiger wild forest India',
  farahabad: 'Bengal tiger wild forest India',
  maredumilli: 'Indian leopard Panthera pardus fusca wild',
  coorg: 'Asian elephant wild Karnataka forest',
  srinagar: 'Hangul Kashmir stag Cervus hanglu Dachigam deer',
  hemis: 'Snow leopard Panthera uncia wild mountain',
  'tso-moriri': 'Kiang Tibetan wild ass Equus kiang',
  'tirthan-valley': 'Himalayan tahr Hemitragus jemlahicus wild',
  binsar: 'Indian leopard wild Himalaya forest',
  'valley-of-flowers': 'Bharal blue sheep Pseudois nayaur Himalaya',
}

// Hand-verified Commons files for species where a blind search is unreliable.
// Each was checked to be a real, in-the-wild photo of the headline animal (no
// zoos, no scenery-of-the-reserve, no name collisions like "Tiger Reserve" or
// the political "Black Panther Party"). The fetcher pins these by exact title;
// everything else falls back to the scored species search below.
//   - Black panther: the only solid free wild shot is from Nagarhole/Kabini.
//   - Hangul: the endangered Kashmir stag herd at Dachigam.
//   - Tigers: a generic "Periyar Tiger Reserve" file is just park scenery, so the
//     tiger slugs are pinned to real Bengal-tiger portraits instead.
const OVERRIDE_FILE: Record<string, string> = {
  valparai: 'LTM male Valparai.jpg',                                  // LTM photographed at Valparai
  kabini: 'Black Panther - India.jpg',                                // melanistic leopard, Nagarhole/Kabini
  srinagar: 'The Last Surviving Population of Hangul.jpg',            // Kashmir stag herd, Dachigam
  topslip: 'Panthera tigris - the big cat.jpg',
  mudumalai: 'Panthera tigris - the big cat.jpg',
  'br-hills': 'Panthera tigris - the big cat.jpg',
  nallamala: 'Panthera tigris - the big cat.jpg',
  farahabad: 'Panthera tigris - the big cat.jpg',
  coorg: 'Elephas maximus (Bandipur).jpg',                            // Indian elephant bull, Bandipur (Karnataka)
}

/** Fetch one exact Commons file by title and shape it as a Candidate. */
async function fileByTitle(title: string): Promise<Candidate | null> {
  const data = await commons({
    titles: `File:${title}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: String(SRC_WIDTH),
  })
  const pages = data?.query?.pages ?? {}
  for (const id of Object.keys(pages)) {
    const p = pages[id]
    if (!p) continue
    const ii = p.imageinfo?.[0]
    if (!ii?.thumburl) continue
    const meta = ii.extmetadata ?? {}
    const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : 'Wikimedia Commons'
    const license = meta.LicenseShortName?.value ? stripHtml(meta.LicenseShortName.value) : 'CC / public domain'
    return {
      file: title.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '),
      thumbUrl: ii.thumburl,
      width: ii.width ?? 0,
      attribution: artist.slice(0, 80),
      license,
      sourceUrl: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title ?? title)}`,
      score: 99,
    }
  }
  return null
}

// Reject non-photos, captive shots, art and specimens outright (on the filename).
// Captive/zoo/skin/mount/illustration terms are hard negatives - we want wild,
// living animals photographed in nature.
const BAD = /(\bmap\b|locator|\bflag\b|coat[_ ]?of[_ ]?arms|\bseal\b|emblem|\blogo\b|diagram|\bchart\b|signboard|name[_ ]?board|\bposter\b|\bbook\b|\bstamp\b|engraving|sketch|\bdrawing\b|lithograph|\bprint\b|painting|illustration|\blibrary\b|\bzoo\b|\bzoological\b|\bcage|caged|enclosure|captive|captivity|\bcaptured\b|rescue|rehabilitation|\bcircus\b|skull|\bskin\b|\bpelt\b|taxidermy|\bmount(ed)?\b|specimen|\bmuseum\b|carcass|\bdead\b|roadkill|\bstatue\b|sculpture|\bidol\b|\bcoin\b|\bsvg\b|\.svg|\.tiff?|\.gif|\bpng\b|\bvase\b|amphora|\bkrater\b|pottery|terracotta|\brhodos\b|\bworkshop\b|red[_ -]?figure|black[_ -]?figure|\brelief\b|fresco|mosaic|\bbas[_ -]?relief\b|\bantiquit|\bmural\b|\bceramic\b|\bartefact\b|\bartifact\b)/i

// Captive / human-context terms - strong negative.
const CAPTIVE_G = /(\bzoo\b|zoological|captive|captivity|\bcage|caged|enclosure|safari[_ ]?park|\bpark\b\s*\bzoo\b|rescue|rehab|sanctuary[_ ]?cage|circus|\bpet\b|chained|tied|\bfarm\b|domestic|temple|\bman\b|\bmen\b|people|tourist|jeep|vehicle|\bcar\b|handler|mahout|trained|festival|parade)/gi

// In-the-wild / good-photo terms - positive.
const WILD_G = /(\bwild\b|wildlife|\bforest\b|jungle|\bnational[_ ]?park\b|\breserve\b|\bsanctuary\b|natural[_ ]?habitat|in[_ ]?the[_ ]?wild|grass(?:land)?|meadow|snow|mountain|alpine|\bcub\b|\bherd\b|grazing|\bmale\b|\bfemale\b|\badult\b|portrait|closeup|close[_ ]?up|\bbull\b|tusker|\bwater[_ ]?hole\b)/gi

interface ImageResult {
  url: string
  attribution: string
  license: string
  sourceUrl: string
}

interface Candidate {
  file: string       // bare filename, underscores -> spaces (for scoring/logging)
  thumbUrl: string
  width: number
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
// description is capped so a captive shot can't win on wild-padded prose alone.
function scoreCand(file: string, desc: string): number {
  const d = desc.slice(0, 400)
  const wildF = uniqueMatches(WILD_G, file)
  const capF = uniqueMatches(CAPTIVE_G, file)
  const wildD = uniqueMatches(WILD_G, d)
  const capD = uniqueMatches(CAPTIVE_G, d)
  return 3 * wildF - 5 * capF + Math.min(wildD, 2) - 2 * capD
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
    gsrlimit: '24',
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
    const meta = ii.extmetadata ?? {}
    const desc = meta.ImageDescription?.value ? stripHtml(meta.ImageDescription.value) : ''
    const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : 'Wikimedia Commons'
    const license = meta.LicenseShortName?.value ? stripHtml(meta.LicenseShortName.value) : 'CC / public domain'
    out.push({
      file,
      thumbUrl: ii.thumburl,
      width: ii.width ?? 0,
      attribution: artist.slice(0, 80),
      license,
      sourceUrl: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      score: scoreCand(file, desc),
    })
  }
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Significant species tokens, used to confirm a candidate actually shows the
 *  headline animal (guards against the wild-padded query matching scenery). */
function speciesTokens(slug: string): string[] {
  const species = WILDLIFE[slug].species[0]
  // Drop parentheticals, lowercase, keep words >= 4 chars; add common synonyms.
  const base = species.replace(/\(.*?\)/g, '').toLowerCase()
  const paren = (species.match(/\((.*?)\)/)?.[1] ?? '').toLowerCase()
  const extra: Record<string, string[]> = {
    kabini: ['panther', 'leopard', 'melanistic'],
    srinagar: ['hangul', 'stag', 'cervus'],
    'tso-moriri': ['kiang', 'ass', 'equus'],
    'valley-of-flowers': ['bharal', 'sheep', 'pseudois', 'nayaur'],
  }
  return [...base.split(/[\s-]+/), ...paren.split(/[\s-]+/), ...(extra[slug] ?? [])]
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
}

async function resolveImage(slug: string): Promise<Candidate | null> {
  // Hand-verified pin wins outright when present.
  if (OVERRIDE_FILE[slug]) {
    try {
      const pinned = await fileByTitle(OVERRIDE_FILE[slug])
      if (pinned) return pinned
      console.warn(`  ${slug}: override "${OVERRIDE_FILE[slug]}" not found - falling back to search`)
    } catch (e) {
      console.warn(`  ${slug}: override fetch failed - ${(e as Error).message}`)
    }
  }

  const query = SPECIES_QUERY[slug] ?? WILDLIFE[slug].species[0]
  const tokens = speciesTokens(slug)
  const onTopic = (c: Candidate) => tokens.some((t) => c.file.toLowerCase().includes(t))

  const pool = new Map<string, Candidate>()
  // Primary species query, then a couple of fallbacks if it comes up thin.
  const queries = [query, `${WILDLIFE[slug].species[0]} wild animal`, WILDLIFE[slug].species[0]]
  for (const q of queries) {
    let cands: Candidate[] = []
    try {
      cands = await searchImages(q)
    } catch (e) {
      console.warn(`  ${slug}: search "${q}" failed - ${(e as Error).message}`)
    }
    for (const c of cands) {
      const prev = pool.get(c.file)
      if (!prev || c.score > prev.score) pool.set(c.file, c)
    }
    await sleep(120)
    // Stop once we have a couple of clearly-good, on-topic options.
    if ([...pool.values()].filter((c) => c.score >= 3 && onTopic(c)).length >= 2) break
  }

  const ranked = [...pool.values()].sort((a, b) => b.score - a.score || b.width - a.width)
  // Require the candidate to actually name the species in its filename, AND not
  // be net-captive. Prefer a real wild signal; fall back to an on-topic neutral.
  return (
    ranked.find((c) => onTopic(c) && c.score >= 2) ??
    ranked.find((c) => onTopic(c) && c.score >= 0) ??
    null
  )
}

/** Download + re-encode to public/wildlife/<slug>.jpg. Retries once - large
 *  Wikimedia thumbs occasionally arrive truncated. */
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

// Load the existing data file (if any) so incremental runs keep prior results.
async function loadExisting(): Promise<Record<string, ImageResult>> {
  const path = resolve(import.meta.dirname, '../lib/data/wildlife-images.ts')
  if (!existsSync(path)) return {}
  try {
    const mod = await import(path)
    return (mod.WILDLIFE_IMAGES ?? {}) as Record<string, ImageResult>
  } catch {
    return {}
  }
}

async function main() {
  mkdirSync(PUBLIC_DIR, { recursive: true })

  const out: Record<string, ImageResult> = {}
  if (!REFETCH_ALL) {
    const existing = await loadExisting()
    for (const [slug, img] of Object.entries(existing)) {
      if (existsSync(resolve(PUBLIC_DIR, `${slug}.jpg`))) out[slug] = img
    }
  }

  const slugs = Object.keys(WILDLIFE)
  const todo = slugs.filter((s) => !out[s])
  console.log(`Finding wildlife photos: ${todo.length} to fetch, ${Object.keys(out).length} kept (${slugs.length} total).`)

  const misses: string[] = []
  let totalBytes = 0

  for (const slug of todo) {
    const best = await resolveImage(slug)
    if (!best) {
      misses.push(slug)
      console.log(`  ✗ ${slug.padEnd(20)} (no suitable wild-animal photo)`)
      continue
    }
    try {
      const { bytes } = await download(best.thumbUrl, slug)
      totalBytes += bytes
      out[slug] = {
        url: `/wildlife/${slug}.jpg`,
        attribution: best.attribution,
        license: best.license,
        sourceUrl: best.sourceUrl,
      }
      console.log(`  ✓ ${slug.padEnd(20)} s${String(best.score).padEnd(3)} ${best.file.slice(0, 40).padEnd(40)} ${(bytes / 1024).toFixed(0)}KB`)
    } catch (e) {
      misses.push(slug)
      console.log(`  ✗ ${slug.padEnd(20)} download failed - ${(e as Error).message}`)
    }
    await sleep(120)
  }

  // Stable key order so re-runs produce minimal diffs.
  const ordered: Record<string, ImageResult> = {}
  for (const slug of slugs) if (out[slug]) ordered[slug] = out[slug]

  const header = `// AUTO-GENERATED by scripts/fetch-wildlife-images.ts - do not edit by hand.
// Source: Wikimedia Commons (keyless MediaWiki API). Generated: ${new Date().toISOString().slice(0, 10)}
// Real in-the-wild ANIMAL photos of each destination's headline species, scored
// toward wild/natural-habitat shots and away from zoos/cages/captivity, then
// downloaded + self-hosted under public/wildlife/ so next/image never hits
// Wikimedia at runtime. ${Object.keys(ordered).length}/${slugs.length} resolved.
// CC-licensed; 'attribution' + 'license' + 'sourceUrl' credit authors.
// Re-run: npx tsx scripts/fetch-wildlife-images.ts

export interface WildlifeImage {
  url: string          // local path under public/wildlife/
  attribution: string  // author credit
  license: string      // CC license short name
  sourceUrl: string    // Wikimedia Commons file page
}

export const WILDLIFE_IMAGES: Record<string, WildlifeImage> = ${JSON.stringify(ordered, null, 2)}

export function wildlifeImage(slug: string): WildlifeImage | undefined {
  return WILDLIFE_IMAGES[slug]
}
`

  const outPath = resolve(import.meta.dirname, '../lib/data/wildlife-images.ts')
  writeFileSync(outPath, header)
  console.log(`\nWrote ${outPath}`)
  console.log(`Hits: ${Object.keys(ordered).length} | Misses: ${misses.length}${misses.length ? ' -> ' + misses.join(', ') : ''}`)
  console.log(`Total: ${(totalBytes / 1024 / 1024).toFixed(1)} MB into public/wildlife/`)
}

main().catch((e) => { console.error(e); process.exit(1) })
