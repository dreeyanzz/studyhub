import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Next 16 refuses to optimize images from local IP addresses unless this is set, so
    // the local stack's photos (127.0.0.1:54321) showed as broken images under `next dev`,
    // which Playwright also uses. Development only: production reads *.supabase.co.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
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
