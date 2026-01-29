'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useWishlist } from '@/lib/wishlist/wishlist-context';
import { useCart } from '@/lib/cart/cart-context';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Heart, ShoppingCart, Package, Trash2 } from 'lucide-react';

type ProductLite = {
  id: string;
  name: string;
  slug: string;
  price?: number | null;
  base_price?: number | null;
  retail_price?: number | null;
  images?: any;
  stock_quantity?: number | null;
  is_featured?: boolean | null;
};

function parseImages(images: any): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === 'string') {
    const s = images.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.filter(Boolean);
      } catch {}
    }
  }
  return [];
}

function moneyBDT(n: number) {
  return `৳${Math.round(n || 0).toLocaleString('en-BD')}`;
}

function getPrice(p: any): number {
  const v = Number(p?.price ?? p?.base_price ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export default function WishlistPageClient() {
  const { ids, remove, clear } = useWishlist();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  const orderedIds = useMemo(() => ids.slice(0, 200), [ids]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      if (orderedIds.length === 0) {
        setProducts([]);
        return;
      }

      setLoading(true);
      try {
        // Supabase client may be a proxy if env is missing; keep this inside try/catch.
        // Wishlist ids may be base product ids OR color_group_id (when added from a variant).
        const baseQuery = supabase
          .from('products')
          .select(
            'id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,color_group_id,color_name,color_hex'
          )
          .eq('is_active', true)
          .limit(250);

        const [{ data: byId, error: err1 }, { data: byGroup, error: err2 }] = await Promise.all([
          baseQuery.in('id', orderedIds),
          baseQuery.in('color_group_id', orderedIds).is('color_name', null),
        ]);

        if (err1) throw err1;
        if (err2) throw err2;

        const idMap = new Map((byId || []).map((x: any) => [x.id, x]));
        const groupMap = new Map((byGroup || []).map((x: any) => [String((x as any).color_group_id || x.id), x]));
        const ordered = orderedIds.map((k) => idMap.get(k) || groupMap.get(k)).filter(Boolean);
        if (!cancelled) setProducts(ordered as ProductLite[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load wishlist.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderedIds]);

  const handleQuickAdd = async (p: ProductLite) => {
    setAddingId(p.id);
    try {
      await addToCart(p.id, 1);
      toast({ title: 'Added to cart', description: `${p.name} added to your cart.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to add item to cart.', variant: 'destructive' });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Wishlist</h1>
          <p className="text-sm text-gray-600 mt-1">
            {orderedIds.length ? (
              <>
                You have <span className="font-semibold">{orderedIds.length}</span> saved item{orderedIds.length === 1 ? '' : 's'}.
              </>
            ) : (
              <>Save products you like and come back anytime.</>
            )}
          </p>
        </div>

        {orderedIds.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => {
                clear();
                toast({ title: 'Cleared', description: 'Your wishlist is now empty.' });
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all
            </Button>
            <Link href="/products">
              <Button className="bg-blue-900 hover:bg-blue-950">Continue shopping</Button>
            </Link>
          </div>
        ) : (
          <Link href="/products">
            <Button className="bg-blue-900 hover:bg-blue-950">Browse products</Button>
          </Link>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold text-red-900">Could not load wishlist</div>
          <div className="mt-1">{error}</div>
          <div className="mt-3">
            <Link href="/products">
              <Button size="sm" className="bg-blue-900 hover:bg-blue-950">Go to products</Button>
            </Link>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: Math.min(10, Math.max(6, orderedIds.length || 6)) }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : orderedIds.length === 0 ? (
        <div className="rounded-2xl border bg-white shadow-sm p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Heart className="h-7 w-7 text-blue-900" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold text-gray-900">Your wishlist is empty</h2>
          <p className="mt-2 text-sm text-gray-600">Tap the heart icon on any product to save it here.</p>
          <Link href="/products">
            <Button className="mt-6 bg-blue-900 hover:bg-blue-950">Explore products</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p) => {
            const imgs = parseImages(p.images);
            const price = getPrice(p);
            const retail = Number(p.retail_price ?? 0) || 0;
            const discountPct = retail > 0 && retail > price ? Math.round(((retail - price) / retail) * 100) : 0;
            const outOfStock = (p.stock_quantity ?? 0) <= 0;

            return (
              <Card key={p.id} className="group h-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="p-0 flex flex-col h-full">
                  <div className="relative aspect-square bg-gray-50 overflow-hidden">
                    <Link href={`/products/${p.slug}`} className="absolute inset-0" aria-label={`View ${p.name}`}>
                      {imgs?.[0] ? (
                        <SafeImage
                          src={imgs[0]}
                          alt={p.name}
                          fill
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 18vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-gray-300" />
                        </div>
                      )}
                    </Link>

                    {discountPct > 0 ? (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-emerald-600 text-white border border-emerald-700/20">{discountPct}% OFF</Badge>
                      </div>
                    ) : null}

                    {outOfStock ? (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                        <Badge className="bg-gray-900 text-white border border-white/10">Out of stock</Badge>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        remove(p.id);
                        toast({ title: 'Removed', description: 'Removed from wishlist.' });
                      }}
                      className="absolute top-2 right-2 z-10 rounded-full bg-white/90 backdrop-blur px-2.5 py-2 shadow-sm border hover:bg-white"
                      aria-label="Remove from wishlist"
                      title="Remove"
                    >
                      <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                    </button>
                  </div>

                  <div className="p-3 md:p-4 flex flex-col flex-1 gap-2">
                    <Link href={`/products/${p.slug}`} className="block">
                      <h3 className="text-sm md:text-[15px] font-semibold text-gray-900 line-clamp-2 min-h-[2.6rem] leading-snug transition group-hover:text-blue-900">
                        {p.name}
                      </h3>
                    </Link>

                    <div className="mt-auto">
                      <div className="flex items-baseline gap-2">
                        <p className="text-base md:text-lg font-extrabold text-blue-900">{moneyBDT(price)}</p>
                        {discountPct > 0 ? (
                          <p className="text-xs text-gray-500 line-through">{moneyBDT(retail)}</p>
                        ) : null}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button
                          onClick={() => handleQuickAdd(p)}
                          disabled={outOfStock || addingId === p.id}
                          className="flex-1 h-9 rounded-xl font-semibold bg-blue-900 hover:bg-blue-950"
                          size="sm"
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          {addingId === p.id ? 'Adding...' : 'Add'}
                        </Button>
                        <Link href={`/products/${p.slug}`} className="flex-shrink-0">
                          <Button variant="outline" className="h-9 rounded-xl bg-white" size="sm">View</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
