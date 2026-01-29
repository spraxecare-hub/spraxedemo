import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { isBuildTime } from '@/lib/isBuildTime';
import CategoriesPageClient from '@/components/categories/categories-page-client';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Categories — Spraxe',
  description: 'Browse all Spraxe categories.',
  alternates: { canonical: '/categories' },
};

export default async function CategoriesPage() {
  if (isBuildTime) {
    return <CategoriesPageClient initialCategories={[]} />;
  }

  let supabase: ReturnType<typeof createServerSupabase>;
  try {
    supabase = createServerSupabase();
  } catch (e) {
    console.error('[categories] supabase not configured', e);
    return <CategoriesPageClient initialCategories={[]} />;
  }

  const { data } = await supabase
    .from('categories')
    .select('id,name,slug,parent_id,image_url,sort_order,is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(500);

  return <CategoriesPageClient initialCategories={(data || []) as any[]} />;
}
