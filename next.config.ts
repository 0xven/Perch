import type { NextConfig } from 'next'
import process from 'node:process'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Content Security Policy.
 * - script-src allows 'unsafe-inline' because the App Router emits inline
 *   hydration scripts (a nonce-based CSP would need middleware); 'unsafe-eval'
 *   is dev-only (Turbopack/HMR).
 * - connect-src https: covers Supabase + OpenFreeMap tile/glyph/sprite fetches;
 *   ws/wss are dev-only for HMR.
 * - worker-src blob: + img-src blob: are required by MapLibre GL.
 * - frame-src is the ONLY place trip-log video embeds are allowed to load from.
 *   Admin video URLs are already parsed against an allowlist before they are
 *   stored (lib/validations/admin.ts); this is the belt to that pair of braces.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "font-src 'self' data:",
  `connect-src 'self' https:${isDev ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  'frame-src https://www.youtube.com https://player.vimeo.com',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

/**
 * Supabase Storage host for next/image, derived from the env var rather than
 * hardcoded - the project ref is not committed to the repo.
 * Scoped to the public `media` bucket so the image optimiser cannot be pointed
 * at anything else on the origin.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseImagePattern = supabaseUrl
  ? [
      {
        protocol: 'https' as const,
        hostname: new URL(supabaseUrl).hostname,
        port: '',
        pathname: '/storage/v1/object/public/media/**',
        search: '',
      },
    ]
  : []

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS only in production - never pin localhost to https.
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Catalogue photos are downloaded + self-hosted under public/dest-images/
  // (see scripts/fetch-destination-images.ts), so they need no remote pattern.
  // The one remote source is our own Supabase `media` bucket, which holds what
  // the owner uploads through /admin.
  images: {
    remotePatterns: supabaseImagePattern,
  },
  headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
