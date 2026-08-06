import { unstable_rethrow } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { OverrideMap } from '@/lib/queries/destination-overrides'
import type { DestinationOverride, Post, TripMedia, TripReportAdmin } from '@/lib/types/database'

/** A moderation-queue row: the report plus what it contains. */
export interface AdminTripReport extends TripReportAdmin {
  itemCount: number
  photoCount: number
  kinds: string[]
}

/**
 * Reads for the admin panel.
 *
 * These use the AUTHENTICATED server client (not the public one) on purpose:
 * the posts RLS policy is `published = true or is_admin()`, so only a request
 * carrying the admin's session can see drafts. Callers must still have passed
 * requireAdmin() - these functions do not authorize anything by themselves,
 * they just read what the caller's own session is allowed to read.
 *
 * Same house rule as the public queries: never throw, return empty on failure.
 */

/** Every media row for a trip, admin-ordered (day, then sort). */
export async function getAllTripMedia(tripSlug = 'kashmir'): Promise<TripMedia[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('trip_media')
      .select('*')
      .eq('trip_slug', tripSlug)
      .order('day', { ascending: true, nullsFirst: false })
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin] trip_media query error:', error.message)
      return []
    }
    return (data as TripMedia[]) ?? []
  } catch (e) {
    unstable_rethrow(e)
    console.error('[getAllTripMedia] unexpected error:', e)
    return []
  }
}

/** Every post including drafts. Requires an admin session for the drafts. */
export async function getAllPosts(): Promise<Post[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[admin] posts query error:', error.message)
      return []
    }
    return (data as Post[]) ?? []
  } catch (e) {
    unstable_rethrow(e)
    console.error('[getAllPosts] unexpected error:', e)
    return []
  }
}

/** Every destination override, keyed by slug. */
export async function getAllOverrides(): Promise<OverrideMap> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('destination_overrides').select('*')

    if (error) {
      console.error('[admin] destination_overrides query error:', error.message)
      return {}
    }
    const map: OverrideMap = {}
    for (const o of (data ?? []) as DestinationOverride[]) map[o.slug] = o
    return map
  } catch (e) {
    unstable_rethrow(e)
    console.error('[getAllOverrides] unexpected error:', e)
    return {}
  }
}

/**
 * Every trip report, drafts included, with contact_email.
 *
 * Two reads, because the email is deliberately not reachable any other way:
 *
 *   - The rows come from trip_reports_public, the same view the public site
 *     uses. It is security_invoker, so this session's own RLS applies and the
 *     `or public.is_admin()` arm of the read policy is what makes the drafts
 *     visible here and nowhere else.
 *   - The addresses come from trip_report_contacts(), a security-definer
 *     function whose body is `where public.is_admin()`. Migration 006 grants
 *     the contact_email COLUMN to no role at all, so there is no `select *`
 *     anywhere - including this one - that could return it by accident. For a
 *     signed-in non-admin the RPC returns nothing and the emails are simply
 *     absent.
 */
export async function getAllTripReports(): Promise<AdminTripReport[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('trip_reports_public')
      .select('*')
      .order('published', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[admin] trip_reports query error:', error.message)
      return []
    }

    const rows = (data as Omit<TripReportAdmin, 'contact_email'>[]) ?? []
    if (rows.length === 0) return []

    const ids = rows.map((r) => r.id)
    const [{ data: items }, { data: media }, { data: contacts }] = await Promise.all([
      supabase.from('trip_report_items').select('report_id, kind').in('report_id', ids),
      supabase.from('trip_report_media').select('report_id, url').in('report_id', ids),
      supabase.rpc('trip_report_contacts'),
    ])

    const emailById = new Map<string, string | null>()
    for (const c of (contacts ?? []) as { report_id: string; email: string | null }[]) {
      emailById.set(c.report_id, c.email)
    }

    const reports: TripReportAdmin[] = rows.map((r) => ({
      ...r,
      contact_email: emailById.get(r.id) ?? null,
    }))

    const agg = new Map<string, { kinds: Set<string>; items: number; photos: number }>()
    const bump = (id: string) =>
      agg.get(id) ?? agg.set(id, { kinds: new Set<string>(), items: 0, photos: 0 }).get(id)!

    for (const i of (items ?? []) as { report_id: string; kind: string }[]) {
      const a = bump(i.report_id)
      a.items += 1
      a.kinds.add(i.kind)
    }
    for (const m of (media ?? []) as { report_id: string }[]) {
      bump(m.report_id).photos += 1
    }

    return reports.map((r) => {
      const a = agg.get(r.id)
      return {
        ...r,
        itemCount: a?.items ?? 0,
        photoCount: a?.photos ?? 0,
        kinds: a ? [...a.kinds] : [],
      }
    })
  } catch (e) {
    unstable_rethrow(e)
    console.error('[getAllTripReports] unexpected error:', e)
    return []
  }
}
