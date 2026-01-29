'use client';

import Link from 'next/link';
import { SafeImage } from '@/components/ui/safe-image';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { supabase } from '@/lib/supabase/client';
import { dedupeByColorGroup } from '@/lib/utils/product-dedupe';
import { useCart } from '@/lib/cart/cart-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

type FeaturedProductRow = {
  id: string;
  name: string;
  slug: string;
  images: any;
  price: number | null;
  base_price?: number | null;
  retail_price: number | null;
  stock_quantity: number | null;
  is_featured: boolean | null;
};

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

function getPrice(p: FeaturedProductRow): number {
  const v = Number(p?.price ?? p?.retail_price ?? (p as any)?.base_price ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function moneyBDT(n: number) {
  return `৳${(n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

export default function FeaturedPage() {
  const { addToCart } = useCart();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FeaturedProductRow[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id,name,slug,images,price,base_price,retail_price,stock_quantity,is_featured')
        .eq('is_active', true)
      .is('color_name', null)
        .eq('is_featured', true)
        .order('updated_at', { ascending: false })
        .limit(48);

      if (error) {
        console.warn('Featured products fetch failed:', error.message);
        setItems([]);
      } else {
        setItems(dedupeByColorGroup((data || []) as any) as any);
      }
      setLoading(false);
    };

    void run();
  }, []);

  const hasItems = items.length > 0;

  const cards = useMemo(() => {
    if (loading) {
      return Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="overflow-hidden border-gray-200">
          <CardContent className="p-0">
            <Skeleton className="aspect-square w-full" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-9 w-full" />
            </div>
          </CardContent>
        </Card>
      ));
    }

    return items.map((p) => {
      const imgs = parseImages(p.images);
      const img = imgs[0] || '/spraxe.png';
      const price = getPrice(p);
      const outOfStock = Number(p.stock_quantity ?? 0) <= 0;

      return (
        <Card key={p.id} className="overflow-hidden border-gray-200 hover:shadow-md transition">
          <CardContent className="p-0 flex flex-col h-full">
            <Link href={`/products/${p.slug}`} className="block">
              <div className="relative aspect-square w-full bg-gray-50">
                <SafeImage src={img} alt={p.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
              </div>
            </Link>

            <div className="p-4 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/products/${p.slug}`} className="font-semibold text-sm text-gray-900 hover:underline line-clamp-2">
                  {p.name}
                </Link>
                {p.is_featured && <Badge className="shrink-0">Featured</Badge>}
              </div>

              <div className="text-lg font-extrabold text-gray-900">{moneyBDT(price)}</div>

              <Button
                className="mt-auto w-full"
                disabled={outOfStock}
                onClick={async () => {
                  try {
                    await addToCart(p.id, 1);
                    toast({ title: 'Added to Cart', description: `${p.name} added to your cart` });
                  } catch {
                    toast({ title: 'Error', description: 'Failed to add to cart', variant: 'destructive' });
                  }
                }}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {outOfStock ? 'Out of stock' : 'Add to cart'}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    });
  }, [addToCart, items, loading, toast]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-bold text-black">Featured</h1>
                <p className="text-gray-600 mt-2">Hand-picked products we think you’ll love.</p>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/products?featured=1" className="text-sm font-semibold text-blue-700 hover:underline">
                  Browse with filters
                </Link>
              </div>
            </div>

            {!loading && !hasItems ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-lg font-semibold">No featured products right now</div>
                  <p className="text-gray-600 mt-2">Check back soon — we update this section regularly.</p>
                  <div className="mt-6">
                    <Link href="/products">
                      <Button>View all products</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{cards}</div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
