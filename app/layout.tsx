import type { Metadata } from 'next'
import {
  Bricolage_Grotesque,
  DM_Serif_Display,
  Fraunces,
  Geist,
  IBM_Plex_Sans,
  Instrument_Serif,
  Inter,
  Playfair_Display,
  Source_Sans_3,
  Space_Grotesk,
} from 'next/font/google'
import Link from 'next/link'
import { PerchMark } from '@/components/brand/logo'
import { SpatialBackground } from '@/components/fx/spatial-background'
import { buildRootCss, SITE_DEFAULTS } from '@/lib/data/site-defaults'
import { getSiteSettings } from '@/lib/queries/site-settings'
import { SITE_URL } from '@/lib/site'
import './globals.css'

/**
 * The curated type set, self-hosted at build time.
 *
 * All ten are loaded on every page and each gets its own CSS variable; only the
 * `--font-display` / `--font-sans` binding changes when the owner picks a
 * different one (see lib/data/fonts.ts, which is the allowlist, and
 * app/globals.css, which holds the default binding).
 *
 * It has to work this way round. next/font compiles the @font-face and the
 * subset files at build time, so the set cannot be decided by a database value
 * at request time. The alternative - a runtime <link> to Google Fonts - would
 * mean FOUT, a third-party request on every page load, and a CSP hole. Loading
 * all ten and switching a variable costs a few font files; it buys keeping the
 * pages static and the CSP shut.
 *
 * KEEP THIS LIST TIGHT. Every family here is served to every visitor whether or
 * not it is the chosen one.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-instrument-serif',
})
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair-display',
})
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
})
const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-dm-serif-display',
})
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage-grotesque',
})
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
})
const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
})
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})
const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-sans-3',
})
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ibm-plex-sans',
})

/** Every family's variable has to exist on <html> - only the binding changes. */
const FONT_VARS = [
  instrumentSerif.variable,
  playfairDisplay.variable,
  fraunces.variable,
  dmSerifDisplay.variable,
  bricolageGrotesque.variable,
  spaceGrotesk.variable,
  geist.variable,
  inter.variable,
  sourceSans3.variable,
  ibmPlexSans.variable,
].join(' ')

/**
 * Title and description come from the settings row when set, and from
 * lib/site.ts otherwise - it stays the fallback source of truth.
 *
 * This is a generateMetadata() rather than a static export because it reads the
 * settings. It does NOT make anything dynamic: getSiteSettings is cached, so
 * there is no request-time data here and every prerendered page stays
 * prerendered.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  const title = settings.site_title?.trim() || SITE_DEFAULTS.siteTitle
  const tagline = settings.tagline?.trim() || SITE_DEFAULTS.tagline
  const description = settings.meta_description?.trim() || SITE_DEFAULTS.metaDescription
  const headline = `${title} - ${tagline}`

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: headline,
      template: `%s | ${title}`,
    },
    description,
    applicationName: title,
    keywords: [
      'remote work India', 'hill stations', 'workation', 'digital nomad India',
      'WiFi hill stations', 'Himalaya travel', 'Kashmir', 'Ladakh', 'Manali', 'Leh',
      'Ooty', 'Munnar', 'Coorg', 'road trip', 'travel advisory', 'highest motorable pass',
    ],
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: title,
      title: headline,
      description,
      url: SITE_URL,
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title: headline,
      description,
    },
    robots: { index: true, follow: true },
  }
}

/**
 * Six items is one more than the bar comfortably holds, so the tail of the list
 * only appears once there is room for it. Nothing was dropped to make space for
 * Reports: below `lg` the last three fold away, and everything is still one tap
 * down in the footer.
 */
const NAV = [
  { href: '/destinations', label: 'Destinations', show: 'sm:block' },
  { href: '/trip-finder',  label: 'Trip Finder',  show: 'sm:block' },
  { href: '/reports',      label: 'Reports',      show: 'sm:block' },
  { href: '/stays',        label: 'Stays',        show: 'lg:block' },
  { href: '/journeys',     label: 'Journeys',     show: 'lg:block' },
  { href: '/charging',     label: 'EV Charging',  show: 'lg:block' },
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

  // Null whenever nothing is set or nothing validates, and then no <style> is
  // rendered at all - the page is byte-for-byte what it was before this feature.
  const rootCss = buildRootCss(settings)

  return (
    <html lang="en" className={FONT_VARS}>
      <body className="min-h-screen antialiased">
          {/*
            Overrides for the tokens the owner has actually set. Safe to inline:
            buildRootCss() emits only #rrggbb values it re-validated itself and
            var() references to the curated font allowlist, so no owner-supplied
            string reaches this tag. `href`+`precedence` let React hoist and
            dedupe it into <head>, ahead of first paint.
          */}
          {rootCss ? (
            <style
              href="perch-site-settings"
              precedence="high"
              dangerouslySetInnerHTML={{ __html: rootCss }}
            />
          ) : null}

          <SpatialBackground />
          <header className="sticky top-0 z-50 border-b border-[var(--line)]/80 bg-[var(--paper)]/75 shadow-[0_1px_0_rgb(30_24_18/0.03),0_8px_24px_-16px_rgb(30_24_18/0.18)] backdrop-blur-xl backdrop-saturate-150">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
              <Link href="/" className="group flex items-center gap-2 rounded-lg">
                <PerchMark className="h-7 w-7 transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)] group-hover:-translate-y-0.5" />
                <span className="font-display text-2xl font-semibold tracking-tight text-[var(--brand)]">
                  perch
                </span>
              </Link>

              <div className="flex items-center gap-1 sm:gap-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`hidden rounded-lg px-3 py-2 text-sm font-medium text-[var(--ink-soft)] transition-all duration-200 hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${item.show}`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link href="/contribute" className="btn-primary ml-1 text-sm">
                  Add trip report
                </Link>
              </div>
            </nav>
          </header>

          <main>{children}</main>

          <footer className="mt-20 border-t border-[var(--line)] bg-[var(--surface)]">
            <div className="mx-auto max-w-6xl px-5 py-14">
              <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
                <div>
                  <Link href="/" className="flex items-center gap-2">
                    <PerchMark className="h-7 w-7" />
                    <span className="font-display text-2xl font-semibold text-[var(--brand)]">perch</span>
                  </Link>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--ink-soft)]">
                    {settings.footer_blurb?.trim() || SITE_DEFAULTS.footerBlurb}
                  </p>
                </div>
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Explore</p>
                  <div className="space-y-1.5 text-sm text-[var(--ink-soft)]">
                    <Link href="/destinations" className="block transition-colors hover:text-[var(--ink)]">Destinations</Link>
                    <Link href="/trip-finder"  className="block transition-colors hover:text-[var(--ink)]">Trip finder</Link>
                    <Link href="/reports"      className="block transition-colors hover:text-[var(--ink)]">Trip reports</Link>
                    <Link href="/stays"        className="block transition-colors hover:text-[var(--ink)]">Stays</Link>
                    <Link href="/journeys"     className="block transition-colors hover:text-[var(--ink)]">Journey guides</Link>
                    <Link href="/charging"     className="block transition-colors hover:text-[var(--ink)]">EV charging map</Link>
                    <Link href="/kashmir"      className="block transition-colors hover:text-[var(--ink)]">Kashmir Circuit &apos;26</Link>
                    <Link href="/contribute"   className="block transition-colors hover:text-[var(--ink)]">Write a trip report</Link>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">About</p>
                  <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
                    {settings.about_blurb?.trim() || SITE_DEFAULTS.aboutBlurb}
                  </p>
                </div>
              </div>
              <div className="mt-12 border-t border-[var(--line)] pt-6 text-xs text-[var(--ink-soft)]">
                © {new Date().getFullYear()} Perch · Made for the Indian hills, Western Ghats to the Himalaya
              </div>
            </div>
          </footer>
      </body>
    </html>
  )
}
