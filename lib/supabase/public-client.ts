import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import process from 'node:process'

/**
 * Cookie-less Supabase client for PUBLIC reads.
 *
 * Why this exists rather than reusing lib/supabase/server.ts: that client reads
 * cookies(), which opts the calling route into dynamic rendering. The public
 * pages here (the 97 destination pages, /kashmir) are statically generated with
 * ISR - that is what makes the site fast and free - so a cookie-reading client
 * at the top level of those pages would quietly turn every one of them dynamic.
 *
 * These reads need no session: they hit tables whose RLS grants SELECT to
 * anon. Writes must never use this client - they go through the authenticated
 * server client so RLS can see auth.uid().
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
