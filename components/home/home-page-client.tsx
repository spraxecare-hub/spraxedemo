
'use client';

import { useEffect, useMemo, useState, useCallback, useRef, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SafeImage } from '@/components/ui/safe-image';


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const FEATURE_IMAGE_BUCKET = 'feature-image';

/**
 * Resolve image urls coming from the DB/admin panel.
 * Supports:
 * - full http(s) urls
 * - protocol-relative urls (//cdn...)
 * - Supabase Storage object keys/paths (e.g. "folder/file.jpg" or "feature-image/folder/file.jpg")
 * - Supabase storage urls without host (e.g. "/storage/v1/object/public/...")
 */
function resolvePublicImageUrl(raw?: string): string {
  const s = (raw ?? '').trim();
  if (!s) return '';

  // Absolute / protocol-relative
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return `https:${s}`;

  // Data/blob
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;

  // Absolute path
  if (s.startsWith('/')) {
    // If this is a supabase storage path without host, attach the host
    if (SUPABASE_URL && s.startsWith('/storage/v1/object/')) return `${SUPABASE_URL}${s}`;
    return s;
  }

  // Supabase storage path without leading slash
  if (SUPABASE_URL && s.startsWith('storage/v1/object/')) return `${SUPABASE_URL}/${s}`;

  // Treat as a Supabase Storage object key/path
  if (SUPABASE_URL) {
    const key = s.startsWith(`${FEATURE_IMAGE_BUCKET}/`)
      ? s.slice(FEATURE_IMAGE_BUCKET.length + 1)
      : s;

    return `${SUPABASE_URL}/storage/v1/object/public/${FEATURE_IMAGE_BUCKET}/${key}`;
  }

  // Fallback: return as-is
  return s;
}
// Trust badges are intentionally not shown on the homepage.
import { supabase } from '@/lib/supabase/client';
import { useCart } from '@/lib/cart/cart-context';
import { useWishlist } from '@/lib/wishlist/wishlist-context';
import { Product, Category } from '@/lib/supabase/types';
import { dedupeByColorGroup } from '@/lib/utils/product-dedupe';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Package, ChevronRight, Sparkles, TrendingUp, Heart, X, CreditCard } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

// 1) DEFINE MAIN CATEGORIES TO SHOW
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

function parseImages(images: any): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === 'string') {
    const s = images.trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.filter(Boolean);
      } catch {}
    }
  }
  return [];
}

function getPrice(p: any): number {
  const v = Number(p?.price ?? p?.retail_price ?? p?.base_price ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function getRetail(p: any): number {
  const v = Number(p?.retail_price ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function moneyBDT(n: number) {
  return `৳${(n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}


function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  if (!Array.isArray(arr) || size <= 0) return out;
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function MobileGridCarousel<T extends { id: string | number }>({
  items,
  renderItem,
  perPage = 6,
  cols = 3,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  perPage?: number;
  cols?: 2 | 3 | 4;
}) {
  const pages = useMemo(() => chunkArray(items, perPage), [items, perPage]);

  if (!items || items.length === 0) return null;

  const colsClass = cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <Carousel opts={{ align: 'start', loop: pages.length > 1 }} className="w-full md:hidden">
      <CarouselContent className="-ml-2">
        {pages.map((page, idx) => (
          <CarouselItem key={idx} className="pl-2 basis-full">
            <div className={`grid ${colsClass} gap-2`}>
              {page.map((it) => (
                <div key={it.id}>{renderItem(it)}</div>
              ))}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>

      {/* Mobile nav arrows (visible on white bg) */}
      {pages.length > 1 ? (
        <>
          <CarouselPrevious className="left-1.5 bg-white hover:bg-white border border-gray-300 shadow-md text-gray-900 h-9 w-9" />
          <CarouselNext className="right-1.5 bg-white hover:bg-white border border-gray-300 shadow-md text-gray-900 h-9 w-9" />
        </>
      ) : null}
    </Carousel>
  );
}


type HomePageClientProps = {
  initialProducts?: Product[];
  initialNewArrivals?: Product[];
  initialBestSellers?: Product[];
  initialBestSellerSoldMap?: Record<string, number>;
  initialCategories?: Category[];
  initialFeaturedImages?: any[];
  initialHomeMidBanner?: any;
};

export default function HomePageClient({
  initialProducts = [],
  initialNewArrivals = [],
  initialBestSellers = [],
  initialBestSellerSoldMap = {},
  initialCategories = [],
  initialFeaturedImages = [],
  initialHomeMidBanner = null,
}: HomePageClientProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { toggle: toggleWishlistId, isInWishlist } = useWishlist();
  const { toast } = useToast();

  const expandedSectionRef = useRef<HTMLDivElement | null>(null);

  const expandedReqRef = useRef(0);
  const hasInitial =
    (initialProducts?.length || 0) > 0 ||
    (initialNewArrivals?.length || 0) > 0 ||
    (initialBestSellers?.length || 0) > 0 ||
    (initialCategories?.length || 0) > 0 ||
    (initialFeaturedImages?.length || 0) > 0 ||
    !!initialHomeMidBanner;

  const [products, setProducts] = useState<Product[]>(dedupeByColorGroup(initialProducts as any) as any);
  const [newArrivals, setNewArrivals] = useState<Product[]>(dedupeByColorGroup(initialNewArrivals as any) as any);
  const [bestSellers, setBestSellers] = useState<Product[]>(dedupeByColorGroup(initialBestSellers as any) as any);
  const [bestSellerSoldMap, setBestSellerSoldMap] = useState<Record<string, number>>(
    initialBestSellerSoldMap
  );
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [featuredImages, setFeaturedImages] = useState<any[]>(initialFeaturedImages);
  const [homeMidBanner, setHomeMidBanner] = useState<any>(initialHomeMidBanner);
  const [loading, setLoading] = useState(!hasInitial);

  // Featured images can be used in multiple homepage sections.
  // - placement = 'hero' (or missing) is the main hero slider
  // - placement = 'info_carousel' is the carousel embedded in the info paragraph section
  const heroFeaturedImages = useMemo(
    () => (featuredImages || []).filter((img: any) => !img?.placement || img.placement === 'hero'),
    [featuredImages]
  );

  const infoCarouselImages = useMemo(
    () => (featuredImages || []).filter((img: any) => img?.placement === 'info_carousel'),
    [featuredImages]
  );

  // Recently viewed (client-only)
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [recentlyViewedLoading, setRecentlyViewedLoading] = useState(false);

  const loadRecentlyViewed = useCallback(async () => {
    try {
      const raw = window.localStorage.getItem('recently_viewed_product_ids');
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      const list = Array.isArray(ids)
        ? ids
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .slice(0, 12)
        : [];

      if (list.length === 0) {
        setRecentlyViewed([]);
        return;
      }

      setRecentlyViewedLoading(true);
      // The recently viewed list stores group ids (color_group_id) when available.
      // For backward compatibility, it may contain product ids too.
      const baseQuery = supabase
        .from('products')
        .select(
          'id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex'
        )
        .eq('is_active', true)
        .limit(24);

      const [{ data: byId, error: err1 }, { data: byGroup, error: err2 }] = await Promise.all([
        baseQuery.in('id', list),
        baseQuery.in('color_group_id', list).is('color_name', null),
      ]);
      if (err1) throw err1;
      if (err2) throw err2;

      const idMap = new Map((byId || []).map((p: any) => [p.id, p]));
      const groupMap = new Map((byGroup || []).map((p: any) => [String((p as any).color_group_id || p.id), p]));
      const ordered = list.map((k) => idMap.get(k) || groupMap.get(k)).filter(Boolean);
      setRecentlyViewed(ordered as any);
    } catch {
      // ignore (supabase may not be configured during local dev)
      setRecentlyViewed([]);
    } finally {
      setRecentlyViewedLoading(false);
    }
  }, []);

  // Homepage expandable category section (#12)
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<any[]>([]);
  const [expandedBrand, setExpandedBrand] = useState<string>('All brand');
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const [infoCarouselApi, setInfoCarouselApi] = useState<CarouselApi>();
  const [infoCurrentSlide, setInfoCurrentSlide] = useState(0);

  // Used for choosing mobile/desktop-specific images when both are provided.
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobileViewport(!!mq.matches);
    update();
    // Safari < 14 fallback
    // eslint-disable-next-line deprecation/deprecation
    mq.addEventListener ? mq.addEventListener('change', update) : mq.addListener(update);
    return () => {
      // eslint-disable-next-line deprecation/deprecation
      mq.removeEventListener ? mq.removeEventListener('change', update) : mq.removeListener(update);
    };
  }, []);

  const sortedCategoryIds = useMemo(() => categories.map((c) => c.id), [categories]);

  // Fallback client fetch (only if server didn't provide initial props)
  useEffect(() => {
    if (hasInitial) return;
    const fetchData = async () => {
      setLoading(true);

      // Fetch: Featured products, Categories, Featured images
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
          .select(
            'id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex,created_at'
          )
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

      if (productsRes.data) setProducts(dedupeByColorGroup(productsRes.data as any) as any);

      // Categories: match exact list & keep their order
      if (categoriesRes.data) {
        const sortMap = new Map(TARGET_CATEGORIES.map((name, i) => [name.toLowerCase(), i]));
        const filtered = (categoriesRes.data as any[])
          .filter((cat) =>
            TARGET_CATEGORIES.some(
              (t) => t.toLowerCase() === String(cat.name || '').toLowerCase()
            )
          )
          .sort((a, b) => {
            const ia = sortMap.get(String(a.name || '').toLowerCase()) ?? 999;
            const ib = sortMap.get(String(b.name || '').toLowerCase()) ?? 999;
            return ia - ib;
          });

        setCategories(filtered as any);
      }

      if (featuredRes.data) setFeaturedImages(featuredRes.data as any);

      if (newArrivalsRes.data) setNewArrivals(dedupeByColorGroup(newArrivalsRes.data as any) as any);

      if (bannerRes.data) setHomeMidBanner((bannerRes.data as any)?.value ?? null);

      // ✅ Best Sellers (PUBLIC-SAFE): use RPC that returns only aggregated totals
      const { data: soldRows, error: soldErr } = await supabase.rpc('get_best_sellers', {
        limit_count: 12,
      });

      if (soldErr) {
        console.warn('RPC get_best_sellers failed:', soldErr.message);

        // fallback (optional) if you keep products.total_sales
        const { data: fallback } = await supabase
          .from('products')
          .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
          .eq('is_active', true)
      .is('color_name', null)
          .order('total_sales', { ascending: false })
          .limit(12);

        setBestSellers(dedupeByColorGroup((fallback || []) as any) as any);
        setBestSellerSoldMap({});
      } else {
        const rows = (soldRows || []) as Array<{ product_id: string; sold_qty: number }>;
        const soldMap: Record<string, number> = {};
        const topIds = rows.map((r) => {
          soldMap[r.product_id] = Number(r.sold_qty || 0);
          return r.product_id;
        });

        setBestSellerSoldMap(soldMap);

        if (topIds.length === 0) {
          setBestSellers([]);
        } else {
          const { data: topProducts, error: topErr } = await supabase
            .from('products')
            .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
            .in('id', topIds)
            .eq('is_active', true)
      .is('color_name', null);

          if (topErr) {
            console.warn('Best seller products fetch failed:', topErr.message);
            setBestSellers([]);
          } else {
            // keep correct order by sold qty (same order as RPC)
            const map = new Map((topProducts || []).map((p: any) => [p.id, p]));
            const ordered = topIds.map((id) => map.get(id)).filter(Boolean);
            setBestSellers(dedupeByColorGroup(ordered as any) as any);
          }
        }
      }

      setLoading(false);
    };

    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load recently viewed products from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Defer this work to keep first paint snappy
    const run = () => void loadRecentlyViewed();
    const idle = (window as any).requestIdleCallback as undefined | ((cb: any, opts?: any) => any);
    const id = idle ? idle(run, { timeout: 2000 }) : window.setTimeout(run, 350);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'recently_viewed_product_ids') {
        void loadRecentlyViewed();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      try {
        const cancelIdle = (window as any).cancelIdleCallback as undefined | ((id: any) => void);
        if (typeof id !== 'undefined') {
          if (cancelIdle && idle) cancelIdle(id);
          else window.clearTimeout(id as any);
        }
      } catch {
        // ignore
      }
      window.removeEventListener('storage', onStorage);
    };
  }, [loadRecentlyViewed]);

  // Update slide index
  useEffect(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
    const onSelect = () => setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on('select', onSelect);
  }, [carouselApi]);

  // Auto-slide hero (disabled for performance)
  useEffect(() => {
    // Intentionally disabled to keep scrolling/interaction smooth on low-end devices.
    // If you want it back, reintroduce a setInterval(carouselApi.scrollNext, ...).
  }, [carouselApi]);

  // Update slide index (info carousel)
  useEffect(() => {
    if (!infoCarouselApi) return;
    setInfoCurrentSlide(infoCarouselApi.selectedScrollSnap());
    const onSelect = () => setInfoCurrentSlide(infoCarouselApi.selectedScrollSnap());
    infoCarouselApi.on('select', onSelect);
  }, [infoCarouselApi]);

  // Auto-slide info carousel (disabled for performance)
  useEffect(() => {
    // Disabled to reduce background work and improve smoothness.
  }, [infoCarouselApi, infoCarouselImages?.length]);

  const handleBuyNow = async (productId: string, productName: string) => {
    try {
      await addToCart(productId, 1);
      toast({ title: 'Ready to checkout', description: `${productName} added to your cart` });
      router.push('/cart?checkout=1');
    } catch {
      toast({ title: 'Error', description: 'Failed to add to cart', variant: 'destructive' });
    }
  };

  const onCategoryClick = async (cat: Category) => {
    // If already expanded, just scroll (no toggle-close)
    if (expandedCategory?.id === cat.id) {
      expandedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const reqId = ++expandedReqRef.current;

    // Update UI instantly
    setExpandedCategory(cat);
    setExpandedBrand('All brand');
    setExpandedLoading(true);
    setExpandedProducts([]);

    try {
      // Include child categories when a parent category is clicked.
      // Homepage only receives a curated category list, so we fetch children on demand.
      const { data: childCats, error: childErr } = await supabase
        .from('categories')
        .select('id')
        .eq('is_active', true)
        .eq('parent_id', cat.id);

      if (childErr) throw childErr;

      const childIds = ((childCats || []) as Array<{ id: string }>).map((c) => c.id);

      // Also include grandchildren (2-level) to avoid empty results when products are under nested subcategories.
      let grandIds: string[] = [];
      if (childIds.length > 0) {
        const { data: grandCats, error: grandErr } = await supabase
          .from('categories')
          .select('id')
          .eq('is_active', true)
          .in('parent_id', childIds);

        if (grandErr) throw grandErr;
        grandIds = ((grandCats || []) as Array<{ id: string }>).map((c) => c.id);
      }

      const ids = [cat.id, ...childIds, ...grandIds];

      const { data, error } = await supabase
        .from('products')
        .select(
          'id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex,supplier_name,created_at'
        )
        .eq('is_active', true)
        .is('color_name', null)
        .eq('approval_status', 'approved')
        // If parent has children, show products from all related categories
        .in('category_id', ids)
        .order('created_at', { ascending: false })
        .limit(16);

      if (error) throw error;

      // Ignore stale responses
      if (reqId !== expandedReqRef.current) return;

      setExpandedProducts(dedupeByColorGroup((data || []) as any) as any[]);
    } catch (e: any) {
      if (reqId !== expandedReqRef.current) return;
      console.warn('Category products load failed', e?.message || e);
      setExpandedProducts([]);
      toast({ title: 'Could not load products', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      if (reqId === expandedReqRef.current) setExpandedLoading(false);
    }
  };
  useEffect(() => {
    if (!expandedCategory) return;
    const t = window.setTimeout(() => {
      expandedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [expandedCategory?.id]);


  const infoParagraphs = useMemo(
    () => [
      {
        title: "Bangladesh’s Trusted Tech E-Commerce Store for Phones, Gadgets & Accessories",
        text: `In Bangladesh, Spraxe has become a trusted destination for authentic gadgets and accessories. We bring together reliable brands in one place, offering everything from the latest smartphones and tablets to powerful laptops and smart wearables. You’ll also find essential accessories such as docks, hubs, protective gear, and stylus pens.

Whether you shop online or visit our store, Spraxe is committed to delivering genuine products, fast delivery, and exceptional customer service. Our diverse collection is designed to suit every lifestyle—from students and tech enthusiasts to everyday users. Plus, our dedicated customer care team is always ready to assist with product selection, warranty support, and post-purchase services.`,
      },
      {
        title: "Smartphones & Tablets from Apple, Samsung, Xiaomi, OnePlus & More",
        text: `Searching for a dependable smartphone or tablet? We offer a wide selection of devices from the world’s most trusted brands, including Apple, Samsung, Xiaomi, OnePlus, and more. Whether you’re looking for a high-end flagship or a budget-friendly option, you can easily choose a device that fits your needs and budget.

Our collection also includes the latest iPads and Galaxy Tabs, perfect for work, study, and entertainment. Every phone and tablet we sell is 100% authentic and backed by reliable after-sales support. Whether you’re upgrading your primary device or adding a secondary one, we ensure a smooth, secure, and satisfying shopping experience—both online and in-store—at competitive prices.`,
      },
      {
        title: "Mobile Accessories You Can Rely On — Cables, Cases, Power Banks",
        text: `The right accessories make everyday tech use more convenient. At Spraxe, we offer a complete range of dependable accessories, including fast-charging cables, durable power banks, magnetic wireless chargers, docks, and more. You’ll also find premium phone cases and screen protectors designed to keep your devices safe and secure.

Looking for a stylus or an adapter for your MacBook? We have those too. Every accessory is carefully selected for quality, performance, and compatibility, ensuring they work exactly as expected. Whether you’re replacing an old charger or upgrading to a wireless power bank for the first time, Spraxe has the right solution for you.`,
      },
      {
        title: "Smartwatches & Fitness Bands from Reliable Brands",
        text: `Smartwatches are no longer just for telling time—they’ve become your health tracker, workout companion, and personal assistant. At Spraxe, we offer a diverse selection of wearables, including Apple Watch, Huawei Watch, Xiaomi fitness bands, and other popular options that combine style with everyday functionality.

Stay connected with message notifications, track your activity, monitor your heart rate, or simply choose a design that matches your lifestyle. All our smartwatches and fitness bands are 100% authentic, built for long-term performance, and supported by reliable after-sales service with fast delivery.`,
      },
      {
        title: "AirPods, Wireless Earbuds & Premium Audio Devices",
        text: `Great sound makes every moment more enjoyable. At Spraxe, we bring you a carefully selected range of audio devices designed to deliver rich, clear, and uninterrupted sound. From original Apple AirPods and advanced noise-cancelling earbuds to studio-quality over-ear headphones and compact Bluetooth speakers, there’s something for every type of listener.

Whether you’re enjoying music on your daily commute or relaxing at home, our audio gear brings your sound to life. All products are 100% authentic, quality-tested, and built to deliver a crisp, immersive audio experience every time you listen.`,
      },
    ],
    []
  );

  const ProductCard = ({ product, showSold }: { product: any; showSold?: boolean }) => {
    const imgs = parseImages(product.images);
    const soldCount = bestSellerSoldMap[product.id] || 0;
    const price = getPrice(product);
    const retail = getRetail(product);
    const discountPct = retail > 0 && retail > price ? Math.round(((retail - price) / retail) * 100) : 0;
    const outOfStock = product?.stock_quantity != null && Number(product.stock_quantity) <= 0;

    return (
      <Card className="group h-full overflow-hidden rounded-xl md:rounded-2xl border border-gray-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <CardContent className="p-0 flex flex-col h-full">
          <Link
            href={`/products/${product.slug}`}
            prefetch={false}
            className="relative aspect-square bg-gray-50 overflow-hidden block"
            aria-label={`View ${(product as any)?.name}`}
          >
            {imgs?.[0] ? (
              <SafeImage
                src={imgs[0]}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 33vw, (max-width: 1200px) 25vw, 18vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-300" />
              </div>
            )}

            {/* hover overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {showSold && soldCount > 0 && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-black/80 text-white border border-white/10 ">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Sold {soldCount}
                </Badge>
              </div>
            )}

            {discountPct > 0 && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-emerald-600 text-white border border-emerald-700/20">
                  {discountPct}% OFF
                </Badge>
              </div>
            )}

            {/* Wishlist */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const key = String((product as any).color_group_id || product.id);
                const next = !isInWishlist(key);
                toggleWishlistId(key);
                toast({
                  title: next ? 'Saved' : 'Removed',
                  description: next ? 'Added to wishlist.' : 'Removed from wishlist.',
                });
              }}
              className="absolute bottom-2 right-2 z-10 rounded-full bg-white/90  p-1.5 md:p-2 shadow-sm border border-white/40 hover:bg-white"
              aria-label={isInWishlist(String((product as any).color_group_id || product.id)) ? 'Remove from wishlist' : 'Add to wishlist'}
              title={isInWishlist(String((product as any).color_group_id || product.id)) ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`h-4 w-4 ${isInWishlist(String((product as any).color_group_id || product.id)) ? 'fill-red-500 text-red-500' : 'text-gray-800'}`} />
            </button>

            {outOfStock && (
              <div className="absolute inset-0 bg-white/70  flex items-center justify-center">
                <Badge className="bg-gray-900 text-white border border-white/10">Out of stock</Badge>
              </div>
            )}
          </Link>

          <div className="p-2 sm:p-2.5 md:p-4 flex flex-col flex-1 gap-1 md:gap-2">
            <Link href={`/products/${product.slug}`} prefetch={false} className="block">
              <h3 className="text-[11px] sm:text-[13px] md:text-[15px] font-semibold text-gray-900 line-clamp-2 min-h-[2.1rem] sm:min-h-[2.35rem] leading-snug transition group-hover:text-blue-900">
                {product.name}
              </h3>
            </Link>

            <div className="mt-auto">
              <div className="flex items-baseline gap-2">
                <p className="text-[13px] sm:text-[15px] md:text-lg font-extrabold text-blue-900">{moneyBDT(price)}</p>
                {discountPct > 0 && (
                  <p className="text-xs text-gray-500 line-through">{moneyBDT(retail)}</p>
                )}
              </div>

              <Button
                onClick={() => {
                  handleBuyNow(product.id, product.name);
                }}
                disabled={outOfStock}
                className="mt-1.5 sm:mt-2 md:mt-3 w-full h-7 sm:h-8 md:h-9 rounded-lg md:rounded-xl font-semibold text-[11px] sm:text-sm"
                size="sm"
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                {outOfStock ? 'Out of stock' : 'Buy Now'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const banner = homeMidBanner as
    | { image_url?: string; mobile_image_url?: string; link_url?: string; is_active?: boolean; title?: string }
    | null;

  const showBanner = !!banner?.is_active && (!!banner?.image_url || !!banner?.mobile_image_url);
  const bannerSrc =
    (isMobileViewport && banner?.mobile_image_url ? banner.mobile_image_url : banner?.image_url || banner?.mobile_image_url) as string;

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of expandedProducts || []) {
      const b = String((p as any).supplier_name || '').trim();
      if (b) set.add(b);
    }
    return ['All brand', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [expandedProducts]);

  const expandedFiltered = useMemo(() => {
    if (!expandedCategory) return [];
    if (expandedBrand === 'All brand') return expandedProducts;
    return (expandedProducts || []).filter((p) => String((p as any).supplier_name || '').trim() === expandedBrand);
  }, [expandedBrand, expandedProducts, expandedCategory]);

  const clearRecentlyViewed = () => {
    try {
      window.localStorage.setItem('recently_viewed_product_ids', JSON.stringify([]));
    } catch {
      // ignore
    }
    setRecentlyViewed([]);
    toast({ title: 'Cleared', description: 'Recently viewed list cleared.' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="pt-4 pb-4 md:pt-7 md:pb-6">
        <div className="w-full max-w-7xl mx-auto px-3 md:px-4">
          <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
            {loading ? (
              <Skeleton className="w-full h-[220px] md:h-[380px]" />
            ) : heroFeaturedImages.length > 0 ? (
              <Carousel
                opts={{ align: 'start', loop: heroFeaturedImages.length > 1 }}
                className="w-full"
                setApi={setCarouselApi}
              >
                <CarouselContent className="-ml-0">
                  {heroFeaturedImages.map((item: any, idx: number) => {
                    const rawSrc = isMobileViewport
                      ? (item?.mobile_image_url ||
                          item?.mobileImageUrl ||
                          item?.mobile_image ||
                          item?.mobileImage ||
                          item?.image_url ||
                          item?.imageUrl)
                      : (item?.image_url ||
                          item?.imageUrl ||
                          item?.desktop_image_url ||
                          item?.desktopImageUrl ||
                          item?.mobile_image_url ||
                          item?.mobileImageUrl);

                    const src = resolvePublicImageUrl(String(rawSrc || ''));

                    const slide = (
                      <div className="relative w-full h-[220px] md:h-[380px] bg-gray-100">
                        <SafeImage
                          src={src}
                          alt={String(item?.title || 'Featured')}
                          fill
                          sizes="(max-width: 768px) 100vw, 1200px"
                          className="object-cover"
                          loading={idx === 0 ? 'eager' : 'lazy'}
                          draggable={false}
                        />
                      </div>
                    );

                    return (
                      <CarouselItem key={item?.id ?? idx} className="pl-0 basis-full">
                        {item?.link_url ? (
                          <Link href={item.link_url} prefetch={false} className="block">
                            {slide}
                          </Link>
                        ) : (
                          slide
                        )}
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>

                {heroFeaturedImages.length > 1 ? (
                  <>
                    <CarouselPrevious className="left-2 bg-white/90 hover:bg-white border border-gray-200 shadow-sm text-gray-900 h-9 w-9" />
                    <CarouselNext className="right-2 bg-white/90 hover:bg-white border border-gray-200 shadow-sm text-gray-900 h-9 w-9" />
                  </>
                ) : null}

                {heroFeaturedImages.length > 1 ? (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {heroFeaturedImages.map((_: any, index: number) => (
                      <button
                        key={index}
                        onClick={() => carouselApi?.scrollTo(index)}
                        className={`h-1.5 rounded-full transition-all ${
                          currentSlide === index ? 'w-6 bg-blue-900' : 'w-1.5 bg-white/70'
                        }`}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : null}
              </Carousel>
            ) : (
              <div className="w-full h-[220px] md:h-[380px] flex items-center justify-center text-sm text-gray-500">No hero images</div>
            )}
          </div>
        </div>
      </section>

      {/* Recently viewed */}
      {(recentlyViewedLoading || recentlyViewed.length > 0) && (
        <section className="relative py-7 md:py-10">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[90%] max-w-6xl rounded-[52px] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_60%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_55%)] blur-2xl" />
          </div>

          <div className="w-full max-w-7xl mx-auto px-3 md:px-4">
            <div className="relative rounded-3xl p-[2px] bg-gradient-to-r from-white/60 via-slate-200/70 to-white/60 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="rounded-[22px] bg-white border border-white/60 px-3 py-4 md:px-6 md:py-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-base md:text-xl font-bold tracking-tight text-gray-900">
                Recently Viewed
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={clearRecentlyViewed}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
                <Link href="/products" className="text-xs md:text-sm font-medium text-blue-700 hover:underline">
                  Continue shopping
                </Link>
              </div>
            </div>

            {recentlyViewedLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 md:gap-3">
                {[...Array(8)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-2">
                      <Skeleton className="w-full aspect-square mb-2" />
                      <Skeleton className="w-full h-3 mb-2" />
                      <Skeleton className="w-3/4 h-3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
) : (
  <>
    <MobileGridCarousel
      items={recentlyViewed.slice(0, 16) as any}
      renderItem={(p) => <ProductCard product={p as any} />}
    />

    <div className="hidden md:block">
      <Carousel opts={{ align: 'start', loop: false }} className="w-full">
        <CarouselContent className="-ml-3">
          {recentlyViewed.slice(0, 16).map((p) => (
            <CarouselItem
              key={p.id}
              className="pl-3 basis-[30%] lg:basis-[20%] xl:basis-[16%] 2xl:basis-[14%]"
            >
              <ProductCard product={p as any} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-3 md:-left-5 bg-white hover:bg-white border border-gray-300 shadow-md h-10 w-10" />
        <CarouselNext className="-right-3 md:-right-5 bg-white hover:bg-white border border-gray-300 shadow-md h-10 w-10" />
      </Carousel>
    </div>
  </>
)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="relative py-5 md:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-[-6rem] h-80 w-80 rounded-full bg-blue-200/25 blur-3xl" />
          <div className="absolute -bottom-28 left-[-7rem] h-96 w-96 rounded-full bg-orange-200/20 blur-3xl" />
        </div>

        <div className="w-full max-w-7xl mx-auto px-3 md:px-4">
          <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-[0_18px_60px_-44px_rgba(15,23,42,0.45)] px-3 py-3 md:px-6 md:py-6">
            <div className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(1000px_circle_at_10%_0%,rgba(59,130,246,0.10),transparent_55%),radial-gradient(900px_circle_at_90%_10%,rgba(249,115,22,0.08),transparent_55%),radial-gradient(900px_circle_at_60%_100%,rgba(16,185,129,0.06),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
                <h2 className="font-heading text-base md:text-2xl font-bold tracking-tight text-gray-900">
                  Shop by Category
                </h2>

                <Link
                  href="/products"
                  className="text-xs md:text-sm font-semibold text-blue-800 hover:text-orange-700 hover:underline flex items-center shrink-0"
                >
                  See all <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-0.5" />
                </Link>
              </div>

              {loading ? (
                <div className="flex gap-4 overflow-hidden py-1">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-16 md:h-24 md:w-24 rounded-full flex-shrink-0" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Mobile: slider (4 categories per view) */}
                  <div className="md:hidden relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white/90 to-transparent rounded-l-[22px]" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/90 to-transparent rounded-r-[22px]" />
                    <Carousel opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }} className="w-full">
                      <CarouselContent className="-ml-2">
                        {categories.map((cat) => {
                          const isActive = expandedCategory?.id === cat.id;
                          const isBusy = expandedLoading && isActive;

                          return (
                            <CarouselItem key={(cat as any).id} className="pl-2 basis-1/4">
                              <button
                                type="button"
                                aria-disabled={isBusy}
                                onClick={() => void onCategoryClick(cat)}
                                className={`group block text-center w-full touch-manipulation select-none ${
                                  isBusy ? 'opacity-85' : ''
                                }`}
                                aria-label={`Expand ${(cat as any).name} products`}
                              >
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="relative">
                                    <span
                                      className={`absolute -inset-2 rounded-full bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_60%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.16),transparent_55%)] blur-md transition-opacity ${
                                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                    />
                                    <div
                                      className={`relative rounded-full p-0 transition-all ${
                                        isActive
                                          ? 'shadow-lg -translate-y-0.5'
                                          : 'group-hover:shadow-lg group-hover:-translate-y-0.5'
                                      }`}
                                    >
                                      <div
                                        className={`relative w-16 h-16 rounded-full overflow-hidden bg-white shadow-sm transition-all ${
                                          isActive ? 'shadow-md' : 'group-hover:shadow-md'
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(255,255,255,0.35),transparent_70%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_60%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.10),transparent_60%)] ${
                                            isActive ? 'opacity-100' : 'opacity-80'
                                          }`}
                                        />
                                        {(cat as any).image_url ? (
                                          <div className="relative w-full h-full p-2.5">
                                            <SafeImage
                                              src={(cat as any).image_url}
                                              alt={(cat as any).name}
                                              fill
                                              sizes="64px"
                                              className="object-contain object-center group-hover:scale-105 transition-transform duration-300"
                                            />
                                          </div>
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-6 h-6 text-gray-300" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    className={`text-[11px] font-medium leading-tight line-clamp-2 px-0.5 ${
                                      isActive ? 'text-blue-900' : 'text-gray-900 group-hover:text-blue-800'
                                    }`}
                                  >
                                    {(cat as any).name}
                                  </span>
                                </div>
                              </button>
                            </CarouselItem>
                          );
                        })}
                      </CarouselContent>

                      {categories.length > 4 ? (
                        <>
                          <CarouselPrevious className="-left-3 bg-white hover:bg-white border border-gray-300 shadow-md h-8 w-8" />
                          <CarouselNext className="-right-3 bg-white hover:bg-white border border-gray-300 shadow-md h-8 w-8" />
                        </>
                      ) : null}
                    </Carousel>
                  </div>

                  {/* Desktop: carousel */}
                  <div className="hidden md:block relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/90 to-transparent rounded-l-[22px]" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white/90 to-transparent rounded-r-[22px]" />
                    <Carousel opts={{ align: 'start', dragFree: true, containScroll: 'trimSnaps' }} className="w-full">
                      <CarouselContent className="-ml-3">
                        {categories.map((cat) => {
                          const isActive = expandedCategory?.id === cat.id;
                          const isBusy = expandedLoading && isActive;

                          return (
                            <CarouselItem
                              key={(cat as any).id}
                              className="pl-3 basis-[28%] sm:basis-[20%] md:basis-[14%] lg:basis-[10%]"
                            >
                              <button
                                type="button"
                                aria-disabled={isBusy}
                                onClick={() => void onCategoryClick(cat)}
                                className={`group block text-center w-full touch-manipulation select-none ${
                                  isBusy ? 'opacity-85' : ''
                                }`}
                                aria-label={`Expand ${(cat as any).name} products`}
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <div className="relative">
                                    <span
                                      className={`absolute -inset-2 rounded-full bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_60%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.16),transparent_55%)] blur-md transition-opacity ${
                                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                    />
                                    <div
                                      className={`relative rounded-full p-0 transition-all ${
                                        isActive
                                          ? 'shadow-lg -translate-y-0.5'
                                          : 'group-hover:shadow-lg group-hover:-translate-y-0.5'
                                      }`}
                                    >
                                      <div
                                        className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-white shadow-sm transition-all ${
                                          isActive ? 'shadow-md' : 'group-hover:shadow-md'
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(255,255,255,0.35),transparent_70%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_60%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.10),transparent_60%)] ${
                                            isActive ? 'opacity-100' : 'opacity-80'
                                          }`}
                                        />
                                      {(cat as any).image_url ? (
                                        <div className="relative w-full h-full p-3 md:p-3.5">
                                          <SafeImage
                                            src={(cat as any).image_url}
                                            alt={(cat as any).name}
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
                                    </div>
                                  </div>
                                  <span
                                    className={`text-xs md:text-sm font-medium leading-tight line-clamp-2 px-1 ${
                                      isActive ? 'text-blue-900' : 'text-gray-900 group-hover:text-blue-800'
                                    }`}
                                  >
                                    {(cat as any).name}
                                  </span>
                                  <span
                                    className={`h-1 w-8 rounded-full transition-opacity ${
                                      isActive ? 'opacity-100 bg-gradient-to-r from-blue-600 via-orange-500 to-emerald-600' : 'opacity-0'
                                    }`}
                                  />
                                </div>
                              </button>
                            </CarouselItem>
                          );
                        })}
                      </CarouselContent>

                      <CarouselPrevious className="-left-4 bg-white/80 hover:bg-white border border-gray-200 shadow-sm h-10 w-10" />
                      <CarouselNext className="-right-4 bg-white/80 hover:bg-white border border-gray-200 shadow-sm h-10 w-10" />
                    </Carousel>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Expanded Category Products (#12) */}
      {expandedCategory && (
        <section ref={expandedSectionRef} id="expanded-category" className="bg-white border-b border-gray-100 scroll-mt-24">
          <div className="w-full max-w-7xl mx-auto px-4 py-5">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">{(expandedCategory as any).name}</h3>
                <p className="text-xs md:text-sm text-gray-600">Browse products and filter by brand</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/${expandedCategory.slug}`} className="inline-flex">
                  <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700 text-white shadow-sm">
                    View all
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setExpandedCategory(null);
                    setExpandedProducts([]);
                    setExpandedBrand('All brand');
                  }}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Brand filter */}
            <div className="mt-4 flex flex-wrap gap-2">
              {brandOptions.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setExpandedBrand(b)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    expandedBrand === b
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:text-blue-800'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {expandedLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-2">
                        <Skeleton className="w-full aspect-square mb-2" />
                        <Skeleton className="w-full h-3 mb-2" />
                        <Skeleton className="w-3/4 h-3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : expandedFiltered.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 border border-gray-100 rounded-xl">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium">No products found</p>
                  <p className="text-gray-500 text-sm">Try another brand or category.</p>
                </div>
) : (
  <>
    <MobileGridCarousel
      items={expandedFiltered.slice(0, 16) as any}
      renderItem={(product) => <ProductCard product={product as any} />}
    />

    <div className="hidden md:block">
      <Carousel opts={{ align: 'start', loop: true }} className="w-full">
        <CarouselContent className="-ml-3">
          {expandedFiltered.slice(0, 16).map((product) => (
            <CarouselItem
              key={(product as any).id}
              className="pl-3 basis-[30%] lg:basis-[20%] xl:basis-[16%] 2xl:basis-[14%]"
            >
              <ProductCard product={product} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-3 md:-left-5 bg-white hover:bg-white border border-gray-300 shadow-md h-10 w-10" />
        <CarouselNext className="-right-3 md:-right-5 bg-white hover:bg-white border border-gray-300 shadow-md h-10 w-10" />
      </Carousel>
    </div>
  </>
)}
            </div>
          </div>
        </section>
      )}

      {/* New Arrivals */}
      <section
        className="relative py-7 md:py-12"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '800px' }}
      >
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-[-6rem] h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl" />
          <div className="absolute -bottom-28 left-[-7rem] h-96 w-96 rounded-full bg-blue-200/20 blur-3xl" />
        </div>
        <div className="w-full max-w-7xl mx-auto px-3 md:px-4">
          <div className="relative rounded-3xl p-[3px] bg-gradient-to-r from-white/60 via-blue-200/60 to-white/60 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.5)]">
            <div className="rounded-[22px] bg-white border border-white/60 px-3 py-4 md:px-6 md:py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading text-base md:text-2xl font-bold tracking-tight text-gray-900">
                New Arrivals
              </h2>
              <p className="text-xs md:text-sm text-gray-600">Freshly added products</p>
            </div>
            <Link href="/products">
              <Button variant="outline" size="sm" className="h-7 md:h-8 text-[11px] md:text-xs">
                View All
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 md:gap-3">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-2">
                    <Skeleton className="w-full aspect-square mb-2" />
                    <Skeleton className="w-full h-3 mb-2" />
                    <Skeleton className="w-3/4 h-3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : newArrivals.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 border border-gray-100 rounded-xl">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">No new arrivals yet</p>
              <p className="text-gray-500 text-sm">They will show up as products are added.</p>
            </div>
) : (
  <>
    <MobileGridCarousel
      items={newArrivals.slice(0, 16) as any}
      renderItem={(product) => <ProductCard product={product as any} />}
    />

    <div className="hidden md:block">
      <Carousel opts={{ align: 'start', loop: true }} className="w-full">
        <CarouselContent className="-ml-3">
          {newArrivals.slice(0, 16).map((product) => (
            <CarouselItem
              key={(product as any).id}
              className="pl-3 basis-[30%] lg:basis-[20%] xl:basis-[16%] 2xl:basis-[14%]"
            >
              <ProductCard product={product} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-3 md:-left-5 bg-white hover:bg-white border border-gray-300 shadow-md h-10 w-10" />
        <CarouselNext className="-right-3 md:-right-5 bg-white hover:bg-white border border-gray-300 shadow-md h-10 w-10" />
      </Carousel>
    </div>
  </>
)}
            </div>
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      <section
        className="relative py-7 md:py-12"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '800px' }}
      >
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-[-6rem] h-80 w-80 rounded-full bg-orange-200/20 blur-3xl" />
          <div className="absolute -bottom-28 left-[-7rem] h-96 w-96 rounded-full bg-indigo-200/20 blur-3xl" />
        </div>
        <div className="w-full max-w-7xl mx-auto px-3 md:px-4">
          <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-[0_18px_60px_-44px_rgba(15,23,42,0.45)] px-3 py-4 md:px-6 md:py-6">
            <div className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(1000px_circle_at_10%_0%,rgba(249,115,22,0.10),transparent_55%),radial-gradient(900px_circle_at_90%_10%,rgba(99,102,241,0.08),transparent_55%),radial-gradient(900px_circle_at_60%_100%,rgba(16,185,129,0.06),transparent_60%)]" />
            <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading text-base md:text-2xl font-bold tracking-tight text-gray-900">
                Best Sellers
              </h2>
              <p className="text-xs md:text-sm text-gray-600">Based on real order quantities</p>
            </div>
            <Link href="/products">
              <Button variant="outline" size="sm" className="h-7 md:h-8 text-[11px] md:text-xs">
                View All
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 md:gap-3">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-2">
                    <Skeleton className="w-full aspect-square mb-2" />
                    <Skeleton className="w-full h-3 mb-2" />
                    <Skeleton className="w-3/4 h-3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : bestSellers.length === 0 ? (
            <div className="text-center py-10 bg-white/70 rounded-xl shadow-sm">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">No best sellers yet</p>
              <p className="text-gray-500 text-sm">They will appear once orders are placed.</p>
            </div>
          ) : (
            <>
              <MobileGridCarousel
                items={bestSellers.slice(0, 16) as any}
                renderItem={(product) => <ProductCard product={product as any} showSold />}
              />

              <div className="hidden md:grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 md:gap-3">
                {bestSellers.map((product) => (
                  <ProductCard key={(product as any).id} product={product} showSold />
                ))}
              </div>
            </>
          )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="relative py-7 md:py-12">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-[-6rem] h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />
          <div className="absolute -bottom-28 left-[-7rem] h-96 w-96 rounded-full bg-emerald-200/18 blur-3xl" />
        </div>
        <div className="w-full max-w-7xl mx-auto px-3 md:px-4">
          <div className="relative rounded-3xl p-[3px] bg-gradient-to-r from-white/60 via-emerald-200/55 to-white/60 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.5)]">
            <div className="rounded-[22px] bg-white border border-white/60 px-3 py-4 md:px-6 md:py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading text-base md:text-2xl font-bold tracking-tight text-gray-900">
                Featured Ad
              </h2>
              <p className="text-xs md:text-sm text-gray-600">Top picks selected by us</p>
            </div>
            <Link href="/products">
              <Button variant="outline" size="sm" className="h-7 md:h-8 text-[11px] md:text-xs">
                View All
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 md:gap-3">
              {[...Array(12)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-2">
                    <Skeleton className="w-full aspect-square mb-2" />
                    <Skeleton className="w-full h-3 mb-2" />
                    <Skeleton className="w-3/4 h-3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
              <p className="text-gray-600 mb-4">Products will appear here once added.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 md:gap-3">
              {products.map((product) => (
                <ProductCard key={(product as any).id} product={product} />
              ))}
            </div>
          )}
            </div>
          </div>
        </div>
      </section>

      {/* Mid-page banner */}
      {showBanner && (
        <section className="relative py-8 md:py-12">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 left-[-6rem] h-96 w-96 rounded-full bg-blue-200/20 blur-3xl" />
            <div className="absolute -bottom-28 right-[-7rem] h-[28rem] w-[28rem] rounded-full bg-orange-200/18 blur-3xl" />
          </div>
          <div className="w-full max-w-7xl mx-auto px-3 md:px-4">
            <div className="relative overflow-hidden rounded-3xl shadow-[0_24px_80px_-45px_rgba(15,23,42,0.6)]">
              <div className="relative overflow-hidden rounded-3xl bg-white/0">
              {banner?.link_url ? (
                <Link href={banner.link_url} className="block relative h-[140px] md:h-[240px]">
                  <SafeImage
                    src={bannerSrc}
                    alt={banner?.title || 'Promotion'}
                    fill
                    sizes="(max-width: 768px) 100vw, 1200px"
                    // Banner: use mobile creative when provided
                    className="object-cover"
                    priority
                  />
                </Link>
              ) : (
                <div className="relative h-[140px] md:h-[240px]">
                  <SafeImage
                    src={bannerSrc}
                    alt={banner?.title || 'Promotion'}
                    fill
                    sizes="(max-width: 768px) 100vw, 1200px"
                    // Banner: use mobile creative when provided
                    className="object-cover"
                    priority
                  />
                </div>
              )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Info section: 2 paragraphs + image carousel, then 3 paragraphs below */}
      <section
        className="relative py-8 md:py-12 bg-gradient-to-b from-gray-50 via-white to-gray-50"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '900px' }}
      >
        {/* Soft background accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-orange-200/25 blur-3xl" />
          <div className="absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl" />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-3 md:px-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* Paragraph 1 */}
            <div className="rounded-2xl p-4 md:p-6 bg-white text-gray-900 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow h-full">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-gray-900">
                {infoParagraphs[0]?.title}
              </h3>
              <p className="mt-2 text-sm md:text-[15px] leading-6 md:leading-7 text-gray-600 whitespace-pre-line">
                {infoParagraphs[0]?.text}
              </p>
            </div>

            {/* Middle image carousel (managed from Admin → Featured Images) */}
            <div className="rounded-2xl bg-white text-gray-900 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow h-full overflow-hidden">
              {infoCarouselImages.length > 0 ? (
                <div className="relative w-full h-[240px] md:h-[260px]">
                  <Carousel
                    opts={{ align: 'start', loop: infoCarouselImages.length > 1 }}
                    className="w-full h-full"
                    setApi={setInfoCarouselApi}
                  >
                    <CarouselContent className="h-full">
                      {infoCarouselImages.map((img: any) => (
                        <CarouselItem key={img.id} className="h-full">
                          {img.link_url ? (
                            <Link href={img.link_url} prefetch={false} className="block h-full">
                              <div className="relative w-full h-full bg-gray-100">
                                <SafeImage
                                  src={resolvePublicImageUrl(
                                    isMobileViewport
                                      ? (img?.mobile_image_url ??
                                          img?.mobileImageUrl ??
                                          img?.mobile_image ??
                                          img?.mobileImage ??
                                          img?.image_url ??
                                          img?.imageUrl)
                                      : (img?.image_url ??
                                          img?.imageUrl ??
                                          img?.desktop_image_url ??
                                          img?.desktopImageUrl ??
                                          img?.mobile_image_url ??
                                          img?.mobileImageUrl)
                                  )}
                                  alt={img.title || 'Featured'}
                                  fill
                                  sizes="(max-width: 768px) 100vw, 400px"
                                  className="object-cover"
                                />
                              </div>
                            </Link>
                          ) : (
                            <div className="relative w-full h-full bg-gray-100">
                              <SafeImage
                                src={resolvePublicImageUrl(
                                    isMobileViewport
                                      ? (img?.mobile_image_url ??
                                          img?.mobileImageUrl ??
                                          img?.mobile_image ??
                                          img?.mobileImage ??
                                          img?.image_url ??
                                          img?.imageUrl)
                                      : (img?.image_url ??
                                          img?.imageUrl ??
                                          img?.desktop_image_url ??
                                          img?.desktopImageUrl ??
                                          img?.mobile_image_url ??
                                          img?.mobileImageUrl)
                                  )}
                                alt={img.title || 'Featured'}
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                className="object-cover"
                              />
                            </div>
                          )}
                        </CarouselItem>
                      ))}
                    </CarouselContent>

                    {infoCarouselImages.length > 1 ? (
                      <>
                        <CarouselPrevious className="left-2 bg-white hover:bg-white border border-gray-300 shadow-md text-gray-900 h-8 w-8 md:h-10 md:w-10" />
                        <CarouselNext className="right-2 bg-white hover:bg-white border border-gray-300 shadow-md text-gray-900 h-8 w-8 md:h-10 md:w-10" />
                      </>
                    ) : null}
                  </Carousel>

                  {infoCarouselImages.length > 1 ? (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {infoCarouselImages.map((_: any, index: number) => (
                        <button
                          key={index}
                          onClick={() => infoCarouselApi?.scrollTo(index)}
                          className={`h-1.5 rounded-full transition-all ${
                            infoCurrentSlide === index ? 'w-6 bg-blue-900' : 'w-1.5 bg-white/70'
                          }`}
                          aria-label={`Go to slide ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="w-full h-[240px] md:h-[260px] bg-gray-100 ring-1 ring-black/5 flex items-center justify-center text-sm text-gray-500">
                  Add carousel images from Admin → Featured Images
                </div>
              )}
            </div>

            {/* Paragraph 2 */}
            <div className="rounded-2xl p-4 md:p-6 bg-white text-gray-900 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow h-full">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-gray-900">
                {infoParagraphs[1]?.title}
              </h3>
              <p className="mt-2 text-sm md:text-[15px] leading-6 md:leading-7 text-gray-600 whitespace-pre-line">
                {infoParagraphs[1]?.text}
              </p>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4">
            {[infoParagraphs[2], infoParagraphs[3], infoParagraphs[4]].map((item) => (
              <div
                key={item?.title}
                className="rounded-2xl p-4 md:p-6 bg-white text-gray-900 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
              >
                <h3 className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-gray-900">
                  {item?.title}
                </h3>
                <p className="mt-2 text-sm md:text-[15px] leading-6 md:leading-7 text-gray-600 whitespace-pre-line">
                  {item?.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
