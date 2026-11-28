import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const isLocalSupabase = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(
  supabaseUrl,
)

const nextConfig: NextConfig = {
  images: {
    // Next 16 refuses to optimize images from local IP addresses unless this is set, so
    // the local stack's photos (127.0.0.1:54321) would break under `next dev` or a
    // production build aimed at the local stack (Playwright in CI). Real deployments
    // point NEXT_PUBLIC_SUPABASE_URL at https://*.supabase.co, keeping this false.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development' || isLocalSupabase,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
