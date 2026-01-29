import type { Metadata } from 'next';
import HomePageClient from '@/components/home/home-page-client';
import { createServerSupabase } from '@/lib/supabase/server';
import { isBuildTime } from '@/lib/isBuildTime';

// Home can be cached briefly for speed while still staying fresh.
// (Supabase reads are public and don't depend on user-specific cookies.)
export const revalidate = 60;


export const metadata: Metadata = {
  title: 'Spraxe — Shop Online in Bangladesh',
  description:
    'Shop quality products at great prices with fast delivery across Bangladesh.',
  alternates: { canonical: '/' },
};

// 1) DEFINE MAIN CATEGORIES TO SHOW (mirrors client)
const TARGET_CATEGORIES = [
  "Women’s Fashion",
  "Man’s Fashion",
  "Laptop & Computer Accessories",
  "Gadgets",
  "Headphone",
  "Watches",
  "CCTV Camera",
  "Home Appliances",
  "Home Electronics",
  "Home Decor & Textile",
];

export default async function HomePage() {
  if (isBuildTime) {
    // Build-time: avoid external fetches.
    return (
      <HomePageClient
        initialProducts={[]}
        initialNewArrivals={[]}
        initialCategories={[]}
        initialFeaturedImages={[]}
        initialBestSellers={[]}
        initialBestSellerSoldMap={{}}
        initialHomeMidBanner={null}
      />
    );
  }

  let supabase: ReturnType<typeof createServerSupabase>;
  try {
    supabase = createServerSupabase();
  } catch (e) {
    console.error('[home] supabase not configured', e);
    return (
      <HomePageClient
        initialProducts={[]}
        initialNewArrivals={[]}
        initialCategories={[]}
        initialFeaturedImages={[]}
        initialBestSellers={[]}
        initialBestSellerSoldMap={{}}
        initialHomeMidBanner={null}
      />
    );
  }
  // Featured products, categories, hero images
  const [productsRes, categoriesRes, featuredRes, newArrivalsRes, bannerRes] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
      .eq('is_active', true)
      .is('color_name', null)
      .eq('is_featured', true)
      .limit(12),
    supabase
      .from('categories')
      .select('id,name,slug,parent_id,image_url,sort_order,is_active')
      .eq('is_active', true)
      .limit(200),
    supabase
      .from('featured_images')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex,created_at')
      .eq('is_active', true)
      .is('color_name', null)
      .order('created_at', { ascending: false })
      .limit(16),
    supabase
      .from('site_settings')
      .select('key,value')
      .eq('key', 'home_mid_banner')
      .maybeSingle(),
  ]);

  const featuredProducts = (productsRes.data || []) as any[];
  const allCategories = (categoriesRes.data || []) as any[];
  const featuredImages = (featuredRes.data || []) as any[];
  const newArrivals = (newArrivalsRes.data || []) as any[];
  const homeMidBanner = (bannerRes.data as any)?.value ?? null;

  // Categories: match exact list & keep their order
  const sortMap = new Map(TARGET_CATEGORIES.map((name, i) => [name.toLowerCase(), i]));
  const categories = allCategories
    .filter((cat) =>
      TARGET_CATEGORIES.some((t) => t.toLowerCase() === String(cat.name || '').toLowerCase())
    )
    .sort((a, b) => {
      const ia = sortMap.get(String(a.name || '').toLowerCase()) ?? 999;
      const ib = sortMap.get(String(b.name || '').toLowerCase()) ?? 999;
      return ia - ib;
    });

  // Best sellers: use RPC if available, fallback to products.total_sales
  let bestSellers: any[] = [];
  let soldMap: Record<string, number> = {};

  const soldRes = await supabase.rpc('get_best_sellers', { limit_count: 12 });
  if (soldRes.error) {
    const fallback = await supabase
      .from('products')
      .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
      .eq('is_active', true)
      .is('color_name', null)
      .order('total_sales', { ascending: false })
      .limit(12);
    bestSellers = (fallback.data || []) as any[];
  } else {
    const rows = (soldRes.data || []) as Array<{ product_id: string; sold_qty: number }>;
    const topIds = rows.map((r) => {
      soldMap[r.product_id] = Number(r.sold_qty || 0);
      return r.product_id;
    });

    if (topIds.length) {
      const topProducts = await supabase
        .from('products')
        .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
        .in('id', topIds)
        .eq('is_active', true)
      .is('color_name', null);

      const map = new Map((topProducts.data || []).map((p: any) => [p.id, p]));
      bestSellers = topIds.map((id) => map.get(id)).filter(Boolean) as any[];
    }
  }

  return (
    <HomePageClient
      initialProducts={featuredProducts as any}
      initialNewArrivals={newArrivals as any}
      initialCategories={categories as any}
      initialFeaturedImages={featuredImages}
      initialBestSellers={bestSellers as any}
      initialBestSellerSoldMap={soldMap}
      initialHomeMidBanner={homeMidBanner}
    />
  );
}