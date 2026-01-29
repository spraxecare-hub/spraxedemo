import type { MetadataRoute } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { isBuildTime } from '@/lib/isBuildTime';

export const dynamic = 'force-dynamic';

// Canonical site URL (DO NOT rely on deployment hostname)
const SITE_URL =
  process.env.SITE_URL?.replace(/\/$/, '') || 'https://spraxe.com';

// Pages we want search engines to index
const INDEXABLE_PATHS: Array<{
  path: string;
  changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority?: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/products', changeFrequency: 'daily', priority: 0.9 },
  { path: '/categories', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/featured', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/compare', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/apple-accessories', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/usb-c-hubs-for-macbook', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/thunderbolt-docks', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/returns', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/faq', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/about', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/support', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/sell', changeFrequency: 'monthly', priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const urls: MetadataRoute.Sitemap = INDEXABLE_PATHS.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  // Avoid external calls during build
  if (isBuildTime) return urls;

  let supabase: ReturnType<typeof createServerSupabase> | null = null;
  try {
    supabase = createServerSupabase();
  } catch {
    return urls;
  }

  // Categories (/{categorySlug})
  try {
    let cats: any[] | null = null;

    const r = await supabase
      .from('categories')
      .select('slug,updated_at')
      .eq('is_active', true)
      .not('slug', 'is', null)
      .limit(2000);

    if (!r.error) cats = r.data;

    if (!cats) {
      const r2 = await supabase
        .from('categories')
        .select('slug')
        .eq('is_active', true)
        .not('slug', 'is', null)
        .limit(2000);
      cats = r2.data || null;
    }

    for (const row of cats || []) {
      if (!row?.slug) continue;
      urls.push({
        url: `${SITE_URL}/${row.slug}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch {
    // ignore
  }

  // Products (/products/{slug})
  try {
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const r = await supabase
        .from('products')
        .select('slug,updated_at')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .range(from, from + pageSize - 1);

      let data = r.data;
      let error = r.error;

      if (error) {
        const r2 = await supabase
          .from('products')
          .select('slug')
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .range(from, from + pageSize - 1);
        data = r2.data;
        error = r2.error;
      }

      if (error || !data || data.length === 0) break;

      for (const row of data) {
        if (!row?.slug) continue;
        urls.push({
          url: `${SITE_URL}/products/${row.slug}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : now,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }
  } catch {
    // ignore
  }

  return urls;
}
