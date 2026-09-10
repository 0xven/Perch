import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import process from 'node:process'

/**
 * Proxy - this is Next 16's `middleware.ts`. The middleware file convention is
 * deprecated and renamed to `proxy` in v16 (the function is `proxy`, not
 * `middleware`); see node_modules/next/dist/docs -> file-conventions/proxy.md.
 *
 * It does two things for /admin:
 *   1. Refreshes the Supabase auth cookie so sessions do not expire mid-edit.
 *   2. Redirects anyone without a session to /admin/login.
 *
 * This is an OPTIMISTIC check and NOT authorization. It only asks "is there a
 * valid session?", not "is this user an admin?" - deliberately, because proxy
 * runs on prefetches too and a DB round trip here would be wasteful. Real
 * authorization is requireAdmin() in every admin page/action, backed by RLS in
 * Postgres. See lib/supabase/admin-guard.ts.
 *
 * Scoped to /admin only: the rest of Perch is static/ISR and has no session to
 * refresh, so there is nothing to gain from running on those routes.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isLogin = request.nextUrl.pathname.startsWith('/admin/login')

  // Misconfigured env must fail closed: never let /admin through unauthenticated.
  if (!url || !anonKey) {
    console.error('[proxy] Supabase env vars missing - refusing /admin')
    return isLogin ? NextResponse.next() : redirectToLogin(request)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // getUser() (not getSession()) - it verifies the JWT against the Auth server
  // instead of trusting the cookie. Also refreshes the token when near expiry,
  // which is why the cookie plumbing above has to write back onto `response`.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isLogin) return redirectToLogin(request)

  return response
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/admin/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*'],
}
