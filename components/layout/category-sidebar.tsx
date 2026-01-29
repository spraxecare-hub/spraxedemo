'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/safe-image';
import { supabase } from '@/lib/supabase/client';
import { Category } from '@/lib/supabase/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, X, ChevronDown, ChevronRight, Search } from 'lucide-react';

interface CategorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}


type CategoryLite = Pick<
  Category,
  'id' | 'name' | 'slug' | 'parent_id' | 'image_url' | 'sort_order' | 'is_active'
> & {
  // Optional fields that exist in the DB but aren't always needed in the sidebar UI
  description?: Category['description'] | null;
  created_at?: Category['created_at'] | null;
};

type CatNode = CategoryLite & { children: CategoryLite[] };
export function CategorySidebar({ isOpen, onClose }: CategorySidebarProps) {
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded parent category
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Search
  const [query, setQuery] = useState('');

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click + ESC + body scroll lock
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const fetchCategories = async () => {
    setLoading(true);
    const res: { data: CategoryLite[] | null; error: any } = await supabase
      .from('categories')
      .select('id,name,slug,parent_id,image_url,sort_order,is_active,description,created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (!res.error && res.data) setCategories(res.data);
    setLoading(false);
  };

  const toggleCategory = (id: string) => {
    setExpandedCategory((prev) => (prev === id ? null : id));
  };

  // Build parent->children tree
  const tree = useMemo<CatNode[]>(() => {
    const parents = categories.filter((c) => !c.parent_id);
    const childrenByParent = new Map<string, CategoryLite[]>();

    for (const c of categories) {
      if (!c.parent_id) continue;
      const pid = String(c.parent_id);
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(c);
    }

    return parents.map((p) => ({
      ...p,
      children: (childrenByParent.get(String(p.id)) || []).sort((a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
      ),
    }));
  }, [categories]);

  const q = query.trim().toLowerCase();

  // Filter tree by query (keeps parent if parent matches OR any child matches)
  const filteredTree = useMemo(() => {
    if (!q) return tree;
    return tree
      .map((p) => {
        const parentMatch = (p.name || '').toLowerCase().includes(q);
        const matchingChildren = (p.children || []).filter((c) =>
          (c.name || '').toLowerCase().includes(q)
        );
        if (parentMatch) return { ...p, children: p.children };
        if (matchingChildren.length) return { ...p, children: matchingChildren };
        return null;
      })
      .filter(Boolean) as CatNode[];
  }, [tree, q]);

  // If searching, auto-expand all parents that have child matches
  useEffect(() => {
    if (!q) return;
    if (filteredTree.length === 1) {
      setExpandedCategory(String(filteredTree[0].id));
    } else {
      setExpandedCategory(null);
    }
  }, [q, filteredTree]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={sidebarRef}
        role="dialog"
        aria-modal="true"
        aria-label="Category menu"
        className={`
          fixed top-0 left-0 z-50 h-full w-[340px] max-w-[90vw]
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full bg-white shadow-2xl border-r border-gray-100 flex flex-col">
          {/* Header */}
          <div className="px-4 py-4 border-b bg-gradient-to-b from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 leading-tight">Shop by Category</h2>
                <p className="text-xs text-gray-500 mt-0.5">Find products faster</p>
              </div>

              <button
                onClick={onClose}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
                aria-label="Close category sidebar"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Search */}
            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm
                             outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              {loading ? (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl border bg-gray-50 animate-pulse" />
                  ))}
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="mt-3 font-semibold text-gray-900">No categories found</div>
                  <div className="text-sm text-gray-500 mt-1">Try a different keyword.</div>
                  {q && (
                    <button
                      onClick={() => setQuery('')}
                      className="mt-4 text-sm font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTree.map((parent) => {
                    const hasChildren = (parent.children || []).length > 0;
                    const isExpanded = expandedCategory === String(parent.id);

                    return (
                      <div key={String(parent.id)} className="rounded-xl border border-gray-100 overflow-hidden">
                        {/* Parent row */}
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleCategory(String(parent.id))}
                            className={cnBtn(
                              'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left',
                              isExpanded ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <IconBlock category={parent} />
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{parent.name}</div>
                              </div>
                            </div>

                            <div className="text-gray-400 shrink-0">
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                          </button>
                        ) : (
                          <Link
                            href={`/${parent.slug}`}
                            onClick={onClose}
                            className={cnBtn('flex items-center gap-3 px-3 py-3 hover:bg-gray-50')}
                          >
                            <IconBlock category={parent} />
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{parent.name}</div>
                            </div>
                          </Link>
                        )}

                        {/* Children */}
                        {hasChildren && isExpanded && (
                          <div className="bg-white px-3 pb-3">
                            <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-2">
                              <div className="space-y-1">
                                {parent.children.map((child) => (
                                  <Link
                                    key={String(child.id)}
                                    href={`/${child.slug}`}
                                    onClick={onClose}
                                    className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-white hover:shadow-sm hover:text-blue-700 transition"
                                  >
                                    {child.name}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t bg-white p-3">
            <Link
              href="/products"
              onClick={onClose}
              className="w-full inline-flex items-center justify-center rounded-xl bg-blue-900 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 transition"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function cnBtn(...classes: Array<string | boolean | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function IconBlock({ category }: { category: CategoryLite }) {
  return (
    <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
      {category.image_url ? (
        <SafeImage src={category.image_url} alt={category.name} width={44} height={44} className="w-full h-full object-cover" />
      ) : (
        <Package className="w-5 h-5 text-blue-900" />
      )}
    </div>
  );
}
