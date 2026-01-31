'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { dedupeByColorGroup } from '@/lib/utils/product-dedupe';
import { useCart } from '@/lib/cart/cart-context';
import { useCompare } from '@/lib/compare/compare-context';
import { useWishlist } from '@/lib/wishlist/wishlist-context';
import type { Product, Category } from '@/lib/supabase/types';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SafeImage } from '@/components/ui/safe-image';
import { DEFAULT_SIZE_OPTIONS, parseSizeChart } from '@/lib/utils/size-chart';

import {
  ShoppingCart,
  Package,
  Minus,
  Plus,
  CreditCard,
  MessageCircle,
  ChevronRight,
  Home,
  ShieldCheck,
  Truck,
  RotateCcw,
  Star,
  Copy,
  Share2,
  Heart,
  X,
  ChevronLeft,
  ChevronDown,
  AlertTriangle,
  GitCompare,
} from 'lucide-react';

const isClothingCategory = (name?: string | null, slug?: string | null) => {
  const hay = `${name || ''} ${slug || ''}`.toLowerCase();
  const isGender = /\b(men|mens|man|mans|women|womens|woman|female|male)\b/i.test(hay);
  const isClothing = /\b(cloth|clothing|apparel|fashion|wear)\b/i.test(hay);
  return isGender && isClothing;
};

type ProductEx = Product & {
  retail_price?: number | null;
  sku?: string | null;
  unit?: string | null;
  supplier_name?: string | null;
  tags?: any;
  total_sales?: number | null;
  is_featured?: boolean | null;
  approval_status?: string | null;
  // if you store rich HTML description
  description?: string | null;
};

type ManualSpecRow = {
  id: string;
  label: string;
  value: string;
  sort_order: number | null;
};

type ReviewReplyRow = {
  id: string;
  review_id: string;
  admin_id: string;
  reply: string;
  created_at: string;
  profiles?: { full_name?: string | null } | null;
};

type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  replies?: ReviewReplyRow[];
};

// ✅ FIX: CategoryEx type (so parent_id is available for chain building)
type CategoryEx = Category & { parent_id?: string | null };

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function moneyBDT(n: number) {
  const val = Number(n || 0);
  return `৳${val.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

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
    if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function normalizeTags(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {}
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function percentOff(retail: number, price: number) {
  if (!retail || retail <= 0) return 0;
  if (!price || price <= 0) return 0;
  if (retail <= price) return 0;
  return Math.round(((retail - price) / retail) * 100);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// localStorage helpers (safe)
function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function toIdShort(id?: string) {
  return (id || '').slice(0, 10);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function avgRating(reviews: ReviewRow[]) {
  const valid = reviews.filter((r) => Number.isFinite(Number(r.rating)));
  if (!valid.length) return 0;
  const sum = valid.reduce((a, r) => a + Number(r.rating || 0), 0);
  return sum / valid.length;
}

function isProbablyHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function ShoppingBenefitsCard({ className = '' }: { className?: string }) {
  return (
    <Card className={`border-gray-100 shadow-sm rounded-2xl ${className}`.trim()}>
      <CardContent className="p-5">
        <div className="text-sm font-extrabold text-gray-900">Shopping benefits</div>
        <div className="mt-3 space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-blue-900">•</span>
            Verified products and responsive support.
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-blue-900">•</span>
            Fast checkout and easy cart experience.
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-blue-900">•</span>
            Nationwide delivery assistance via WhatsApp.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Lightbox (no external dependency) ---
function Lightbox({
  open,
  images,
  activeIndex,
  onClose,
  onChange,
  title,
}: {
  open: boolean;
  images: string[];
  activeIndex: number;
  onClose: () => void;
  onChange: (next: number) => void;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onChange(activeIndex - 1);
      if (e.key === 'ArrowRight') onChange(activeIndex + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, activeIndex, onClose, onChange]);

  if (!open) return null;

  const safeIndex = clamp(activeIndex, 0, Math.max(0, images.length - 1));
  const img = images[safeIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80">
      <button className="absolute inset-0 cursor-zoom-out" onClick={onClose} aria-label="Close" />
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
        <div className="text-white text-sm font-semibold truncate">
          {title ? title : 'Preview'} {images.length ? `(${safeIndex + 1}/${images.length})` : ''}
        </div>
        <button
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4 py-16">
        <div className="relative w-full max-w-5xl">
          <div className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <SafeImage src={img} alt="Preview" width={1600} height={900} className="w-full h-auto max-h-[75vh] object-contain bg-black" />
            ) : (
              <div className="h-[60vh] flex items-center justify-center text-white/60">No image</div>
            )}
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={() => onChange(safeIndex - 1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>

              <button
                onClick={() => onChange(safeIndex + 1)}
                className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                aria-label="Next image"
              >
                <ChevronLeft className="h-5 w-5 rotate-180 text-white" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  p,
  onQuickAdd,
  addingId,
}: {
  p: ProductEx;
  onQuickAdd: (id: string, name: string) => void;
  addingId: string | null;
}) {
  const { toggle: toggleWishlistId, isInWishlist } = useWishlist();
  const { toast } = useToast();
  const price = Number((p as any).price ?? (p as any).base_price ?? 0);
  const retail = Number((p as any).retail_price ?? 0);
  const pct = percentOff(retail, price);

  const imgs = parseImages((p as any).images);
  const img = imgs[0];

  const wishKey = String((p as any).color_group_id || p.id);
  const wishlisted = isInWishlist(wishKey);

  const outOfStock = ((p as any).stock_quantity ?? 0) <= 0;

  return (
    <Card className="hover:shadow-md transition group">
      <CardContent className="p-0">
        <Link href={`/products/${p.slug}`} prefetch={false} className="block aspect-square bg-gray-100 rounded-t-xl overflow-hidden relative" aria-label={`View ${p.name}`}>
          {pct > 0 && (
            <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase z-10">
              {pct}% OFF
            </div>
          )}
          {outOfStock && (
            <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase z-10">
              OOS
            </div>
          )}

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const next = !wishlisted;
              toggleWishlistId(wishKey);
              toast({
                title: next ? 'Saved' : 'Removed',
                description: next ? 'Added to wishlist.' : 'Removed from wishlist.',
              });
            }}
            className="absolute bottom-2 right-2 z-10 rounded-full bg-white/90 backdrop-blur p-2 shadow-sm border border-white/40 hover:bg-white"
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart className={`h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-800'}`} />
          </button>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <SafeImage
              src={img}
              alt={p.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-300" />
            </div>
          )}
        </Link>

        <div className="p-3">
          <Link href={`/products/${p.slug}`} prefetch={false}>
            <div className="text-sm font-semibold text-gray-900 line-clamp-2 hover:text-blue-900 transition min-h-[2.5rem]">
              {p.name}
            </div>
          </Link>

          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-base font-extrabold text-blue-900">{moneyBDT(price)}</div>
            {retail > 0 && retail > price && <div className="text-xs text-gray-500 line-through">{moneyBDT(retail)}</div>}
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1 bg-blue-900 hover:bg-blue-800 h-8 text-xs"
              size="sm"
              onClick={() => onQuickAdd(p.id, p.name)}
              disabled={addingId === p.id || outOfStock}
            >
              <ShoppingCart className="mr-1 h-3 w-3" />
              {addingId === p.id ? '...' : 'Add'}
            </Button>
            <Link href={`/products/${p.slug}`} prefetch={false} className="flex-shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs bg-white">
                View
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ✅ Robust Reviews + Admin Replies (works with your schema style)
 * - Fetch reviews + replies in two queries (more reliable than complex nested joins)
 * - Realtime updates (review insert + reply insert)
 * - Admin can: insert new reply OR update their latest reply per review (toggle)
 */
function ReviewsSection({
  productId,
  onStats,
}: {
  productId: string;
  onStats?: (stats: { count: number; average: number }) => void;
}) {
  const { toast } = useToast();

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  // form (customer)
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // admin reply drafts per review
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<Record<string, boolean>>({});
  const [updateMyLastReply, setUpdateMyLastReply] = useState<Record<string, boolean>>({});

  // prevent realtime spam
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id ?? null;

      if (!alive) return;
      setUserId(uid);

      if (uid) {
        // your dashboard uses profile.role === 'admin'
        // product page uses profiles.is_admin in your old code
        // We'll support BOTH: check role OR is_admin.
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('id', uid)
          .maybeSingle();

        const admin = String((prof as any)?.role || '').toLowerCase() === 'admin' || !!(prof as any)?.is_admin;
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }

      setAuthReady(true);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const computeStats = (rows: ReviewRow[]) => {
    onStats?.({ count: rows.length, average: avgRating(rows) });
  };

  const fetchReviews = async () => {
    setLoading(true);

    try {
      // 1) Reviews
      const reviewsRes = await supabase
        .from('product_reviews')
        .select(
          `
          id,
          product_id,
          user_id,
          rating,
          comment,
          created_at,
          profiles ( full_name, email )
        `,
        )
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (reviewsRes.error) throw reviewsRes.error;

      const reviewRows = (reviewsRes.data || []) as any as ReviewRow[];
      const reviewIds = reviewRows.map((r) => r.id);

      // 2) Replies
      let replies: ReviewReplyRow[] = [];
      if (reviewIds.length > 0) {
        const repliesRes = await supabase
          .from('review_replies')
          .select(
            `
            id,
            review_id,
            admin_id,
            reply,
            created_at,
            profiles ( full_name )
          `,
          )
          .in('review_id', reviewIds)
          .order('created_at', { ascending: false });

        if (repliesRes.error) throw repliesRes.error;

        replies = (repliesRes.data || []) as any as ReviewReplyRow[];
      }

      const byReviewId: Record<string, ReviewReplyRow[]> = {};
      for (const rep of replies) {
        if (!byReviewId[rep.review_id]) byReviewId[rep.review_id] = [];
        byReviewId[rep.review_id].push(rep);
      }

      const merged = reviewRows.map((r) => ({
        ...r,
        replies: (byReviewId[r.id] || []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      }));

      setReviews(merged);
      computeStats(merged);

      // default update mode true for reviews that already have my reply
      if (userId) {
        const defaults: Record<string, boolean> = {};
        for (const r of merged) {
          const hasMine = (r.replies || []).some((x) => x.admin_id === userId);
          if (hasMine) defaults[r.id] = true;
        }
        setUpdateMyLastReply((prev) => ({ ...defaults, ...prev }));
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Failed to load reviews',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
      setReviews([]);
      computeStats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!productId) return;
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, authReady]);

  // Realtime updates: refresh when a review or reply is added (and it belongs to this product)
  useEffect(() => {
    if (!productId) return;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        fetchReviews();
      }, 400);
    };

    const ch = supabase
      .channel(`product-reviews-live:${productId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'product_reviews', filter: `product_id=eq.${productId}` },
        () => scheduleRefresh(),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'review_replies' }, (payload: any) => {
        const rid = payload?.new?.review_id;
        if (!rid) return;
        // only refresh if this reply belongs to one of our loaded reviews
        if (reviews.some((r) => r.id === rid)) scheduleRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, reviews.map((r) => r.id).join('|')]);

  const myExistingReview = useMemo(() => {
    if (!userId) return null;
    // if duplicates exist, take newest
    const mine = reviews.filter((r) => r.user_id === userId);
    if (!mine.length) return null;
    return mine.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  }, [reviews, userId]);

  const submitReview = async () => {
    if (!userId) {
      toast({ title: 'Login required', description: 'Please login to post a review.', variant: 'destructive' });
      return;
    }
    if (!comment.trim()) {
      toast({ title: 'Write something', description: 'Comment is required.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        product_id: productId,
        user_id: userId,
        rating,
        comment: comment.trim(),
      };

      if (myExistingReview) {
        const { error } = await supabase
          .from('product_reviews')
          .update({ rating: payload.rating, comment: payload.comment })
          .eq('id', myExistingReview.id);

        if (error) throw error;

        toast({ title: 'Updated', description: 'Your review was updated.' });
      } else {
        const { error } = await supabase.from('product_reviews').insert(payload);
        if (error) throw error;
        toast({ title: 'Thanks!', description: 'Your review was posted.' });
      }

      setComment('');
      setRating(5);
      await fetchReviews();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e?.message || 'Failed to submit review', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (reviewId: string) => {
    if (!isAdmin) return;

    const txt = (replyDraft[reviewId] || '').trim();
    if (!txt) {
      toast({ title: 'Reply required', description: 'Write a reply first.', variant: 'destructive' });
      return;
    }

    if (!userId) {
      toast({ title: 'Admin login required', description: 'Login as admin to reply.', variant: 'destructive' });
      return;
    }

    setReplying((s) => ({ ...s, [reviewId]: true }));

    try {
      const review = reviews.find((r) => r.id === reviewId);
      const myLast = (review?.replies || []).find((x) => x.admin_id === userId);

      const useUpdate = !!updateMyLastReply[reviewId] && !!myLast;

      if (useUpdate && myLast) {
        const { error } = await supabase.from('review_replies').update({ reply: txt }).eq('id', myLast.id);
        if (error) throw error;
        toast({ title: 'Updated reply', description: 'Your latest reply was updated.' });
      } else {
        const { error } = await supabase.from('review_replies').insert({
          review_id: reviewId,
          admin_id: userId,
          reply: txt,
        });
        if (error) throw error;
        toast({ title: 'Replied', description: 'Reply posted.' });
      }

      setReplyDraft((s) => ({ ...s, [reviewId]: '' }));
      await fetchReviews();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Reply failed',
        description: e?.message || 'Could not reply (check RLS).',
        variant: 'destructive',
      });
    } finally {
      setReplying((s) => ({ ...s, [reviewId]: false }));
    }
  };

  return (
    <Card className="border-gray-100 shadow-sm rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-gray-900">Reviews</div>
            <div className="text-sm text-gray-600">Ratings and comments from customers.</div>
          </div>

          <Button variant="outline" className="bg-white" onClick={fetchReviews} disabled={loading}>
            Refresh
          </Button>
        </div>

        <Separator className="my-4" />

        {/* Write review */}
        <div className="rounded-2xl border bg-gray-50 p-4">
          <div className="text-sm font-bold text-gray-900">{myExistingReview ? 'Edit your review' : 'Write a review'}</div>

          {!userId ? (
            <div className="mt-2 text-sm text-gray-600">
              Please{' '}
              <Link className="text-blue-700 hover:underline" href="/login">
                login
              </Link>{' '}
              to post a review.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-700 font-semibold">Rating</div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} className="p-1" aria-label={`Rate ${n}`} type="button">
                      <Star className={`h-5 w-5 ${n <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Comment</Label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full min-h-[72px] rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Write your experience..."
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={submitReview} disabled={submitting} className="bg-blue-900 hover:bg-blue-800">
                  {submitting ? 'Submitting...' : myExistingReview ? 'Update Review' : 'Post Review'}
                </Button>

                {myExistingReview && (
                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={() => {
                      setRating(Number(myExistingReview.rating || 5));
                      setComment(myExistingReview.comment || '');
                    }}
                    type="button"
                  >
                    Load my review
                  </Button>
                )}
              </div>

              <div className="text-xs text-gray-500">Note: Your review will appear publicly after submitting.</div>
            </div>
          )}
        </div>

        <Separator className="my-5" />

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-sm text-gray-600">No reviews yet. Be the first!</div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => {
              const replies = r.replies || [];
              const hasReply = replies.length > 0;
              const customerName = r.profiles?.full_name || r.profiles?.email || 'Customer';

              const myLast = userId ? replies.find((x) => x.admin_id === userId) : null;

              return (
                <div key={r.id} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-gray-900 text-sm">{customerName}</div>
                        <div className="text-xs text-gray-500">{formatDate(r.created_at)}</div>
                        {hasReply ? (
                          <Badge className="bg-green-50 text-green-700 border border-green-200">Replied</Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-700 border border-red-200">Unreplied</Badge>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${
                              n <= Math.round(Number(r.rating || 0)) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'
                            }`}
                          />
                        ))}
                        <span className="ml-2 text-xs text-gray-500">{Number(r.rating || 0).toFixed(1)}</span>
                      </div>

                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {r.comment || <span className="text-gray-400">(No comment)</span>}
                      </div>
                    </div>

                    {r.user_id && r.user_id === userId && (
                      <Badge className="bg-blue-50 text-blue-800 border border-blue-200">You</Badge>
                    )}
                  </div>

                  {/* Replies */}
                  {hasReply && (
                    <div className="mt-4 space-y-2">
                      {replies.map((rep) => (
                        <div key={rep.id} className="rounded-xl bg-gray-50 border p-3">
                          <div className="text-xs text-gray-500">
                            Reply from{' '}
                            <span className="font-semibold text-gray-700">{rep.profiles?.full_name || 'Admin'}</span> •{' '}
                            {formatDate(rep.created_at)}
                            {rep.admin_id === userId ? (
                              <span className="ml-2 text-[11px] font-semibold text-blue-700">(you)</span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{rep.reply}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin reply box */}
                  {isAdmin && (
                    <div className="mt-4 rounded-xl border bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-700">Admin reply</div>

                        {myLast && (
                          <label className="text-xs text-gray-600 flex items-center gap-2 select-none cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!updateMyLastReply[r.id]}
                              onChange={(e) => setUpdateMyLastReply((s) => ({ ...s, [r.id]: e.target.checked }))}
                              className="h-4 w-4"
                            />
                            Update my latest reply (instead of new)
                          </label>
                        )}
                      </div>

                      <textarea
                        value={replyDraft[r.id] || ''}
                        onChange={(e) => setReplyDraft((s) => ({ ...s, [r.id]: e.target.value }))}
                        className="mt-2 w-full min-h-[70px] rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Write a professional reply..."
                      />

                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Replies are visible publicly on this product page.
                        </div>

                        <Button
                          onClick={() => submitReply(r.id)}
                          disabled={!!replying[r.id] || !(replyDraft[r.id] || '').trim()}
                          className="bg-blue-900 hover:bg-blue-800"
                          size="sm"
                          type="button"
                        >
                          {replying[r.id] ? 'Sending...' : myLast && updateMyLastReply[r.id] ? 'Update Reply' : 'Send Reply'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ProductDetailClientProps = {
  params: { slug: string };
  initialProduct?: ProductEx | null;
  initialCategoryChain?: CategoryEx[];
  initialRelated?: ProductEx[];
};

export default function ProductDetailClient({
  params,
  initialProduct = null,
  initialCategoryChain = [],
  initialRelated = [],
}: ProductDetailClientProps) {
  const { addToCart: addToCartContext, refreshCart } = useCart();
  const { items: compareItems, toggle, isInCompare, maxItems } = useCompare();
  const router = useRouter();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductEx | null>(initialProduct);

  // ✅ FIX: categoryChain uses CategoryEx
  const [categoryChain, setCategoryChain] = useState<CategoryEx[]>(initialCategoryChain);

  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(!initialProduct);
  const [adding, setAdding] = useState(false);

  const [activeImage, setActiveImage] = useState(0);

  // Hover-zoom for product gallery
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recommendations
  const [related, setRelated] = useState<ProductEx[]>(initialRelated);
  const [alsoLike, setAlsoLike] = useState<ProductEx[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductEx[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Wishlist
  const { toggle: toggleWishlistId, isInWishlist } = useWishlist();

  // Site banner (shared with homepage mid-banner)
  const [siteBanner, setSiteBanner] = useState<any>(null);

  // Used for choosing mobile/desktop-specific banner images when both are provided.
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

  // Manual specs (admin-defined) + color variants
  const [manualSpecs, setManualSpecs] = useState<ManualSpecRow[]>([]);
  const [variants, setVariants] = useState<ProductEx[]>([]);
  const [selectedSize, setSelectedSize] = useState('');


  // Reviews stats for header stars
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewAvg, setReviewAvg] = useState(0);

  const maxQty = useMemo(() => {
    const stock = product?.stock_quantity ?? 0;
    return Math.max(0, stock);
  }, [product]);

  const outOfStock = (product?.stock_quantity ?? 0) <= 0;

  const colorGroupId = (product as any)?.color_group_id as string | null | undefined;

  const inCompare = product ? isInCompare(product.id) : false;

  const isClothing = useMemo(
    () => categoryChain.some((cat) => isClothingCategory(cat?.name, cat?.slug)),
    [categoryChain]
  );
  const isFashionLayout = isClothing;

  const sizeChart = useMemo(() => parseSizeChart((product as any)?.size_chart), [product]);
  const sizeOptions = useMemo(() => {
    const fromChart = sizeChart.map((entry) => entry.size).filter(Boolean);
    const fallback = fromChart.length ? fromChart : DEFAULT_SIZE_OPTIONS;
    return Array.from(new Set(fallback));
  }, [sizeChart]);

  const selectedSizeDetails = useMemo(
    () => sizeChart.find((entry) => entry.size === selectedSize),
    [sizeChart, selectedSize]
  );

  useEffect(() => {
    setSelectedSize('');
  }, [product?.id]);

  const handleToggleCompare = () => {
    if (!product) return;
    const already = isInCompare(product.id);
    if (!already && compareItems.length >= maxItems) {
      toast({
        title: 'Compare limit reached',
        description: `You can compare up to ${maxItems} products. Remove one to add another.`,
      });
      return;
    }

    const imagesAny: any = (product as any).images;
    const primary = Array.isArray(imagesAny) ? imagesAny.find(Boolean) : null;
    toggle({
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: primary,
      description: (product as any).description ?? null,
      price: Number((product as any).price ?? (product as any).base_price ?? 0) || null,
      retail_price: Number((product as any).retail_price ?? 0) || null,
      stock_quantity: Number((product as any).stock_quantity ?? 0),
      supplier_name: (product as any).supplier_name ?? null,
      sku: (product as any).sku ?? null,
      tags: Array.isArray((product as any).tags) ? (product as any).tags : [],
    });

    toast({
      title: already ? 'Removed from compare' : 'Added to compare',
      description: 'Open Compare from the bottom bar to view side-by-side.',
    });
  };

  const imgs = useMemo(() => parseImages((product as any)?.images), [product]);
  const mainImg = imgs[activeImage] || imgs[0];

  const price = Number((product as any)?.price ?? (product as any)?.base_price ?? 0);
  const retail = Number((product as any)?.retail_price ?? 0);
  const pct = percentOff(retail, price);
  const savings = retail > 0 && retail > price ? retail - price : 0;

  const total = price * quantity;

  const unitRaw = String((product as any)?.unit || 'item').trim() || 'item';
  const perUnit = unitRaw.replace(/s$/i, '');

  const tags = useMemo(() => normalizeTags((product as any)?.tags), [product]);

  // HTML description support
  const descriptionRaw = String((product as any)?.description || '');
  const descriptionIsHtml = isProbablyHtml(descriptionRaw);
  const descriptionSnippet = stripHtml(descriptionRaw);

  useEffect(() => {
    // If the server already provided initial data for this slug, don't refetch immediately.
    if (initialProduct && (initialProduct as any)?.slug === params.slug) {
      setProduct(initialProduct as any);
      setCategoryChain(initialCategoryChain as any);
      setRelated(initialRelated as any);
      setLoading(false);
      setErrorMsg(null);
      return;
    }

    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  useEffect(() => {
    if (!product) return;
    setQuantity((q) => clamp(q, 1, maxQty || 1));
  }, [product, maxQty]);

  const wishlisted = useMemo(() => (product ? isInWishlist(String((product as any).color_group_id || product.id)) : false), [isInWishlist, product]);

  // Load shared banner config (used on product page before related products)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key,value')
        .eq('key', 'home_mid_banner')
        .maybeSingle();
      if (!cancelled && !error) setSiteBanner((data as any)?.value ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load manual specs for this product
  useEffect(() => {
    if (!product?.id) {
      setManualSpecs([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('product_specs')
        .select('id,label,value,sort_order')
        .eq('product_id', product.id)
        .order('sort_order', { ascending: true });

      if (!cancelled) {
        if (error) {
          console.warn('[product_specs] load failed', error.message);
          setManualSpecs([]);
        } else {
          setManualSpecs((data || []) as any);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  // Load color variants (other products in the same color group)
  useEffect(() => {
    if (!product) {
      setVariants([]);
      return;
    }

    if (!colorGroupId) {
      setVariants([product]);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id,category_id,name,slug,description,sku,images,price,base_price,retail_price,stock_quantity,min_order_quantity,unit,supplier_name,tags,is_featured,total_sales,approval_status,is_active,size_chart,color_group_id,color_name,color_hex'
        )
        .eq('is_active', true)
        .eq('color_group_id', colorGroupId)
        .order('created_at', { ascending: true });

      if (!cancelled) {
        if (error) {
          console.warn('[variants] load failed', error.message);
          setVariants([product]);
        } else {
          const list = (data || []) as any[];
          // Ensure current product is present
          const hasCurrent = list.some((x) => x.id === (product as any).id);
          const normalized = hasCurrent ? list : [product, ...list];
          setVariants(normalized as any);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product?.id, colorGroupId]);

  // keep recently viewed list
  useEffect(() => {
    if (!product) return;

    const ids = lsGet<string[]>('recently_viewed_product_ids', []);
    const key = String((product as any).color_group_id || product.id);
    const next = uniq([key, ...ids]).slice(0, 16);
    lsSet('recently_viewed_product_ids', next);
  }, [product]);

  // ✅ FIX: fetchCategoryChain is at component scope (NOT inside fetchAll)
  const fetchCategoryChain = async (categoryId: string) => {
    const chain: CategoryEx[] = [];
    let currentId: string | null = categoryId;
    let guard = 0;

    while (currentId && guard < 8) {
      guard++;

      const res = await supabase
        .from('categories')
        .select('id,name,slug,parent_id,image_url,is_active,sort_order')
        .eq('id', currentId)
        .maybeSingle();

      if (res.error) break;

      const cat = res.data as CategoryEx | null;
      if (!cat) break;

      chain.unshift(cat);
      currentId = cat.parent_id ?? null;
    }

    setCategoryChain(chain);
  };

  const fetchRelatedProducts = async (p: ProductEx) => {
    const categoryId = (p as any).category_id;
    if (!categoryId) {
      setRelated([]);
      return;
    }

    const { data } = await supabase
      .from('products')
      .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,size_chart,color_group_id,color_name,color_hex')
      .eq('is_active', true)
      .eq('category_id', categoryId)
      .neq('id', p.id)
      .is('color_name', null)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);

    setRelated(dedupeByColorGroup((data || []) as any) as ProductEx[]);
  };

  const fetchAlsoLike = async (p: ProductEx) => {
    const { data } = await supabase
      .from('products')
      .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,size_chart,color_group_id,color_name,color_hex')
      .eq('is_active', true)
      .neq('id', p.id)
      .order('is_featured', { ascending: false })
      .order('total_sales', { ascending: false, nullsFirst: false })
      .is('color_name', null)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);

    setAlsoLike(dedupeByColorGroup((data || []) as any) as ProductEx[]);
  };

  const fetchRecentlyViewed = async (p: ProductEx) => {
    const ids = lsGet<string[]>('recently_viewed_product_ids', []);
    const currentKey = String((p as any).color_group_id || p.id);
    const list = ids.filter((id) => id && id !== currentKey).slice(0, 10);
    if (list.length === 0) {
      setRecentlyViewed([]);
      return;
    }

    // The recently viewed list stores group ids (color_group_id) when available.
    // For backward compatibility, it may contain product ids too.
    const baseQuery = supabase
      .from('products')
      .select(
        'id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,size_chart,color_group_id,color_name,color_hex'
      )
      .eq('is_active', true)
      .limit(20);

    const [{ data: byId }, { data: byGroup }] = await Promise.all([
      baseQuery.in('id', list),
      baseQuery.in('color_group_id', list).is('color_name', null),
    ]);

    const idMap = new Map((byId || []).map((x: any) => [x.id, x]));
    const groupMap = new Map((byGroup || []).map((x: any) => [String((x as any).color_group_id || x.id), x]));

    const ordered = list
      .map((k) => idMap.get(k) || groupMap.get(k))
      .filter(Boolean);

    setRecentlyViewed(ordered as ProductEx[]);
  };

  // ✅ FIXED + MERGED fetchAll (calls fetchCategoryChain correctly)
  const fetchAll = async () => {
    setLoading(true);
    setErrorMsg(null);
    setProduct(null);
    setCategoryChain([]);
    setRelated([]);
    setAlsoLike([]);
    setRecentlyViewed([]);
    setActiveImage(0);

    try {
      const { data: productData, error } = await supabase
        .from('products')
        .select(
          'id,category_id,name,slug,description,sku,images,price,base_price,retail_price,stock_quantity,unit,supplier_name,tags,is_featured,total_sales,approval_status,is_active,size_chart,color_group_id,color_name,color_hex'
        )
        .eq('slug', params.slug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        setErrorMsg(error.message || 'Failed to load product.');
        setLoading(false);
        return;
      }

      if (!productData) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct(productData as ProductEx);
      setActiveImage(0);
      setQuantity(1);

      if ((productData as any).category_id) {
        await fetchCategoryChain((productData as any).category_id);
      }

      await Promise.all([
        fetchRelatedProducts(productData as any),
        fetchAlsoLike(productData as any),
        fetchRecentlyViewed(productData as any),
      ]);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return false;

    if (isClothing && !selectedSize) {
      toast({
        title: 'Select a size',
        description: 'Please choose a size before adding this item to your cart.',
        variant: 'destructive',
      });
      return false;
    }

    const safeQty = clamp(quantity, 1, maxQty || 1);

    if (maxQty === 0) {
      toast({ title: 'Out of Stock', description: 'This product is currently unavailable.', variant: 'destructive' });
      return false;
    }

    setAdding(true);
    try {
      await addToCartContext(product.id, safeQty, { size: selectedSize || null });
      toast({
        title: 'Added to Cart',
        description: `${product.name} (${safeQty} ${(product as any).unit || ''}) added to your cart`,
      });
      return true;
    } catch {
      toast({ title: 'Error', description: 'Failed to add to cart.', variant: 'destructive' });
      return false;
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    const ok = await handleAddToCart();
    if (ok) {
      await refreshCart();
      router.push('/cart?checkout=1');
    }
  };

  const handleContactSeller = () => {
    if (!product) return;
    const WHATSAPP_NUMBER = '8809638371951';
    const message = `Hi, I'm interested in: ${product.name}\nProduct link: ${window.location.href}`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyLink = async () => {
    const ok = await copyText(window.location.href);
    toast({
      title: ok ? 'Link copied' : 'Copy failed',
      description: ok ? 'You can now share it anywhere.' : 'Please copy manually from the address bar.',
      variant: ok ? 'default' : 'destructive',
    });
  };

  const toggleWishlist = () => {
    if (!product) return;
    const next = !wishlisted;
    toggleWishlistId(String((product as any).color_group_id || product.id));
    toast({
      title: next ? 'Saved' : 'Removed',
      description: next ? 'Added to wishlist.' : 'Removed from wishlist.',
    });
  };

  const quickAdd = async (id: string, name: string) => {
    setAddingId(id);
    try {
      await addToCartContext(id, 1);
      toast({ title: 'Added to cart', description: `${name} added to your cart.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to add item to cart.', variant: 'destructive' });
    } finally {
      setAddingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <Skeleton className="w-full aspect-square rounded-2xl" />
              <div className="mt-4 grid grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="w-full aspect-square rounded-xl" />
                ))}
              </div>
            </div>
            <div className="lg:col-span-5">
              <Skeleton className="h-6 w-2/3 mb-3" />
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-16 w-full mb-4" />
              <Skeleton className="h-28 w-full mb-4" />
              <Skeleton className="h-44 w-full" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-10 flex-1">
          <div className="max-w-xl mx-auto bg-white border border-red-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-700 mt-0.5" />
              <div>
                <div className="text-lg font-extrabold text-gray-900">Could not load product</div>
                <div className="text-sm text-gray-600 mt-1">{errorMsg}</div>
                <div className="mt-4 flex gap-2">
                  <Button className="bg-blue-900 hover:bg-blue-800" onClick={fetchAll}>
                    Retry
                  </Button>
                  <Link href="/products">
                    <Button variant="outline" className="bg-white">
                      Back to products
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Product Not Found</h2>
            <p className="text-gray-600 mb-4">The product you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/products">
              <Button className="bg-blue-900 hover:bg-blue-800">Back to Products</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const lowStock = !outOfStock && (product.stock_quantity ?? 0) > 0 && (product.stock_quantity ?? 0) <= 5;

  const banner = siteBanner as
    | { image_url?: string; mobile_image_url?: string; link_url?: string; is_active?: boolean; title?: string }
    | null;
  const showBanner = !!banner?.is_active && (!!banner?.image_url || !!banner?.mobile_image_url);
  const bannerSrc =
    (isMobileViewport && banner?.mobile_image_url ? banner.mobile_image_url : banner?.image_url || banner?.mobile_image_url) as string;

  const trustChipsEl = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900">
          <Truck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900">Fast delivery</div>
          <div className="text-xs text-gray-500">Inside Dhaka & nationwide</div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900">Secure checkout</div>
          <div className="text-xs text-gray-500">Safe payments & privacy</div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-700">
          <RotateCcw className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900">Easy support</div>
          <div className="text-xs text-gray-500">WhatsApp assistance</div>
        </div>
      </div>
    </div>
  );

  const detailsTabsEl = (
    <Card className="border-gray-100 shadow-sm rounded-2xl">
      <CardContent className="p-5">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full justify-start flex-wrap">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="specs">Specs</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="reviews">
              Reviews
              {reviewCount > 0 && (
                <span className="ml-2 inline-flex items-center text-xs text-gray-600">({reviewCount})</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="pt-4">
            {descriptionRaw ? (
              descriptionIsHtml ? (
                <div
                  className={[
                    'text-sm text-gray-800 leading-7',
                    '[&_p]:my-2',
                    '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-3',
                    '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-3',
                    '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-2',
                    '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
                    '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
                    '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:text-gray-700 [&_blockquote]:my-3',
                    '[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
                    '[&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3',
                    '[&_hr]:my-4 [&_hr]:border-gray-200',
                    '[&_table]:w-full [&_table]:border-collapse [&_table]:my-3',
                    '[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:p-2 [&_th]:text-left',
                    '[&_td]:border [&_td]:border-gray-200 [&_td]:p-2',
                    '[&_a]:text-blue-700 [&_a]:underline',
                  ].join(' ')}
                  // NOTE: only use this if description is trusted (admin-written)
                  dangerouslySetInnerHTML={{ __html: descriptionRaw }}
                />
              ) : (
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{descriptionRaw}</div>
              )
            ) : (
              <div className="text-sm text-gray-500">No description provided.</div>
            )}

            {tags.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="text-sm font-semibold text-gray-900 mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 20).map((t) => (
                    <Link key={t} href={`/products?tags=${encodeURIComponent(t)}`}>
                      <Badge variant="secondary" className="rounded-full px-3 py-1 hover:bg-gray-200">
                        {t}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="specs" className="pt-4">
            {manualSpecs.length > 0 ? (
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {manualSpecs.map((s, idx) => (
                      <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                        <td className="w-40 sm:w-56 px-4 py-3 align-top text-xs font-semibold text-gray-600">
                          {s.label}
                        </td>
                        <td className="px-4 py-3 text-gray-900 whitespace-pre-wrap">
                          {s.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
                No specifications have been added for this product yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="delivery" className="pt-4">
            <div className="space-y-3 text-sm text-gray-700">
              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="font-semibold text-gray-900">Delivery</div>
                <div className="mt-1 text-gray-600">
                  Delivery time depends on location. Inside Dhaka usually faster. Nationwide available.
                </div>
              </div>

              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="font-semibold text-gray-900">Payment</div>
                <div className="mt-1 text-gray-600">Secure checkout. You can contact support for payment assistance.</div>
              </div>

              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="font-semibold text-gray-900">Support</div>
                <div className="mt-1 text-gray-600">Need help? Use WhatsApp support from the buttons on this page.</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="faq" className="pt-4">
            <div className="space-y-3 text-sm">
              <details className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                  How do I place an order?
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </summary>
                <div className="mt-2 text-gray-600">
                  Add the item to cart, go to checkout, confirm phone and address, and place your order.
                </div>
              </details>

              <details className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                  What if the product is out of stock?
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </summary>
                <div className="mt-2 text-gray-600">Check back later. You can also message us on WhatsApp for availability updates.</div>
              </details>

              <details className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                  Can I change quantity later?
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </summary>
                <div className="mt-2 text-gray-600">Yes — you can update quantities in the cart before checkout.</div>
              </details>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="pt-4">
            <ReviewsSection productId={product.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  return (
    <div className={isFashionLayout ? 'min-h-screen flex flex-col bg-white' : 'min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50'}>
      <Header />

      <main className="flex-1">
        <div className={isFashionLayout ? 'container mx-auto px-4 py-6 lg:py-8' : 'container mx-auto px-4 py-6 lg:py-10'}>
          <nav className="flex items-center text-sm text-gray-500 mb-5 overflow-x-auto whitespace-nowrap pb-2">
            <Link href="/" className="hover:text-blue-900 flex items-center">
              <Home className="w-4 h-4 mr-1" />
              Home
            </Link>

            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            <Link href="/products" className="hover:text-blue-900">
              Products
            </Link>

            {categoryChain.map((cat) => (
              <div key={cat.id} className="flex items-center">
                <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                <Link href={`/${cat.slug}`} className="hover:text-blue-900 font-medium">
                  {cat.name}
                </Link>
              </div>
            ))}

            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            <span className="text-gray-900 font-semibold truncate max-w-[240px]">{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Gallery */}
            <section className="lg:col-span-7 space-y-4">
              <div className={isFashionLayout ? 'bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden' : 'bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden'}>
                <div
                    className={`relative aspect-square overflow-hidden ${isFashionLayout ? 'bg-gray-100' : 'bg-gray-50'}`}
                    onMouseEnter={() => setZoomed(true)}
                    onMouseLeave={() => {
                      setZoomed(false);
                      setZoomOrigin({ x: 50, y: 50 });
                    }}
                    onMouseMove={(e) => {
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setZoomOrigin({
                        x: Math.max(0, Math.min(100, x)),
                        y: Math.max(0, Math.min(100, y)),
                      });
                    }}
                  >
                  {mainImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <SafeImage
                      src={mainImg}
                      alt={product.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className={`object-contain transition-transform duration-200 ease-out ${zoomed ? 'scale-150' : 'scale-100'} cursor-zoom-in`}
                      style={{ transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-gray-300" />
                    </div>
                  )}

                  <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                    {outOfStock && (
                      <Badge className="bg-red-600 hover:bg-red-600 text-white rounded-full px-3 py-1">Out of stock</Badge>
                    )}
                    {!outOfStock && (product as any).is_featured && (
                      <Badge className="bg-blue-900 hover:bg-blue-900 text-white rounded-full px-3 py-1">Featured</Badge>
                    )}
                    {pct > 0 && (
                      <Badge className="bg-green-600 hover:bg-green-600 text-white rounded-full px-3 py-1">
                        {pct}% OFF
                      </Badge>
                    )}
                  </div>

                  {/* SKU/ID/Unit/Supplier removed from the product UI (managed via admin) */}

                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center rounded-full border border-white/40 bg-white/90 px-2.5 py-1 text-[11px] font-bold text-gray-900 shadow-sm">
                      Compare
                    </span>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full bg-white/90 hover:bg-white"
                      onClick={handleToggleCompare}
                      aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
                      title={inCompare ? 'Remove from compare' : 'Add to compare'}
                    >
                      <GitCompare className={`h-4 w-4 ${inCompare ? 'text-blue-900' : 'text-gray-700'}`} />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full bg-white/90 hover:bg-white"
                      onClick={toggleWishlist}
                      aria-label="Wishlist"
                    >
                      <Heart className={`h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full bg-white/90 hover:bg-white"
                      onClick={handleCopyLink}
                      aria-label="Copy link"
                    >
                      <Copy className="h-4 w-4 text-gray-700" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full bg-white/90 hover:bg-white"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: product.name, url: window.location.href }).catch(() => {});
                        } else {
                          handleCopyLink();
                        }
                      }}
                      aria-label="Share"
                    >
                      <Share2 className="h-4 w-4 text-gray-700" />
                    </Button>
                  </div>
                </div>

                {imgs.length > 1 && (
                  <div className={isFashionLayout ? 'p-4 border-t border-gray-200' : 'p-4 border-t border-gray-100'}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-500">
                        Images <span className="text-gray-300">•</span> {activeImage + 1}/{imgs.length}
                      </div>
                      <div className="text-xs text-gray-500">Hover to zoom</div>
                    </div>

                    <div className="overflow-x-auto pb-2">
                      <div className="flex gap-3 min-w-max">
                        {imgs.map((img, idx) => (
                          <button
                            key={img + idx}
                            onClick={() => setActiveImage(idx)}
                            className={`relative h-20 w-20 ${isFashionLayout ? 'rounded-md' : 'rounded-xl'} overflow-hidden border transition ${
                              idx === activeImage
                                ? 'border-blue-700 ring-2 ring-blue-600/20'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            aria-label={`View image ${idx + 1}`}
                            type="button"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <SafeImage
                              src={img}
                              alt={`${product.name} thumbnail ${idx + 1}`}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:block space-y-4">
                {trustChipsEl}
                {detailsTabsEl}
              </div>
            </section>

            {/* Sticky buy box */}
            <aside className="lg:col-span-5">
              <div className="lg:sticky lg:top-24 space-y-4">
                <div className={isFashionLayout ? 'bg-white border border-gray-200 rounded-xl shadow-sm p-6' : 'bg-white border border-gray-100 rounded-2xl shadow-sm p-6'}>
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                      {product.name}
                    </h1>

                    <div className="hidden md:flex flex-col items-end">
                      <div className="flex items-center gap-1 text-yellow-500">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${n <= Math.round(reviewAvg || 0) ? 'fill-yellow-500' : ''}`}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {reviewCount > 0 ? `${reviewAvg.toFixed(1)} • ${reviewCount} reviews` : 'No reviews yet'}
                      </div>
                    </div>
                  </div>

                  {/* Mobile rating row */}
                  <div className="mt-3 flex items-center justify-between gap-3 md:hidden">
                    <div className="flex items-center gap-1 text-yellow-500">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-4 w-4 ${n <= Math.round(reviewAvg || 0) ? 'fill-yellow-500' : ''}`} />
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">
                      {reviewCount > 0 ? `${reviewAvg.toFixed(1)} • ${reviewCount} reviews` : 'No reviews yet'}
                    </div>
                  </div>

                  <Separator className="my-5" />

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-blue-900">{moneyBDT(price)}</div>

                      {retail > 0 && retail > price && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="text-sm text-gray-500 line-through">{moneyBDT(retail)}</div>
                          <Badge className={isFashionLayout ? 'bg-red-50 text-red-700 border border-red-200 rounded-full' : 'bg-green-50 text-green-700 border border-green-200 rounded-full'}>
                            {isFashionLayout ? `${pct}% Off` : `Save ${pct}% (${moneyBDT(savings)})`}
                          </Badge>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mt-2">Per {perUnit}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-gray-500">Stock</div>
                      <div className={`text-sm font-bold ${outOfStock ? 'text-red-600' : 'text-gray-900'}`}>
                        {outOfStock ? 'Out of stock' : `${product.stock_quantity} ${unitRaw}`}
                      </div>
                      {!outOfStock && lowStock && (
                        <div className="text-xs text-orange-700 mt-1 font-semibold">Low stock – order soon</div>
                      )}
                    </div>
                  </div>

                  {/* Color variants */}
                  {variants.length > 1 && (
                    <div className="mt-4">
                      <Label className="text-sm text-gray-700">Color</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {variants.map((v) => {
                          const active = v.id === (product as any).id;
                          const hex = (v as any).color_hex as string | null | undefined;
                          const name = String((v as any).color_name || '').trim() || 'Default';
                          const isOut = (v.stock_quantity ?? 0) <= 0;

                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                if (isOut && !active) return;
                                setProduct(v as any);
                                setActiveImage(0);
                              }}
                              className={[
                                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition',
                                active ? 'border-blue-700 ring-2 ring-blue-600/20' : 'border-gray-200 hover:border-gray-300',
                                isOut && !active ? 'opacity-60 cursor-not-allowed' : 'bg-white',
                              ].join(' ')}
                              disabled={isOut && !active}
                              title={isOut && !active ? 'Out of stock' : 'Select color'}
                            >
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-gray-300"
                                style={hex ? { backgroundColor: hex } : undefined}
                              />
                              <span className="whitespace-nowrap">{name}</span>
                              {isOut && (
                                <span className="ml-1 text-[10px] font-extrabold text-red-600">OUT</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isClothing && (
                    <div className="mt-4">
                      <Label className="text-sm text-gray-700">Size</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sizeOptions.map((size) => {
                          const active = selectedSize === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setSelectedSize(size)}
                              className={[
                                'inline-flex items-center justify-center text-xs font-semibold transition',
                                isFashionLayout ? 'h-9 w-12 rounded-md border' : 'rounded-full border px-4 py-2',
                                active ? 'border-blue-700 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white hover:border-gray-300',
                              ].join(' ')}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                      {!selectedSize && <div className="mt-2 text-xs text-red-600">Please select a size to continue.</div>}
                      {selectedSize && (
                        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-gray-700">
                          <div className="font-semibold text-blue-900">Measurements for {selectedSize}</div>
                          {selectedSizeDetails?.measurements?.length ? (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {selectedSizeDetails.measurements.map((m, idx) => (
                                <div key={`${m.label}-${idx}`} className="rounded-lg border border-blue-100 bg-white px-3 py-2">
                                  <div className="text-[11px] uppercase tracking-wide text-gray-500">{m.label}</div>
                                  <div className="text-sm font-semibold text-gray-900">{m.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-gray-600">Measurements will be provided soon.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator className="my-5" />

                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700">
                      Quantity {maxQty > 0 ? <span className="text-xs text-gray-500">(max {maxQty})</span> : null}
                    </Label>

                    <div className={isFashionLayout ? 'flex items-center gap-3' : 'flex items-center gap-3'}>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity((q) => clamp(q - 1, 1, maxQty || 1))}
                        disabled={quantity <= 1}
                        className={isFashionLayout ? 'rounded-md bg-white' : 'rounded-xl bg-white'}
                        type="button"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <div className="flex-1">
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setQuantity(clamp(val, 1, maxQty || 1));
                          }}
                          min={1}
                          max={maxQty || 1}
                          className={isFashionLayout ? 'h-10 text-center rounded-md bg-white' : 'h-11 text-center rounded-xl bg-white'}
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity((q) => clamp(q + 1, 1, maxQty || 1))}
                        disabled={maxQty > 0 ? quantity >= maxQty : true}
                        className={isFashionLayout ? 'rounded-md bg-white' : 'rounded-xl bg-white'}
                        type="button"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>

                      {isFashionLayout && (
                        <Button
                          className="bg-gray-900 hover:bg-black text-white h-10 px-6 rounded-md text-xs font-semibold"
                          onClick={handleAddToCart}
                          disabled={adding || outOfStock || (isClothing && !selectedSize)}
                        >
                          {adding ? 'Adding...' : 'Add to Cart'}
                        </Button>
                      )}
                    </div>

                    <div className={isFashionLayout ? 'mt-3 flex items-center justify-between text-sm text-gray-700' : 'mt-3 rounded-2xl bg-blue-50 border border-blue-100 p-4 flex items-center justify-between'}>
                      <div className={isFashionLayout ? 'font-semibold' : 'text-sm font-semibold text-blue-900'}>Total</div>
                      <div className={isFashionLayout ? 'text-base font-bold text-gray-900' : 'text-lg font-extrabold text-blue-900'}>{moneyBDT(total)}</div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {!isFashionLayout && (
                      <Button
                        className="w-full bg-blue-900 hover:bg-blue-800 h-11 sm:h-12 rounded-xl text-sm sm:text-base font-extrabold"
                        onClick={handleBuyNow}
                        disabled={adding || outOfStock || (isClothing && !selectedSize)}
                      >
                        <CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        {adding ? 'Adding...' : 'Buy Now'}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      onClick={handleContactSeller}
                      className={isFashionLayout ? 'w-full h-10 rounded-md border-green-600 text-green-600 hover:bg-green-50 font-semibold bg-white text-sm' : 'w-full h-10 sm:h-11 rounded-xl border-green-600 text-green-600 hover:bg-green-50 font-semibold bg-white text-sm'}
                      type="button"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>

                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={toggleWishlist} className="h-10 sm:h-11 rounded-xl bg-white font-semibold text-sm" type="button">
                        <Heart className={`mr-2 h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                        {wishlisted ? 'Saved' : 'Save'}
                      </Button>

                      <Button variant="outline" onClick={handleCopyLink} className="h-10 sm:h-11 rounded-xl bg-white font-semibold text-sm" type="button">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy link
                      </Button>
                    </div>

                    {outOfStock && (
                      <div className="rounded-2xl bg-red-50 border border-red-200 text-red-800 p-4 text-center">
                        <div className="font-extrabold">Out of stock</div>
                        <div className="text-sm">We are restocking soon. Please check back later.</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop: benefits stay in the sidebar */}
                <ShoppingBenefitsCard className="hidden lg:block" />
              </div>
            </aside>
          </div>

          {/* Mobile: show description/specs first, then shopping benefits */}
          <div className="lg:hidden mt-6 space-y-4">
            {detailsTabsEl}
            <ShoppingBenefitsCard />
          </div>

          <div className="mt-10 space-y-10">
            {showBanner && (
              <section>
                {banner?.link_url ? (
                  <Link href={banner.link_url} className="block">
                    <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
                      <div className="relative w-full h-[180px] sm:h-[220px] md:h-[260px]">
                        <SafeImage
                          src={bannerSrc}
                          alt={String(banner.title || 'Banner')}
                          fill
                          sizes="(max-width: 768px) 100vw, 1200px"
                          // Mobile: show full banner; Desktop: keep cover
                          className="object-contain md:object-cover transition-transform duration-700 hover:scale-105"
                        />
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
                    <div className="relative w-full h-[180px] sm:h-[220px] md:h-[260px]">
                      <SafeImage
                        src={bannerSrc}
                        alt={String(banner?.title || 'Banner')}
                        fill
                        sizes="(max-width: 768px) 100vw, 1200px"
                        // Mobile: show full banner; Desktop: keep cover
                        className="object-contain md:object-cover"
                      />
                    </div>
                  </div>
                )}
              </section>
            )}
            {related.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <div className="text-xl font-extrabold text-gray-900">Related products</div>
                    <div className="text-sm text-gray-600">More items from the same category.</div>
                  </div>
                  <Link href="/products">
                    <Button variant="outline" className="bg-white" type="button">
                      View all
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {related.slice(0, 10).map((p) => (
                    <ProductCard key={p.id} p={p} onQuickAdd={quickAdd} addingId={addingId} />
                  ))}
                </div>
              </section>
            )}

            {recentlyViewed.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <div className="text-xl font-extrabold text-gray-900">Recently viewed</div>
                    <div className="text-sm text-gray-600">Pick up where you left off.</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {recentlyViewed.slice(0, 10).map((p) => (
                    <ProductCard key={p.id} p={p} onQuickAdd={quickAdd} addingId={addingId} />
                  ))}
                </div>
              </section>
            )}

            {alsoLike.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <div className="text-xl font-extrabold text-gray-900">You may also like</div>
                    <div className="text-sm text-gray-600">Popular picks from our store.</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {alsoLike.slice(0, 10).map((p) => (
                    <ProductCard key={p.id} p={p} onQuickAdd={quickAdd} addingId={addingId} />
                  ))}
                </div>
              </section>
            )}

          {/* SEO: Product price in Bangladesh */}
          <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 bg-gradient-to-br from-blue-50 via-white to-white">
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">{product.name} price in Bangladesh</h2>
              <p className="mt-2 text-sm md:text-base text-gray-700 leading-relaxed">
                Looking for the latest {product.name} price in Bangladesh? At Spraxe, we keep pricing transparent and
                updated as frequently as possible. Today’s listed price is <span className="font-extrabold text-blue-900">{moneyBDT(price)}</span>.
                Prices may vary based on stock, warranty type, and official market changes — so checking the product page
                before ordering is the best way to confirm the current offer.
              </p>

              <h3 className="mt-6 text-lg md:text-xl font-extrabold text-gray-900">Why choose Spraxe?</h3>
              <p className="mt-2 text-sm md:text-base text-gray-700 leading-relaxed">
                Spraxe is built for shoppers in Bangladesh who want authentic gadgets without the hassle. From gaming laptops
                and Apple accessories to flagship smartphones and everyday essentials, we focus on quality listings, fast
                communication, and reliable delivery. Order online through Spraxe and get clear checkout options, quick order
                confirmation, and helpful support whenever you need it.
              </p>
              <p className="mt-3 text-sm md:text-base text-gray-700 leading-relaxed">
                Whether you’re buying a premium device like the Galaxy S25 Ultra 5G or upgrading your setup with trusted
                accessories, Spraxe aims to make the experience smooth — with fair pricing, responsive service, and a store
                that’s designed for convenience.
              </p>
            </div>
          </section>
          </div>
        </div>
      </main>

      {/* Sticky mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Price</div>
            <div className="text-base font-extrabold text-blue-900 truncate">{moneyBDT(price)}</div>
          </div>

          <Button
            className="flex-1 bg-blue-900 hover:bg-blue-800 h-11 rounded-xl font-extrabold"
            onClick={handleBuyNow}
            disabled={adding || outOfStock || (isClothing && !selectedSize)}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            {adding ? 'Adding...' : 'Buy Now'}
          </Button>

          <Button variant="outline" className="h-11 rounded-xl bg-white" onClick={toggleWishlist} aria-label="Wishlist" type="button">
            <Heart className={`h-5 w-5 ${wishlisted ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="lg:hidden h-16" />

      <Footer />
    </div>
  );
}
