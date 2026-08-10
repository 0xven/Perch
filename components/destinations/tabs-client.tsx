'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

/**
 * The destination page's tab bar and panel switch, moved to the client.
 *
 * WHY IT IS NOT ON THE SERVER ANY MORE: the page read `?tab=` via
 * `await searchParams`, and awaiting searchParams is a dynamic signal - it threw
 * away the page's own generateStaticParams and forced a fresh render for every
 * visitor. Measured on production: x-vercel-cache MISS on every request, TTFB
 * 340ms and spiking to 1.4s, while genuinely static pages returned in ~100ms.
 *
 * Reading the same parameter with useSearchParams costs nothing at render time,
 * so all 97 destination pages prerender and are served from the edge. The URLs
 * are unchanged - ?tab=wifi still deep-links, still shareable, still
 * back-button-able - the switch just happens in the browser now, which also
 * makes it instant instead of a round trip.
 *
 * The trade: every panel is rendered into the page rather than only the active
 * one. That is affordable precisely BECAUSE the page is static now - the work
 * happens once per revalidate window, not once per visitor - and the community
 * panels are cached reads that are empty until people contribute.
 *
 * useSearchParams needs a Suspense boundary or it opts the whole route out of
 * prerendering, which would undo the entire point. The boundary is inside this
 * file so a caller cannot forget it.
 */

export interface TabDef {
  id: string
  label: string
}

function TabBar({ slug, tabs, active }: { slug: string; tabs: readonly TabDef[]; active: string }) {
  return (
    <div className="sticky top-14 z-30 border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl gap-0 overflow-x-auto px-5">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/destinations/${slug}?tab=${t.id}`}
            scroll={false}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              active === t.id
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function Panels({
  tabs,
  panels,
  active,
}: {
  tabs: readonly TabDef[]
  panels: Record<string, React.ReactNode>
  active: string
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {tabs.map((t) => (
        // hidden rather than unmounted: the panels are server-rendered children
        // handed down as props, so this cannot re-create them on the client.
        // `hidden` also keeps them out of the accessibility tree and out of
        // find-in-page, which is the behaviour people expect from a tab.
        <div key={t.id} hidden={t.id !== active}>
          {panels[t.id]}
        </div>
      ))}
    </div>
  )
}

function Switcher({
  slug,
  tabs,
  panels,
  defaultTab,
}: {
  slug: string
  tabs: readonly TabDef[]
  panels: Record<string, React.ReactNode>
  defaultTab: string
}) {
  const param = useSearchParams().get('tab')
  const active = param && tabs.some((t) => t.id === param) ? param : defaultTab

  return (
    <>
      <TabBar slug={slug} tabs={tabs} active={active} />
      <Panels tabs={tabs} panels={panels} active={active} />
    </>
  )
}

export function DestinationTabs({
  slug,
  tabs,
  panels,
  defaultTab = 'overview',
}: {
  slug: string
  tabs: readonly TabDef[]
  /** Server-rendered panel for each tab id. */
  panels: Record<string, React.ReactNode>
  defaultTab?: string
}) {
  return (
    <Suspense fallback={<TabBar slug={slug} tabs={tabs} active={defaultTab} />}>
      <Switcher slug={slug} tabs={tabs} panels={panels} defaultTab={defaultTab} />
    </Suspense>
  )
}
