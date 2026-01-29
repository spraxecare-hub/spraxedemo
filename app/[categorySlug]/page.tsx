import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ProductsPageClient from '@/components/products/products-page-client';
import { createServerSupabase, getSiteUrl } from '@/lib/supabase/server';

// Cache category listings briefly for speed while still staying fresh.
export const revalidate = 60;

type SearchParams = Record<string, string | string[] | undefined>;

type PriceRangeKey =
  | 'all'
  | 'under-500'
  | '500-1000'
  | '1000-2000'
  | '2000-5000'
  | 'over-5000';

const PRICE_OPTIONS: Record<PriceRangeKey, { min?: number; max?: number }> = {
  all: {},
  'under-500': { max: 499.999 },
  '500-1000': { min: 500, max: 1000 },
  '1000-2000': { min: 1000, max: 2000 },
  '2000-5000': { min: 2000, max: 5000 },
  'over-5000': { min: 5000.001 },
};

function onlyCleanSearch(s: string) {
  return s.trim().replace(/[%_]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

function safeInt(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function safeCsvList(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((x) => decodeURIComponent(x).trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: { params: { categorySlug: string } }): Promise<Metadata> {
  const site = getSiteUrl();
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from('categories')
      .select('name,slug,image_url')
      .eq('slug', params.categorySlug)
      .eq('is_active', true)
      .maybeSingle();

    const title = data?.name ? String(data.name) : 'Products';
    const canonical = `/${encodeURIComponent(data?.slug || params.categorySlug)}`;
    const image = (data as any)?.image_url || `${site}/og.png`;
    const description = data?.name
      ? `Browse ${data.name} on Spraxe Bangladesh. Fast delivery, warranty support, and secure checkout.`
      : 'Browse products on Spraxe Bangladesh. Fast delivery and warranty support.';

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: `${site}${canonical}`,
        images: [{ url: image }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch {
    // If Supabase is not configured, still return stable metadata.
    const canonical = `/${encodeURIComponent(params.categorySlug)}`;
    return {
      title: 'Products',
      description: 'Browse products on Spraxe Bangladesh.',
      alternates: { canonical },
      openGraph: {
        title: 'Products',
        description: 'Browse products on Spraxe Bangladesh.',
        url: `${site}${canonical}`,
        images: [{ url: `${site}/og.png` }],
      },
      robots: { index: true, follow: true },
    };
  }
}

function buildCategoryChain(categories: any[], current: any) {
  const chain: any[] = [];
  let cur = current;
  let guard = 0;
  while (cur && guard < 10) {
    guard++;
    chain.unshift(cur);
    if (!cur.parent_id) break;
    cur = categories.find((c) => c.id === cur.parent_id);
  }
  return chain;
}

export default async function CategoryProductsPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams: SearchParams;
}) {
  let supabase: ReturnType<typeof createServerSupabase>;
  try {
    supabase = createServerSupabase();
  } catch (e) {
    console.error('[category] supabase not configured', e);
    return (
      <Suspense fallback={null}>
        <ProductsPageClient
          initialProducts={[] as any}
          initialTotalProducts={0}
          initialCategories={[] as any}
          initialSupplierOptions={[]}
          initialTagOptions={[]}
        />
      </Suspense>
    );
  }

  const search = typeof searchParams.search === 'string' ? searchParams.search : '';
  const price = typeof searchParams.price === 'string' ? (searchParams.price as PriceRangeKey) : 'all';
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'newest';
  const inStockOnly = searchParams.stock === '1';
  const featuredOnly = searchParams.featured === '1';
  const suppliers = safeCsvList(typeof searchParams.suppliers === 'string' ? searchParams.suppliers : undefined);
  const tags = safeCsvList(typeof searchParams.tags === 'string' ? searchParams.tags : undefined);
  const perPage = [12, 24, 48].includes(safeInt(typeof searchParams.per === 'string' ? searchParams.per : undefined, 12))
    ? safeInt(typeof searchParams.per === 'string' ? searchParams.per : undefined, 12)
    : 12;
  const page = safeInt(typeof searchParams.page === 'string' ? searchParams.page : undefined, 1);

  try {
  // Categories (sidebar)
  const { data: categoriesData } = await supabase
    .from('categories')
    .select('id,name,slug,parent_id,image_url,sort_order,is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const categories = (categoriesData || []) as any[];

  const currentCategory = categories.find((c) => c.slug === params.categorySlug);
  if (!currentCategory) return notFound();

  const site = getSiteUrl();
  const chain = buildCategoryChain(categories, currentCategory);
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${site}/products` },
      ...chain.map((c, idx) => ({
        '@type': 'ListItem',
        position: 3 + idx,
        name: c.name,
        item: c.slug ? `${site}/${encodeURIComponent(c.slug)}` : `${site}/products`,
      })),
    ],
  };

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: currentCategory.name,
    url: `${site}/${encodeURIComponent(currentCategory.slug)}`,
    isPartOf: { '@type': 'WebSite', name: 'Spraxe Bangladesh', url: site },
  };

  const getCategoryIdsForFilter = (catId: string): string[] => {
    const current = categories.find((c) => c.id === catId);
    if (!current) return [catId];
    if (!current.parent_id) {
      const children = categories.filter((c) => c.parent_id === current.id).map((c) => c.id);
      return children.length ? [current.id, ...children] : [current.id];
    }
    return [current.id];
  };

  // Supplier/tag options (RPC preferred)
  let supplierOptions: string[] = [];
  let tagOptions: string[] = [];
  const rpcRes = await supabase.rpc('get_product_filter_options');
  if (!rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
    const row: any = rpcRes.data[0];
    supplierOptions = Array.isArray(row?.suppliers) ? row.suppliers.filter(Boolean) : [];
    tagOptions = Array.isArray(row?.tags) ? row.tags.filter(Boolean) : [];
  }

  // Products
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * perPage;
  const to = from + perPage - 1;
  const cleanSearch = onlyCleanSearch(search);
  const priceRange = PRICE_OPTIONS[price] || {};

  let query = supabase
    .from('products')
    .select(
      'id,name,slug,category_id,description,sku,supplier_name,tags,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex',
      { count: 'exact' }
    )
    .eq('is_active', true)
      .is('color_name', null)
    .eq('approval_status', 'approved');

  // Category (slug route always filters)
  const ids = getCategoryIdsForFilter(currentCategory.id);
  query = ids.length > 1 ? query.in('category_id', ids) : query.eq('category_id', ids[0]);

  if (cleanSearch) query = query.or(`name.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%`);
  if (inStockOnly) query = query.gt('stock_quantity', 0);
  if (featuredOnly) query = query.eq('is_featured', true);
  if (suppliers.length) query = query.in('supplier_name', suppliers);
  if (tags.length) query = query.contains('tags', tags as any);
  if (priceRange.min != null) query = query.gte('price', priceRange.min);
  if (priceRange.max != null) query = query.lte('price', priceRange.max);

  if (sort === 'newest') query = query.order('created_at', { ascending: false });
  if (sort === 'best-selling') query = query.order('total_sales', { ascending: false, nullsFirst: false });
  if (sort === 'price-asc') query = query.order('price', { ascending: true });
  if (sort === 'price-desc') query = query.order('price', { ascending: false });
  if (sort === 'name-asc') query = query.order('name', { ascending: true });
  if (sort === 'name-desc') query = query.order('name', { ascending: false });

  query = query.range(from, to);
  const { data: products, count } = await query;

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <Suspense fallback={null}>
        <ProductsPageClient
          initialProducts={(products || []) as any}
          initialTotalProducts={count || 0}
          initialCategories={categories as any}
          initialSupplierOptions={supplierOptions}
          initialTagOptions={tagOptions}
          forcedCategoryId={currentCategory.id}
        />
      </Suspense>
    </>
  );

  } catch (e) {
    console.error('[category] server render failed', e);
    return (
      <Suspense fallback={null}>
        <ProductsPageClient
          initialProducts={[] as any}
          initialTotalProducts={0}
          initialCategories={[] as any}
          initialSupplierOptions={[]}
          initialTagOptions={[]}
        />
      </Suspense>
    );
  }
}
