import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { dedupeByColorGroup } from '@/lib/utils/product-dedupe';

export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ products: [], categories: [] }, { status: 200 });
  }

  let supabase: ReturnType<typeof createServerSupabase>;
  try {
    supabase = createServerSupabase();
  } catch {
    // Supabase not configured — return empty suggestions rather than 500.
    return NextResponse.json({ products: [], categories: [] }, { status: 200 });
  }
  const like = `%${q}%`;

  const [productsRes, categoriesRes] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,slug,category_id,price,retail_price,images,stock_quantity,supplier_name,sku,tags,color_group_id,color_name,color_hex')
      .eq('is_active', true)
      .is('color_name', null)
      .or(`name.ilike.${like},sku.ilike.${like}`)
      .order('is_featured', { ascending: false })
      .order('total_sales', { ascending: false })
      .limit(6),
    supabase
      .from('categories')
      .select('id,name,slug')
      .eq('is_active', true)
      .ilike('name', like)
      .order('sort_order', { ascending: true })
      .limit(5),
  ]);

  const deduped = dedupeByColorGroup((productsRes.data || []) as any[]);

  const products = (deduped || []).map((p: any) => {
    const images = p.images;
    const primary = Array.isArray(images) ? images.find(Boolean) : null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price ?? null,
      retail_price: p.retail_price ?? null,
      image: primary,
      stock_quantity: p.stock_quantity ?? null,
      supplier_name: p.supplier_name ?? null,
      sku: p.sku ?? null,
      tags: Array.isArray(p.tags) ? p.tags : [],
    };
  });

  const categories = (categoriesRes.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  return NextResponse.json(
    { products, categories },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
