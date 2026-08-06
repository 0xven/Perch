import Link from 'next/link'
import { requireAdmin } from '@/lib/supabase/admin-guard'
import { signOutAction } from '@/app/admin/auth-actions'

export const dynamic = 'force-dynamic'

const ADMIN_NAV = [
  { href: '/admin/reports', label: 'Trip reports' },
  { href: '/admin/trip-media', label: 'Trip media' },
  { href: '/admin/posts', label: 'Posts' },
  { href: '/admin/destinations', label: 'Destinations' },
  { href: '/admin/settings', label: 'Settings' },
]

/**
 * Shell for the signed-in panel. The `(panel)` route group keeps /admin/login
 * out of this subtree, so the login page never inherits the admin gate.
 *
 * requireAdmin() here is for the chrome (it needs the email to show). It is NOT
 * what protects the pages: layouts do not re-run on client navigations, so
 * every page and every action re-checks for itself.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Admin
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-[var(--ink)]">
            Perch control room
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-[var(--ink-soft)]">
            Signed in as <span className="font-semibold text-[var(--ink)]">{user.email}</span>
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--brand-mint)] hover:text-[var(--ink)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-[var(--line)] pb-px">
        <Link
          href="/admin"
          className="rounded-t-lg px-3.5 py-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]"
        >
          Dashboard
        </Link>
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-t-lg px-3.5 py-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="py-8">{children}</div>
    </div>
  )
}
