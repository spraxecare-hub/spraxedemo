'use client';

type CategoryLite = Pick<
  Category,
  'id' | 'name' | 'slug' | 'parent_id' | 'image_url' | 'sort_order' | 'is_active'
> & {
  description?: Category['description'] | null;
  created_at?: Category['created_at'] | null;
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/safe-image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Product, Category } from '@/lib/supabase/types';
import { dedupeByColorGroup } from '@/lib/utils/product-dedupe';
import { useCart } from '@/lib/cart/cart-context';
import { useWishlist } from '@/lib/wishlist/wishlist-context';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingCart,
  Package,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Filter,
  X,
  RotateCcw,
  LayoutGrid,
  Rows3,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
Heart,
} from 'lucide-react';

// If your generated Product type doesn't include these columns, we extend it safely:
type ProductEx = Product & {
  supplier_name?: string | null;
  tags?: any; // could be string[], json, or string
  is_featured?: boolean | null;
  total_sales?: number | null;
  approval_status?: string | null;
};

type PriceRangeKey = 'all' | 'under-500' | '500-1000' | '1000-2000' | '2000-5000' | 'over-5000';
type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'best-selling';
type ViewMode = 'grid' | 'compact';

const PRICE_OPTIONS: Array<{ value: PriceRangeKey; label: string; min?: number; max?: number }> = [
  { value: 'all', label: 'All Prices' },
  { value: 'under-500', label: 'Under ৳500', max: 499.999 },
  { value: '500-1000', label: '৳500 - ৳1,000', min: 500, max: 1000 },
  { value: '1000-2000', label: '৳1,000 - ৳2,000', min: 1000, max: 2000 },
  { value: '2000-5000', label: '৳2,000 - ৳5,000', min: 2000, max: 5000 },
  { value: 'over-5000', label: 'Over ৳5,000', min: 5000.001 },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'best-selling', label: 'Best Selling' },
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'name-asc', label: 'Name: A → Z' },
  { value: 'name-desc', label: 'Name: Z → A' },
];

const PER_PAGE_OPTIONS = [12, 24, 48] as const;

function onlyCleanSearch(s: string) {
  return s.trim().replace(/[%_]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

function highlightText(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  // Split on spaces, keep only meaningful tokens
  const tokens = q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 3);
  if (tokens.length === 0) return text;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'ig');
  const parts = String(text).split(re);

  return parts.map((part, i) => {
    const isMatch = re.test(part);
    // reset lastIndex due to .test with global regex
    re.lastIndex = 0;
    return isMatch ? (
      <mark key={i} className="rounded bg-yellow-100 px-0.5 text-gray-900">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

function formatBDT(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return `৳${Math.round(safe).toLocaleString('en-BD')}`;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function safePrice(v: string | null): PriceRangeKey {
  return (PRICE_OPTIONS.some((p) => p.value === v) ? (v as PriceRangeKey) : 'all');
}

function safeSort(v: string | null): SortKey {
  return (SORT_OPTIONS.some((s) => s.value === v) ? (v as SortKey) : 'newest');
}

function safeView(v: string | null): ViewMode {
  return v === 'compact' ? 'compact' : 'grid';
}

function safeBool1(v: string | null) {
  return v === '1';
}

function safeCsvList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((x) => decodeURIComponent(x).trim())
    .filter(Boolean);
}

function encodeCsvList(items: string[]) {
  return items.map((x) => encodeURIComponent(x)).join(',');
}

function normalizeTags(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t) return [];
    // try JSON
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      // fallthrough
    }
    // fallback: comma-separated
    return t
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Remove filter"
        >
          <X className="h-3 w-3 text-gray-500" />
        </button>
      )}
    </span>
  );
}

function SkeletonCard() {
  return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const windowSize = 2;
  const start = Math.max(1, currentPage - windowSize);
  const end = Math.min(totalPages, currentPage + windowSize);

  if (start > 1) pages.push(1);
  if (start > 2) pages.push(-1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push(-1);
  if (end < totalPages) pages.push(totalPages);

  return (
    <div className="mt-8 flex flex-wrap justify-center items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-10 h-10 p-0 bg-white"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {pages.map((p, idx) =>
        p === -1 ? (
          <span key={`e-${idx}`} className="px-2 text-gray-500 text-sm">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(p)}
            className={`h-10 px-3 ${p === currentPage ? 'bg-blue-900 hover:bg-blue-800' : 'bg-white'}`}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-10 h-10 p-0 bg-white"
      >
        <ChevronLeft className="w-4 h-4 rotate-180" />
      </Button>
    </div>
  );
}

type ProductsPageClientProps = {
  initialProducts?: ProductEx[];
  initialTotalProducts?: number;
  initialCategories?: CategoryLite[];
  initialSupplierOptions?: string[];
  initialTagOptions?: string[];
  forcedCategoryId?: string | null;
};

export default function ProductsPageClient({
  initialProducts = [],
  initialTotalProducts = 0,
  initialCategories = [],
  initialSupplierOptions = [],
  initialTagOptions = [],
  forcedCategoryId = null,
}: ProductsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const basePath = forcedCategoryId ? pathname : '/products';
  const suppressUrlSyncRef = useRef(false);

  const { addToCart } = useCart();
const { toggle: toggleWishlistId, isInWishlist } = useWishlist();

  const handleToggleWishlist = (p: ProductEx) => {
    const key = String((p as any).color_group_id || p.id);
    const next = !isInWishlist(key);
    toggleWishlistId(key);
    toast({
      title: next ? 'Saved' : 'Removed',
      description: next ? 'Added to wishlist.' : 'Removed from wishlist.',
    });
  };
const { toast } = useToast();

  // URL params
  const categoryParam = searchParams.get('category');
  const searchParam = searchParams.get('search');
  const priceParam = searchParams.get('price');
  const sortParam = searchParams.get('sort');
  const stockParam = searchParams.get('stock'); // 1
  const featuredParam = searchParams.get('featured'); // 1
  const suppliersParam = searchParams.get('suppliers'); // csv
  const tagsParam = searchParams.get('tags'); // csv
  const pageParam = searchParams.get('page');
  const viewParam = searchParams.get('view');
  const perParam = searchParams.get('per');

  // state
  const [products, setProducts] = useState<ProductEx[]>(dedupeByColorGroup(initialProducts as any) as ProductEx[]);
  const [categories, setCategories] = useState<CategoryLite[]>(initialCategories);
  const [categoriesLoading, setCategoriesLoading] = useState(!initialCategories.length);

  const [search, setSearch] = useState(searchParam || '');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(forcedCategoryId ?? categoryParam);
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  const [priceRange, setPriceRange] = useState<PriceRangeKey>(safePrice(priceParam));
  const [sort, setSort] = useState<SortKey>(safeSort(sortParam));
  const [inStockOnly, setInStockOnly] = useState<boolean>(safeBool1(stockParam));
  const [featuredOnly, setFeaturedOnly] = useState<boolean>(safeBool1(featuredParam));
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(safeCsvList(suppliersParam));
  const [selectedTags, setSelectedTags] = useState<string[]>(safeCsvList(tagsParam));

  const [view, setView] = useState<ViewMode>(safeView(viewParam));
  const [perPage, setPerPage] = useState<number>(() => {
    const n = safeInt(perParam, 12);
    return PER_PAGE_OPTIONS.includes(n as any) ? n : 12;
  });

  const [currentPage, setCurrentPage] = useState<number>(safeInt(pageParam, 1));
  const [totalProducts, setTotalProducts] = useState(initialTotalProducts);

  const [loading, setLoading] = useState(!initialProducts.length);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // filter options (derived from DB)
  const [supplierOptions, setSupplierOptions] = useState<string[]>(initialSupplierOptions);
  const [tagOptions, setTagOptions] = useState<string[]>(initialTagOptions);

  // Prevent an immediate client refetch on first render when the server already provided results.
  const skipInitialFetchRef = useRef(initialProducts.length > 0);

  // When we navigate to a different category route (e.g., /watches), avoid triggering an extra
  // client-side refetch/navigation in the current page instance.
  const isRouteNavigatingRef = useRef(false);

  const mainCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((totalProducts || 0) / perPage)), [totalProducts, perPage]);

  const selectedPrice = useMemo(() => PRICE_OPTIONS.find((p) => p.value === priceRange), [priceRange]);

  const buildUrl = useCallback(
    (targetPath: string, updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Categories are path-based now; keep query clean.
      params.delete('category');

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) params.delete(key);
        else params.set(key, value);
      });

      // cleanup
      if (params.get('page') === '1') params.delete('page');
      if (params.get('price') === 'all') params.delete('price');
      if (params.get('sort') === 'newest') params.delete('sort');
      if (params.get('view') === 'grid') params.delete('view');
      if (params.get('per') === String(PER_PAGE_OPTIONS[0])) params.delete('per');
      if (params.get('stock') === '0') params.delete('stock');
      if (params.get('featured') === '0') params.delete('featured');
      if (params.get('suppliers') === '') params.delete('suppliers');
      if (params.get('tags') === '') params.delete('tags');

			// Keep querystring ordering stable to avoid accidental replace/redirect loops
			// when the same params appear in different orders (common with UTM links, search engines, etc.).
			params.sort();
			const qs = params.toString();
      return qs ? `${targetPath}?${qs}` : targetPath;
    },
    [searchParams]
  );

  const updateUrl = useCallback(
    (updates: Record<string, string | null>, mode: 'replace' | 'push' = 'replace') => {
      const url = buildUrl(basePath, updates);
			// Normalize current query param ordering before comparing.
			const currentParams = new URLSearchParams(searchParams.toString());
			currentParams.sort();
			const currentQs = currentParams.toString();
			const currentUrl = currentQs ? `${pathname}?${currentQs}` : pathname;
      if (url === currentUrl) return;
      if (mode === 'push') router.push(url);
      else router.replace(url);
    },
    [router, buildUrl, basePath, pathname, searchParams]
  );

  const markNavigating = useCallback(() => {
    isRouteNavigatingRef.current = true;
    // Fallback: if navigation is cancelled (rare), release the guard.
    window.setTimeout(() => {
      isRouteNavigatingRef.current = false;
    }, 1500);
  }, []);

  // sync from URL
  useEffect(() => setSelectedCategory(forcedCategoryId ?? categoryParam), [forcedCategoryId, categoryParam]);
  useEffect(() => setSearch(searchParam || ''), [searchParam]);
  useEffect(() => setPriceRange(safePrice(priceParam)), [priceParam]);
  useEffect(() => setSort(safeSort(sortParam)), [sortParam]);
  useEffect(() => setInStockOnly(safeBool1(stockParam)), [stockParam]);
  useEffect(() => setFeaturedOnly(safeBool1(featuredParam)), [featuredParam]);
  useEffect(() => setSelectedSuppliers(safeCsvList(suppliersParam)), [suppliersParam]);
  useEffect(() => setSelectedTags(safeCsvList(tagsParam)), [tagsParam]);
  useEffect(() => setView(safeView(viewParam)), [viewParam]);
  useEffect(() => {
    const n = safeInt(perParam, 12);
    setPerPage(PER_PAGE_OPTIONS.includes(n as any) ? n : 12);
  }, [perParam]);
  useEffect(() => setCurrentPage(safeInt(pageParam, 1)), [pageParam]);

  // fetch categories
  useEffect(() => {
    if (initialCategories.length) {
      setCategoriesLoading(false);
      return;
    }
    const run = async () => {
      setCategoriesLoading(true);
      const res: { data: CategoryLite[] | null; error: any } = await supabase
      .from('categories')
      .select('id,name,slug,parent_id,image_url,sort_order,is_active,description,created_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (res.error) toast({ title: 'Error', description: 'Failed to load categories.', variant: 'destructive' });
      if (res.data) setCategories(res.data);
      setCategoriesLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // legacy category query redirect: /products?category=<uuid> -> /<slug>
  useEffect(() => {
    if (forcedCategoryId) return;
    if (!categoryParam) return;
    if (!categories.length) return;
    const cat = categories.find((c) => c.id === categoryParam);
    if (!cat?.slug) return;
    const url = buildUrl(`/${cat.slug}`, {});
	    // avoid loops (normalize querystring ordering before comparing)
	    const currentParams = new URLSearchParams(searchParams.toString());
	    currentParams.sort();
	    const currentQs = currentParams.toString();
	    const currentUrl = currentQs ? `${pathname}?${currentQs}` : pathname;
	    if (url !== currentUrl) router.replace(url);
  }, [forcedCategoryId, categoryParam, categories, buildUrl, router, searchParams]);

  // Expand correct parent when selected
  useEffect(() => {
    if (categories.length > 0 && selectedCategory) {
      const current = categories.find((c) => c.id === selectedCategory);
      if (current?.parent_id) setExpandedFilter(current.parent_id);
      else if (current && !current.parent_id) setExpandedFilter(current.id);
    }
  }, [categories, selectedCategory]);

  const getCategoryIdsForFilter = useCallback(
    (catId: string): string[] => {
      const current = categories.find((c) => c.id === catId);
      if (!current) return [catId];

      if (!current.parent_id) {
        const children = categories.filter((c) => c.parent_id === current.id).map((c) => c.id);
        return children.length ? [current.id, ...children] : [current.id];
      }
      return [current.id];
    },
    [categories]
  );

  // fetch supplier/tag options (prefer RPC to avoid client-side scanning)
  useEffect(() => {
    if (initialSupplierOptions.length || initialTagOptions.length) return;
    const run = async () => {
      // 1) Preferred: lightweight RPC (see supabase migration: get_product_filter_options)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_product_filter_options');

      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const row: any = rpcData[0];
        const suppliers = Array.isArray(row?.suppliers) ? row.suppliers : [];
        const tags = Array.isArray(row?.tags) ? row.tags : [];
        setSupplierOptions((suppliers as string[]).filter(Boolean));
        setTagOptions((tags as string[]).filter(Boolean));
        return;
      }

      // 2) Fallback: small scan (keeps the page working if RPC isn't deployed yet)
      const { data, error } = await supabase
        .from('products')
        .select('supplier_name,tags')
        .eq('is_active', true)
      .is('color_name', null)
        .eq('approval_status', 'approved')
        .limit(600);

      if (error || !data) return;

      const suppliers = new Set<string>();
      const tags = new Set<string>();

      for (const row of data as any[]) {
        if (row?.supplier_name) suppliers.add(String(row.supplier_name).trim());
        const t = normalizeTags(row?.tags);
        t.forEach((x) => tags.add(x));
      }

      setSupplierOptions(Array.from(suppliers).filter(Boolean).sort((a, b) => a.localeCompare(b)));
      setTagOptions(Array.from(tags).filter(Boolean).sort((a, b) => a.localeCompare(b)));
    };

    run();
  }, []);


  const fetchProducts = useCallback(
    async (page: number) => {
      if (selectedCategory && categoriesLoading) return;

      setLoading(true);
      setErrorMsg(null);

      const safePage = clamp(page, 1, totalPages || 1);
      const from = (safePage - 1) * perPage;
      const to = from + perPage - 1;

      const cleanSearch = onlyCleanSearch(debouncedSearch);

      try {
        let query = supabase
          .from('products')
          .select('id,name,slug,category_id,description,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,supplier_name,sku,tags,color_group_id,color_name,color_hex', { count: 'exact' })
          .eq('is_active', true)
      .is('color_name', null)
          .eq('approval_status', 'approved'); // remove this line if you want to show non-approved products

        // Category
        if (selectedCategory) {
          const ids = getCategoryIdsForFilter(selectedCategory);
          query = ids.length > 1 ? query.in('category_id', ids) : query.eq('category_id', ids[0]);
        }

        // Search
        if (cleanSearch) {
          query = query.or(`name.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%`);
        }

        // Stock
        if (inStockOnly) query = query.gt('stock_quantity', 0);

        // Featured
        if (featuredOnly) query = query.eq('is_featured', true);

        // Suppliers
        if (selectedSuppliers.length > 0) query = query.in('supplier_name', selectedSuppliers);

        // Tags: best-effort matching if tags is text[]/json
        // If tags is a text[] column, "contains" works well.
        // If tags is json/text, adjust in DB to jsonb array for best results.
        if (selectedTags.length > 0) {
          // try contains (works for arrays / jsonb arrays)
          query = query.contains('tags', selectedTags as any);
        }

        // Price
        if (selectedPrice?.min != null) query = query.gte('price', selectedPrice.min);
        if (selectedPrice?.max != null) query = query.lte('price', selectedPrice.max);

        // Sorting
        if (sort === 'newest') query = query.order('created_at', { ascending: false });
        if (sort === 'best-selling') query = query.order('total_sales', { ascending: false, nullsFirst: false });
        if (sort === 'price-asc') query = query.order('price', { ascending: true });
        if (sort === 'price-desc') query = query.order('price', { ascending: false });
        if (sort === 'name-asc') query = query.order('name', { ascending: true });
        if (sort === 'name-desc') query = query.order('name', { ascending: false });

        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) {
          setErrorMsg(error.message || 'Failed to load products.');
          setProducts([]);
          setTotalProducts(0);
        } else {
          setProducts(dedupeByColorGroup((data || []) as any) as ProductEx[]);
          setTotalProducts(count || 0);
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Something went wrong while loading products.');
        setProducts([]);
        setTotalProducts(0);
      } finally {
        setLoading(false);
      }
    },
    [
      categoriesLoading,
      debouncedSearch,
      featuredOnly,
      getCategoryIdsForFilter,
      inStockOnly,
      perPage,
      selectedCategory,
      selectedPrice?.max,
      selectedPrice?.min,
      selectedSuppliers,
      selectedTags,
      sort,
      totalPages,
    ]
  );

  // reset to page 1 when filters change
  useEffect(() => {
    if (suppressUrlSyncRef.current) {
      suppressUrlSyncRef.current = false;
      return;
    }
    if (isRouteNavigatingRef.current) return;
	    // Avoid unnecessary URL writes that can lead to navigation churn with some hosting/crawlers.
	    if (currentPage === 1) return;
    updateUrl({ page: '1' }, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
	  }, [selectedCategory, priceRange, sort, inStockOnly, featuredOnly, debouncedSearch, perPage, suppliersParam, tagsParam, currentPage]);

  // fetch on page change
  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    if (isRouteNavigatingRef.current) return;
    fetchProducts(currentPage);
  }, [fetchProducts, currentPage]);

  const handlePageChange = (newPage: number) => {
    const safePage = clamp(newPage, 1, totalPages);
    setCurrentPage(safePage);
    updateUrl({ page: String(safePage) }, 'push');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryClick = (categoryId: string) => {
    const newCategory = selectedCategory === categoryId ? null : categoryId;
    setSelectedCategory(newCategory);

    const current = categories.find((c) => c.id === categoryId);
    if (current?.parent_id) setExpandedFilter(current.parent_id);
    else setExpandedFilter(categoryId);

    // Navigate using clean category paths (and avoid an extra client refetch during transition)
    suppressUrlSyncRef.current = true;
    markNavigating();
    const slug = newCategory ? categories.find((c) => c.id === newCategory)?.slug : null;
    const targetPath = newCategory && slug ? `/${encodeURIComponent(String(slug))}` : '/products';
    const url = buildUrl(targetPath, { page: '1' });
    router.replace(url);
  };

  const toggleFilterExpand = (categoryId: string) => {
    setExpandedFilter((prev) => (prev === categoryId ? null : categoryId));
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setExpandedFilter(null);
    setPriceRange('all');
    setSearch('');
    setSort('newest');
    setInStockOnly(false);
    setFeaturedOnly(false);
    setSelectedSuppliers([]);
    setSelectedTags([]);
    setCurrentPage(1);
    setView('grid');
    setPerPage(12);
    updateUrl(
      {
        category: null,
        search: null,
        price: null,
        sort: null,
        stock: null,
        featured: null,
        suppliers: null,
        tags: null,
        page: null,
        view: null,
        per: null,
      },
      'replace'
    );
  };

  const handleQuickAdd = async (productId: string, productName: string) => {
    setAddingToCart(productId);
    try {
      await addToCart(productId, 1);
      toast({ title: 'Added to cart', description: `${productName} has been added to your cart.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to add item to cart.', variant: 'destructive' });
    } finally {
      setAddingToCart(null);
    }
  };

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (selectedCategory) {
      const label = categories.find((c) => c.id === selectedCategory)?.name || 'Category';
      chips.push({ key: 'category', label: `Category: ${label}`, onRemove: () => updateUrl({ category: null, page: '1' }, 'replace') });
    }

    if (debouncedSearch.trim()) {
      chips.push({ key: 'search', label: `Search: "${debouncedSearch.trim()}"`, onRemove: () => updateUrl({ search: null, page: '1' }, 'replace') });
    }

    if (priceRange !== 'all') {
      const label = PRICE_OPTIONS.find((p) => p.value === priceRange)?.label ?? 'Price';
      chips.push({ key: 'price', label, onRemove: () => updateUrl({ price: null, page: '1' }, 'replace') });
    }

    if (sort !== 'newest') {
      const label = SORT_OPTIONS.find((s) => s.value === sort)?.label ?? 'Sort';
      chips.push({ key: 'sort', label: `Sort: ${label}`, onRemove: () => updateUrl({ sort: null, page: '1' }, 'replace') });
    }

    if (inStockOnly) chips.push({ key: 'stock', label: 'In stock only', onRemove: () => updateUrl({ stock: null, page: '1' }, 'replace') });
    if (featuredOnly) chips.push({ key: 'featured', label: 'Featured only', onRemove: () => updateUrl({ featured: null, page: '1' }, 'replace') });

    if (selectedSuppliers.length > 0) {
      chips.push({
        key: 'suppliers',
        label: `Suppliers: ${selectedSuppliers.length}`,
        onRemove: () => updateUrl({ suppliers: null, page: '1' }, 'replace'),
      });
    }

    if (selectedTags.length > 0) {
      chips.push({
        key: 'tags',
        label: `Tags: ${selectedTags.length}`,
        onRemove: () => updateUrl({ tags: null, page: '1' }, 'replace'),
      });
    }

    if (view !== 'grid') chips.push({ key: 'view', label: 'Compact view', onRemove: () => updateUrl({ view: null }, 'replace') });
    if (perPage !== 12) chips.push({ key: 'per', label: `Per page: ${perPage}`, onRemove: () => updateUrl({ per: null, page: '1' }, 'replace') });

    return chips;
  }, [categories, debouncedSearch, featuredOnly, inStockOnly, perPage, priceRange, selectedCategory, selectedSuppliers.length, selectedTags.length, sort, updateUrl, view]);

  // UI: toggle supplier/tag selection
  const toggleSupplier = (name: string) => {
    setSelectedSuppliers((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      updateUrl({ suppliers: next.length ? encodeCsvList(next) : null, page: '1' }, 'replace');
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag];
      updateUrl({ tags: next.length ? encodeCsvList(next) : null, page: '1' }, 'replace');
      return next;
    });
  };

  const FilterContent = () => (
    <Card className="border-none shadow-none md:border md:shadow-sm bg-white">
      <CardContent className="p-0 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base text-gray-900">Filters</h3>
          {(selectedCategory || priceRange !== 'all' || search || sort !== 'newest' || inStockOnly || featuredOnly || selectedSuppliers.length || selectedTags.length) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-blue-900 hover:text-blue-800 h-7">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Desktop search */}
        <div className="relative mb-4 hidden md:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => {
              const v = e.target.value;
              setSearch(v);
              updateUrl({ search: v.trim() ? v : null, page: '1' }, 'replace');
            }}
            className="pl-10 h-9 text-sm"
          />
        </div>

        <Separator className="my-4 hidden md:block" />

        {/* Categories */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-3">Categories</h4>
          <ScrollArea className="h-[36vh] md:h-72">
            <div className="space-y-1 pr-3">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setExpandedFilter(null);
                  suppressUrlSyncRef.current = true;
                  markNavigating();
                  const url = buildUrl('/products', { page: '1' });
                  router.replace(url);
                }}
                className={`block w-full text-left text-sm py-1 ${!selectedCategory ? 'font-bold text-blue-900' : 'text-gray-700 hover:text-blue-900'}`}
              >
                All Categories
              </button>

              <Separator className="my-2" />

              {mainCategories.map((parent) => {
                const subcategories = categories.filter((c) => c.parent_id === parent.id);
                const hasSubs = subcategories.length > 0;
                const isExpanded = expandedFilter === parent.id;
                const isSelected = selectedCategory === parent.id;

                return (
                  <div key={parent.id} className="select-none">
                    <div className="flex items-center justify-between py-1 group">
                      <button
                        onClick={() => handleCategoryClick(parent.id)}
                        className={`text-sm text-left flex-1 transition-colors ${
                          isSelected ? 'font-bold text-blue-900' : 'text-gray-700 hover:text-blue-900'
                        }`}
                      >
                        {parent.name}
                      </button>

                      {hasSubs && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFilterExpand(parent.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          aria-label="Toggle subcategories"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </div>

                    {hasSubs && isExpanded && (
                      <div className="ml-2 pl-2 border-l-2 border-gray-100 space-y-1 mt-1">
                        {subcategories.map((child) => {
                          const isChildSelected = selectedCategory === child.id;
                          return (
                            <button
                              key={child.id}
                              onClick={() => handleCategoryClick(child.id)}
                              className={`block w-full text-left text-xs py-1 transition-colors ${
                                isChildSelected ? 'font-bold text-blue-900' : 'text-gray-600 hover:text-blue-900'
                              }`}
                            >
                              {child.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <Separator className="my-4" />

        {/* Availability */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-900">Availability</h4>

          <button
            onClick={() => {
              setInStockOnly((v) => {
                const next = !v;
                updateUrl({ stock: next ? '1' : null, page: '1' }, 'replace');
                return next;
              });
            }}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
              inStockOnly ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {inStockOnly ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-4 w-4 rounded border border-gray-300" />}
              In stock only
            </span>
            <span className="text-xs text-gray-500">{inStockOnly ? 'On' : 'Off'}</span>
          </button>

          <button
            onClick={() => {
              setFeaturedOnly((v) => {
                const next = !v;
                updateUrl({ featured: next ? '1' : null, page: '1' }, 'replace');
                return next;
              });
            }}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
              featuredOnly ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {featuredOnly ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-4 w-4 rounded border border-gray-300" />}
              Featured only
            </span>
            <span className="text-xs text-gray-500">{featuredOnly ? 'On' : 'Off'}</span>
          </button>
        </div>

        <Separator className="my-4" />

        {/* Price */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-3">Price Range</h4>
          <div className="space-y-1">
            {PRICE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setPriceRange(option.value);
                  updateUrl({ price: option.value === 'all' ? null : option.value, page: '1' }, 'replace');
                }}
                className={`block w-full text-left text-sm py-1 ${
                  priceRange === option.value ? 'font-bold text-blue-900' : 'text-gray-700 hover:text-blue-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Suppliers */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-2">Suppliers</h4>
          {supplierOptions.length === 0 ? (
            <div className="text-xs text-gray-500">No supplier data.</div>
          ) : (
            <ScrollArea className="h-40">
              <div className="space-y-1 pr-3">
                {supplierOptions.map((s) => {
                  const active = selectedSuppliers.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSupplier(s)}
                      className={`w-full text-left text-sm py-1 ${active ? 'font-bold text-blue-900' : 'text-gray-700 hover:text-blue-900'}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator className="my-4" />

        {/* Tags */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-2">Tags</h4>
          {tagOptions.length === 0 ? (
            <div className="text-xs text-gray-500">No tag data.</div>
          ) : (
            <ScrollArea className="h-40">
              <div className="space-y-1 pr-3">
                {tagOptions.map((t) => {
                  const active = selectedTags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`w-full text-left text-sm py-1 ${active ? 'font-bold text-blue-900' : 'text-gray-700 hover:text-blue-900'}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <Separator className="my-4" />

        {/* Sort */}
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-2">Sort</h4>
          <div className="grid grid-cols-1 gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setSort(opt.value);
                  updateUrl({ sort: opt.value === 'newest' ? null : opt.value, page: '1' }, 'replace');
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  sort === opt.value
                    ? 'border-blue-200 bg-blue-50 text-blue-900 font-semibold'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Separator className="my-4" />

        {/* View + Per page */}
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-2">View</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setView('grid');
                  updateUrl({ view: null }, 'replace');
                }}
                className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-2 ${
                  view === 'grid' ? 'border-blue-200 bg-blue-50 text-blue-900 font-semibold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="h-4 w-4" /> Grid
              </button>
              <button
                onClick={() => {
                  setView('compact');
                  updateUrl({ view: 'compact' }, 'replace');
                }}
                className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-2 ${
                  view === 'compact' ? 'border-blue-200 bg-blue-50 text-blue-900 font-semibold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Rows3 className="h-4 w-4" /> Compact
              </button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-2">Per page</h4>
            <div className="grid grid-cols-3 gap-2">
              {PER_PAGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setPerPage(n);
                    updateUrl({ per: n === 12 ? null : String(n), page: '1' }, 'replace');
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    perPage === n ? 'border-blue-200 bg-blue-50 text-blue-900 font-semibold' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-6 flex-1">
        {/* MOBILE BAR */}
        <div className="md:hidden mb-6 flex gap-3 sticky top-[72px] z-30 bg-gray-50 pb-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white flex-shrink-0">
                <Filter className="h-4 w-4" /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] sm:w-[420px] overflow-y-auto">
              <div className="mt-4">
                <FilterContent />
              </div>
            </SheetContent>
          </Sheet>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                const v = e.target.value;
                setSearch(v);
                updateUrl({ search: v.trim() ? v : null, page: '1' }, 'replace');
              }}
              className="pl-10 h-10 text-sm bg-white"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* DESKTOP SIDEBAR */}
          <aside className="hidden md:block w-72 flex-shrink-0">
            <div className="sticky top-24">
              <FilterContent />
            </div>
          </aside>

          {/* MAIN */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Header */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Products</h1>
                <p className="text-sm text-gray-600">
                  Showing <span className="font-medium">{products.length}</span> of{' '}
                  <span className="font-medium">{totalProducts}</span> products
                </p>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <div className="relative w-[280px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSearch(v);
                      updateUrl({ search: v.trim() ? v : null, page: '1' }, 'replace');
                    }}
                    className="pl-10 h-9 text-sm bg-white"
                  />
                </div>

                <Button
                  variant="outline"
                  className="bg-white gap-2"
                  onClick={() => fetchProducts(currentPage)}
                  disabled={loading}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Active chips */}
            {activeFilters.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {activeFilters.map((f) => (
                  <Chip key={f.key} onRemove={f.onRemove}>
                    {f.label}
                  </Chip>
                ))}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-blue-900 hover:text-blue-800">
                  Clear all
                </Button>
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-700 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-red-900">Could not load products</div>
                    <div className="text-sm text-red-800 mt-1">{errorMsg}</div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="bg-blue-900 hover:bg-blue-800" onClick={() => fetchProducts(currentPage)}>
                        Retry
                      </Button>
                      <Button size="sm" variant="outline" className="bg-white" onClick={clearFilters}>
                        Reset filters
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-3'}>
                {Array.from({ length: perPage }).map((_, i) =>
                  view === 'grid' ? <SkeletonCard key={i} /> : <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                )}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-600">Try adjusting your filters</p>
                <Button variant="outline" onClick={clearFilters} className="mt-4 bg-white">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                {view === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {products.map((product) => {
                      const price = Number(product.price ?? (product as any).base_price ?? 0);
                      const retail = Number((product as any).retail_price ?? 0);
                      const outOfStock = ((product as any).stock_quantity ?? 0) <= 0;

                      const imagesAny = (product as any).images;
                      const primaryImage = Array.isArray(imagesAny) && imagesAny.length > 0 ? imagesAny[0] : null;

                      const discountPct = retail > 0 && retail > price ? Math.round(((retail - price) / retail) * 100) : 0;

                      return (
                        <Card key={product.id} className="hover:shadow-lg transition group flex flex-col h-full">
                          <CardContent className="p-0 flex-1 flex flex-col">
                            <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden relative">
                              {outOfStock && (
                                <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase z-10">
                                  Out of Stock
                                </div>
                              )}
                              {!outOfStock && product.is_featured && (
                                <div className="absolute top-2 left-2 bg-blue-900 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase z-10">
                                  Featured
                                </div>
                              )}
                              {discountPct > 0 && (
                                <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase z-10">
                                  {discountPct}% OFF
                                </div>
                              )}

                              <Link
                                href={`/products/${product.slug}`}
                                prefetch={false}
                                className="absolute inset-0 block"
                                aria-label={`View ${product.name}`}
                              >
                                {primaryImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <SafeImage
                                    src={primaryImage}
                                    alt={product.name}
                                    fill
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                                    className="object-cover cursor-zoom-in transition-transform duration-500 ease-out group-hover:scale-110"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-12 h-12 text-gray-300" />
                                  </div>
                                )}
                              </Link>
                            </div>

                            <div className="p-3 flex flex-col flex-1">
                              <Link
                                href={`/products/${product.slug}`}
                                prefetch={false}
                                className="flex-1"
                              >
                                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem] hover:text-blue-900 transition">
                                  {highlightText(product.name, debouncedSearch)}
                                </h3>
                              </Link>

                              <div className="flex items-baseline gap-2 mb-3">
                                <span className="text-lg font-bold text-blue-900">{formatBDT(price)}</span>
                                {retail > 0 && retail > price && (
                                  <span className="text-xs text-gray-500 line-through">{formatBDT(retail)}</span>
                                )}
                              </div>

                              <div className="mt-auto flex gap-2">
                                <Button
                                  className="flex-1 bg-blue-900 hover:bg-blue-800 h-8 text-xs"
                                  size="sm"
                                  onClick={() => handleQuickAdd(product.id, product.name)}
                                  disabled={addingToCart === product.id || outOfStock}
                                >
                                  <ShoppingCart className="mr-1 h-3 w-3" />
                                  {addingToCart === product.id ? '...' : 'Add'}
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 bg-white"
                                  onClick={() => handleToggleWishlist(product)}
                                  aria-label={isInWishlist(String((product as any).color_group_id || product.id)) ? 'Remove from wishlist' : 'Add to wishlist'}
                                >
                                  <Heart className={`h-4 w-4 ${isInWishlist(String((product as any).color_group_id || product.id)) ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                                </Button>
</div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {products.map((product) => {
                      const price = Number(product.price ?? (product as any).base_price ?? 0);
                      const retail = Number((product as any).retail_price ?? 0);
                      const outOfStock = ((product as any).stock_quantity ?? 0) <= 0;

                      const imagesAny = (product as any).images;
                      const primaryImage = Array.isArray(imagesAny) && imagesAny.length > 0 ? imagesAny[0] : null;

                      const discountPct = retail > 0 && retail > price ? Math.round(((retail - price) / retail) * 100) : 0;

                      return (
                        <Card key={product.id} className="hover:shadow-sm transition">
                          <CardContent className="p-3 flex gap-3">
                            <div className="h-20 w-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 relative">
                              <Link
                                href={`/products/${product.slug}`}
                                prefetch={false}
                                className="absolute inset-0 block"
                                aria-label={`View ${product.name}`}
                              >
                                {primaryImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <SafeImage
                                    src={primaryImage}
                                    alt={product.name}
                                    fill
                                    sizes="80px"
                                    className="object-cover transition-transform duration-500 ease-out hover:scale-110 cursor-zoom-in"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center">
                                    <Package className="h-8 w-8 text-gray-300" />
                                  </div>
                                )}
                              </Link>
                              {outOfStock && (
                                <div className="absolute bottom-1 left-1 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                                  OOS
                                </div>
                              )}
                              {discountPct > 0 && (
                                <div className="absolute bottom-1 right-1 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                                  {discountPct}%
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/products/${product.slug}`}
                                prefetch={false}
                              >
                                <div className="font-semibold text-gray-900 truncate hover:text-blue-900 transition">
                                  {highlightText(product.name, debouncedSearch)}
                                </div>
                              </Link>

                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-sm font-bold text-blue-900">{formatBDT(price)}</span>
                                {retail > 0 && retail > price && (
                                  <span className="text-xs text-gray-500 line-through">{formatBDT(retail)}</span>
                                )}
                                {product.is_featured && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">Featured</span>}
                              </div>

                              <div className="mt-2 flex gap-2">
                                <Button
                                  className="bg-blue-900 hover:bg-blue-800 h-8 text-xs"
                                  size="sm"
                                  onClick={() => handleQuickAdd(product.id, product.name)}
                                  disabled={addingToCart === product.id || outOfStock}
                                >
                                  <ShoppingCart className="mr-1 h-3 w-3" />
                                  {addingToCart === product.id ? '...' : 'Add'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 bg-white"
                                  onClick={() => handleToggleWishlist(product)}
                                  aria-label={isInWishlist(String((product as any).color_group_id || product.id)) ? 'Remove from wishlist' : 'Add to wishlist'}
                                >
                                  <Heart className={`h-4 w-4 ${isInWishlist(String((product as any).color_group_id || product.id)) ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
