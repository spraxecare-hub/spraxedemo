'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SafeImage } from '@/components/ui/safe-image';
import { Input } from '@/components/ui/input';
import { Package, Search } from 'lucide-react';

type AnyCategory = {
  id: string | number;
  name: string;
  slug: string;
  parent_id?: string | null;
  image_url?: string | null;
  sort_order?: number | null;
};

export default function CategoriesPageClient({
  initialCategories,
}: {
  initialCategories: AnyCategory[];
}) {
  const [q, setQ] = useState('');

  const { parents, subs } = useMemo(() => {
    const list = Array.isArray(initialCategories) ? initialCategories : [];
    const normalized = list
      .filter((c) => c && c.slug && c.name)
      .map((c) => ({
        ...c,
        sort_order: Number(c.sort_order ?? 9999),
        name: String(c.name),
        slug: String(c.slug),
        parent_id: (c as any).parent_id ?? null,
      }));

    const bySortThenName = (a: AnyCategory, b: AnyCategory) => {
      const sa = Number(a.sort_order ?? 9999);
      const sb = Number(b.sort_order ?? 9999);
      if (sa !== sb) return sa - sb;
      return String(a.name).localeCompare(String(b.name));
    };

    const parents = normalized.filter((c) => !c.parent_id).sort(bySortThenName);
    const subs = normalized.filter((c) => !!c.parent_id).sort(bySortThenName);
    return { parents, subs };
  }, [initialCategories]);

  const filteredParents = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return parents;
    return parents.filter((c) => c.name.toLowerCase().includes(needle));
  }, [parents, q]);

  const filteredSubs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return subs;
    return subs.filter((c) => c.name.toLowerCase().includes(needle));
  }, [subs, q]);

  const hasSearch = q.trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Categories</h1>
            <p className="text-sm text-gray-600 mt-1">
              Browse categories the same way you do on the homepage.
            </p>
          </div>

          <div className="w-full md:w-[420px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search categories..."
                className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>
        </div>

        {/* Main categories (bubble cards like homepage) */}
        <section className="mt-8">
          <h2 className="text-lg font-extrabold text-gray-900">Main Categories</h2>
          <p className="text-sm text-gray-600 mt-1">Tap a category to view products.</p>

          <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {filteredParents.map((cat) => {
              return (
                <Link
                  key={String(cat.id)}
                  href={`/${cat.slug}`}
                  className="group text-center"
                  aria-label={`Open ${cat.name}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden relative border-2 border-red-500 bg-white shadow-sm ring-1 ring-red-500/20 group-hover:ring-red-500/40 group-hover:border-red-600 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all"
                    >
                      {cat.image_url ? (
                        <div className="relative w-full h-full p-3 md:p-3.5">
                          <SafeImage
                            src={cat.image_url}
                            alt={cat.name}
                            fill
                            sizes="96px"
                            className="object-contain object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-blue-700 leading-tight line-clamp-2 px-1">
                      {cat.name}
                    </div>
                  </div>
                </Link>
              );
            })}

            {filteredParents.length === 0 && (
              <div className="col-span-full text-center text-sm text-gray-600 py-10">
                No categories found.
              </div>
            )}
          </div>
        </section>

        {/* Subcategories (same bubble style when searching) */}
        {(hasSearch || filteredSubs.length > 0) && (
          <section className="mt-10">
            <h2 className="text-lg font-extrabold text-gray-900">Subcategories</h2>
            <p className="text-sm text-gray-600 mt-1">
              {hasSearch ? 'Matching subcategories' : 'All subcategories'}
            </p>

            <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {filteredSubs.map((cat) => {
                return (
                  <Link
                    key={String(cat.id)}
                    href={`/${cat.slug}`}
                    className="group text-center"
                    aria-label={`Open ${cat.name}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden relative border-2 border-red-500 bg-white shadow-sm ring-1 ring-red-500/20 group-hover:ring-red-500/40 group-hover:border-red-600 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all"
                      >
                        {cat.image_url ? (
                          <div className="relative w-full h-full p-3 md:p-3.5">
                            <SafeImage
                              src={cat.image_url}
                              alt={cat.name}
                              fill
                              sizes="96px"
                              className="object-contain object-center group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-blue-700 leading-tight line-clamp-2 px-1">
                        {cat.name}
                      </div>
                    </div>
                  </Link>
                );
              })}
              {filteredSubs.length === 0 && (
                <div className="col-span-full text-center text-sm text-gray-600 py-8">
                  {hasSearch ? 'No matching subcategories.' : 'No subcategories found.'}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
