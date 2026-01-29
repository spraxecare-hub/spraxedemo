import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/supabase/server';

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep transactional / private areas out of the index.
      disallow: [
        '/api/',
        '/admin/',
        '/seller/',
        '/dashboard/',
        '/cart',
        '/wishlist',
        '/track-order',
        '/login',
        '/register',
      ],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
