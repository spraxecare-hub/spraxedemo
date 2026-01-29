import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabasePublicRead } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SafeImage } from '@/components/ui/safe-image';

// Fetch fresh posts so newly published items appear immediately.
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Spraxe blog posts and updates.',
  alternates: { canonical: '/blog' },
};

export default async function BlogIndexPage() {
  let posts: any[] = [];
  let supabaseOk = true;
  try {
    const supabase = createServerSupabasePublicRead();
    const { data } = await supabase
      .from('blogs')
      .select('id,title,slug,excerpt,cover_image_url,published_at,created_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);
    posts = (data || []) as any[];
  } catch {
    supabaseOk = false;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-10">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">Blog</h1>
              <p className="text-gray-600 mt-1">News, guides, and updates from Spraxe.</p>
            </div>
            <Link
              href="/products"
              className="text-sm font-semibold text-blue-900 hover:underline"
            >
              Browse products
            </Link>
          </div>

          {!supabaseOk ? (
            <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
              Blog database is not configured yet. Configure Supabase env vars to publish posts.
            </div>
          ) : null}

          {posts.length === 0 ? (
            <div className="bg-white border rounded-2xl p-8 text-center text-gray-600">
              No posts yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  <div className="relative aspect-[16/9] bg-gray-100">
                    {p.cover_image_url ? (
                      <SafeImage
                        src={p.cover_image_url}
                        alt={p.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="text-xs text-gray-500 mb-2">
                      {p.published_at ? new Date(p.published_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-lg font-bold text-gray-900 group-hover:text-blue-900 line-clamp-2">
                      {p.title}
                    </div>
                    {p.excerpt ? (
                      <div className="text-sm text-gray-600 mt-2 line-clamp-3">{p.excerpt}</div>
                    ) : null}
                    <div className="text-sm font-semibold text-blue-900 mt-4">Read more →</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
