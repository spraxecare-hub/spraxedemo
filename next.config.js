/** @type {import('next').NextConfig} */

const disableImageOptimization = process.env.RENDER === 'true' || process.env.DISABLE_IMAGE_OPTIMIZATION === '1';

// Automatically allow the current Supabase project host for Next/Image.
// This keeps images fast even if you change Supabase projects between environments.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseHost = '';
try {
  if (supabaseUrl) supabaseHost = new URL(supabaseUrl).hostname;
} catch {
  // ignore
}

const baseRemotePatterns = [
  {
    protocol: 'https',
    hostname: 'images.pexels.com',
    port: '',
    pathname: '/**',
  },
  // Supabase Storage (public bucket)
  {
    protocol: 'https',
    hostname: 'kybgrsqqvejbvjediowo.supabase.co',
    port: '',
    pathname: '/storage/v1/object/public/**',
  },
];

if (supabaseHost) {
  baseRemotePatterns.push({
    protocol: 'https',
    hostname: supabaseHost,
    port: '',
    pathname: '/storage/v1/object/public/**',
  });
}

const imageDomains = ['images.pexels.com'];
if (supabaseHost) imageDomains.push(supabaseHost);

const nextConfig = {
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Enable Next.js Image Optimization (recommended for Vercel)
    unoptimized: disableImageOptimization,
    formats: ['image/avif', 'image/webp'],

    // Cache optimized images longer (helps perceived performance)
    minimumCacheTTL: 60 * 60 * 24 * 30,

    // External domains
    domains: imageDomains,

    // Remote patterns (Supabase + other allowlisted sources)
    remotePatterns: baseRemotePatterns,
  },

  // Smaller client bundles where possible.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Trim noisy client console logs in production bundles.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  // Redirect legacy auth route
  async redirects() {
    return [
      {
        source: '/auth/login',
        destination: '/login',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
