import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import ProductDetailClient from '@/components/products/product-detail-client';
import { createServerSupabase, getSiteUrl } from '@/lib/supabase/server';

export const revalidate = 60;

type ProductRow = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  images: any;
  price: number | null;
  base_price: number | null;
  retail_price: number | null;
  stock_quantity: number | null;
  unit: string | null;
  supplier_name: string | null;
  tags: any;
  is_active: boolean;
  color_group_id?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  image_url: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

type RelatedProductRow = {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  base_price: number | null;
  retail_price: number | null;
  images: any;
  stock_quantity: number | null;
  is_featured: boolean | null;
  total_sales: number | null;
};

function tryCreateSupabase() {
  try {
    return createServerSupabase();
  } catch {
    return null;
  }
}

async function fetchProductUncached(slug: string): Promise<ProductRow | null> {
  const supabase = tryCreateSupabase();
  if (!supabase) return null;
  const res: { data: ProductRow | null; error: any } = await supabase
    .from('products')
    .select(
      'id,category_id,name,slug,description,sku,images,price,base_price,retail_price,stock_quantity,unit,supplier_name,tags,is_active,color_group_id,color_name,color_hex'
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (res.error) return null;
  return res.data ?? null;
}

async function fetchCategoryChainUncached(categoryId: string): Promise<CategoryRow[]> {
  const supabase = tryCreateSupabase();
  if (!supabase) return [];
  const chain: CategoryRow[] = [];
  let currentId: string | null = categoryId;
  let guard = 0;

  while (currentId && guard < 8) {
    guard++;
    const res: { data: CategoryRow | null; error: any } = await supabase
      .from('categories')
      .select('id,name,slug,parent_id,image_url,is_active,sort_order')
      .eq('id', currentId)
      .maybeSingle();
    if (res.error || !res.data) break;
    chain.unshift(res.data);
    currentId = res.data.parent_id ?? null;
  }

  return chain;
}

async function fetchRelatedProductsUncached(
  categoryId: string | null,
  excludeProductId: string
): Promise<RelatedProductRow[]> {
  if (!categoryId) return [];
  const supabase = tryCreateSupabase();
  if (!supabase) return [];
  const res: { data: RelatedProductRow[] | null; error: any } = await supabase
    .from('products')
    .select('id,name,slug,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales')
    .eq('is_active', true)
    .eq('category_id', categoryId)
    .neq('id', excludeProductId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (res.data || []) as RelatedProductRow[];
}

// ✅ Cache DB reads for faster slug pages + avoid duplicate queries
const fetchProduct = unstable_cache(fetchProductUncached, ['product-by-slug'], { revalidate: 60 });
const fetchCategoryChain = unstable_cache(fetchCategoryChainUncached, ['category-chain'], { revalidate: 60 });
const fetchRelatedProducts = unstable_cache(fetchRelatedProductsUncached, ['related-products'], { revalidate: 60 });

function firstImage(images: any): string | null {
  if (!images) return null;
  if (Array.isArray(images)) return images.find(Boolean) ?? null;
  if (typeof images === 'string') {
    const s = images.trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.find(Boolean) ?? null;
      } catch {}
    }
    if (s.includes(',')) return s.split(',').map((x) => x.trim()).find(Boolean) ?? null;
    return s || null;
  }
  return null;
}

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  if (!product) return { title: 'Product not found', robots: { index: false, follow: false } };

  const img = firstImage(product.images) || '/og.png';
  const description = stripHtml(String(product.description || '')).slice(0, 180) ||
    'Shop quality products at great prices with fast delivery across Bangladesh.';

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/products/${product.slug}`,
      images: [{ url: img }],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: [img],
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  try {

  const product = await fetchProduct(params.slug);
  if (!product) return notFound();

  const [categoryChain, related] = await Promise.all([
    product.category_id ? fetchCategoryChain(product.category_id) : Promise.resolve([]),
    fetchRelatedProducts(product.category_id, product.id),
  ]);

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/products/${product.slug}`;
  const img = firstImage(product.images);
  const price = Number(product.price ?? product.base_price ?? 0);
  const availability = (product.stock_quantity ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: stripHtml(String(product.description || '')),
    sku: product.sku || undefined,
    image: img ? [img] : undefined,
    brand: { '@type': 'Brand', name: 'Spraxe' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BDT',
      price: price ? String(price) : undefined,
      availability,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${getSiteUrl()}/` },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${getSiteUrl()}/products` },
      ...categoryChain.map((c, idx) => ({
        '@type': 'ListItem',
        position: 3 + idx,
        name: c.name,
        item: c.slug ? `${getSiteUrl()}/${encodeURIComponent(c.slug)}` : `${getSiteUrl()}/products`,
      })),
      {
        '@type': 'ListItem',
        position: 3 + categoryChain.length,
        name: product.name,
        item: `${getSiteUrl()}/products/${product.slug}`,
      },
    ],
  };


  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <ProductDetailClient
        params={params}
        initialProduct={product as any}
        initialCategoryChain={categoryChain as any}
        initialRelated={related as any}
      />
    </>
  );

} catch (e) {
  console.error('[product-detail] server render failed', e);
  // Render a simple not-found style UI to avoid crashing the stream.
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Product unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We couldn&apos;t load this product right now. Please try again.
      </p>
    </div>
  );
}
}
