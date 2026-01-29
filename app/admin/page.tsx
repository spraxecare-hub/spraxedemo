'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Package,
  Store,
  ShoppingBag,
  Users,
  AlertCircle,
  PlusCircle,
  List,
  Image as ImageIcon,
  Settings,
  ChevronRight,
  MessageSquare,
  LifeBuoy,
  TrendingUp,
  Calendar,
  TicketPercent,
  Star,
  BarChart3,
} from 'lucide-react';

/* ================= TYPES ================= */

type Stats = {
  products: number;
  orders: number;
  customers: number;
  pendingOrders: number;
  unresolvedTickets: number;
  pendingTickets: number;
};

type BestSeller = {
  product_name: string;
  units: number;
  revenue: number;
  orders: number;
};

type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
  products?: { name?: string | null; slug?: string | null } | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

// ✅ MATCHES your table: review_replies(id, review_id, admin_id, reply, created_at)
type ReviewReplyRow = {
  id: string;
  review_id: string;
  admin_id: string;
  reply: string;
  created_at: string;
};

/* ================= HELPERS ================= */

const fmtBDT = (n: number) =>
  `৳${(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 0 })}`;

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return `just now`;
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const statusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'pending')
    return <Badge className="bg-yellow-100 text-yellow-800 border">Pending</Badge>;
  if (s === 'processing')
    return <Badge className="bg-blue-100 text-blue-800 border">Processing</Badge>;
  if (s === 'shipped')
    return <Badge className="bg-purple-100 text-purple-800 border">Shipped</Badge>;
  if (s === 'delivered' || s === 'completed')
    return <Badge className="bg-green-100 text-green-800 border">Completed</Badge>;
  return <Badge variant="outline">{s || 'unknown'}</Badge>;
};

const stars = (rating: number | null | undefined) => {
  const r = Math.max(0, Math.min(5, Number(rating || 0)));
  const full = Math.round(r);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? 'text-yellow-500' : 'text-gray-300'}>
          ★
        </span>
      ))}
      <span className="ml-2 text-xs text-gray-500">{r ? r.toFixed(1) : '—'}</span>
    </div>
  );
};

const safeErrorMessage = (e: any) => {
  // Supabase PostgrestError usually has message/code/details
  return (
    e?.message ||
    e?.error_description ||
    e?.details ||
    e?.hint ||
    'Something went wrong. Please try again.'
  );
};

const makeTempId = () => {
  // avoids crypto issues in some envs
  return `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/* ================= COMPACT STAT CARD ================= */

function StatCard({
  title,
  value,
  icon,
  accent,
  valueClassName,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  accent: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'sky';
  valueClassName?: string;
}) {
  const border =
    accent === 'blue'
      ? 'border-l-blue-600'
      : accent === 'green'
        ? 'border-l-green-600'
        : accent === 'purple'
          ? 'border-l-purple-600'
          : accent === 'orange'
            ? 'border-l-orange-500'
            : accent === 'red'
              ? 'border-l-red-500'
              : 'border-l-sky-500';

  const iconColor =
    accent === 'blue'
      ? 'text-blue-600'
      : accent === 'green'
        ? 'text-green-600'
        : accent === 'purple'
          ? 'text-purple-600'
          : accent === 'orange'
            ? 'text-orange-500'
            : accent === 'red'
              ? 'text-red-500'
              : 'text-sky-500';

  return (
    <Card className={`border-l-4 ${border} shadow-sm`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-4">
        <CardTitle className="text-xs font-medium text-gray-500 leading-none">{title}</CardTitle>
        <div className={`${iconColor} flex items-center justify-center`}>{icon}</div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-0">
        <div className={`text-lg font-semibold text-gray-900 ${valueClassName || ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

/* ================= Product Reviews Button (badge count) ================= */

function ReviewsButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="bg-white" onClick={onClick} type="button">
        <Star className="h-4 w-4 mr-2" />
        Product Reviews
      </Button>

      {count > 0 && (
        <div className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </div>
      )}
    </div>
  );
}

/* ================= DASHBOARD ================= */

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [stats, setStats] = useState<Stats>({
    products: 0,
    orders: 0,
    customers: 0,
    pendingOrders: 0,
    unresolvedTickets: 0,
    pendingTickets: 0,
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [bestMode, setBestMode] = useState<'units' | 'revenue'>('units');
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingBest, setLoadingBest] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Reviews drawer
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [replyByReviewId, setReplyByReviewId] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<Record<string, boolean>>({});
  const [repliesByReviewId, setRepliesByReviewId] = useState<Record<string, ReviewReplyRow[]>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [reviewsLastUpdated, setReviewsLastUpdated] = useState<Date | null>(null);

  // Always-consistent unreplied count
  const unrepliedCount = useMemo(() => {
    if (!reviews?.length) return 0;
    return reviews.reduce((acc, r) => acc + ((repliesByReviewId[r.id]?.length || 0) === 0 ? 1 : 0), 0);
  }, [reviews, repliesByReviewId]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchDashboardData();
    fetchBestSellers();
    fetchReviewsPanelData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const [
        products,
        orders,
        customers,
        pendingOrders,
        openTickets,
        inProgressTickets,
        revenueDeliveredAgg,
      ] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('orders').select('total').eq('status', 'delivered'),
      ]);

      if (!isMountedRef.current) return;

      setStats({
        products: products.count || 0,
        orders: orders.count || 0,
        customers: customers.count || 0,
        pendingOrders: pendingOrders.count || 0,
        unresolvedTickets: openTickets.count || 0,
        pendingTickets: inProgressTickets.count || 0,
      });

      const revenueDelivered =
        revenueDeliveredAgg.data?.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0) || 0;
      setRevenueTotal(revenueDelivered);

      const { data: recentOrdersData, error: roErr } = await supabase
        .from('orders')
        .select(
          `
          id,
          order_number,
          customer_name,
          total,
          status,
          created_at,
          contact_number,
          profiles ( full_name, email, phone )
        `
        )
        .order('created_at', { ascending: false })
        .limit(10);

      if (roErr) throw roErr;
      if (!isMountedRef.current) return;

      setRecentOrders(recentOrdersData || []);
      setLastRefreshed(new Date());
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Dashboard load failed',
        description: safeErrorMessage(e),
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const fetchBestSellers = async () => {
    setLoadingBest(true);

    try {
      const DAYS = 30;
      const since = new Date();
      since.setDate(since.getDate() - DAYS);

      const { data: deliveredOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'delivered')
        .gte('created_at', since.toISOString());

      if (ordersErr) throw ordersErr;

      const orderIds = (deliveredOrders || []).map((o: any) => o.id);

      let itemsQuery = supabase
        .from('order_items')
        .select('product_name, quantity, total_price, order_id, created_at')
        .gte('created_at', since.toISOString());

      if (orderIds.length > 0) itemsQuery = itemsQuery.in('order_id', orderIds);

      const { data: items, error: itemsErr } = await itemsQuery;
      if (itemsErr) throw itemsErr;

      const map = new Map<string, { units: number; revenue: number; orders: Set<string> }>();

      for (const row of items || []) {
        const name = (row as any).product_name || 'Unknown';
        const qty = Number((row as any).quantity || 0);
        const revenue = Number((row as any).total_price || 0);
        const oid = String((row as any).order_id || '');

        if (!map.has(name)) map.set(name, { units: 0, revenue: 0, orders: new Set() });
        const entry = map.get(name)!;

        entry.units += qty;
        entry.revenue += revenue;
        if (oid) entry.orders.add(oid);
      }

      const top = Array.from(map.entries())
        .map(([product_name, v]) => ({
          product_name,
          units: v.units,
          revenue: v.revenue,
          orders: v.orders.size,
        }))
        .sort((a, b) => (bestMode === 'units' ? b.units - a.units : b.revenue - a.revenue))
        .slice(0, 8);

      if (!isMountedRef.current) return;

      setBestSellers(top);
      setLastRefreshed(new Date());
    } catch (e: any) {
      console.error('Best sellers error:', e);
      if (isMountedRef.current) setBestSellers([]);
    } finally {
      if (isMountedRef.current) setLoadingBest(false);
    }
  };

  /**
   * Reviews panel loader:
   * - Fetch latest reviews
   * - Fetch replies for those reviews
   * - Keep newest reply first per review
   */
  const fetchReviewsPanelData = async () => {
    setReviewsLoading(true);

    try {
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
          products ( name, slug ),
          profiles ( full_name, email )
        `
        )
        .order('created_at', { ascending: false })
        .limit(50);

      if (reviewsRes.error) throw reviewsRes.error;

      const reviewRows = (reviewsRes.data || []) as ReviewRow[];
      if (!isMountedRef.current) return;

      setReviews(reviewRows);

      const reviewIds = reviewRows.map((r) => r.id);
      if (reviewIds.length === 0) {
        setRepliesByReviewId({});
        setReviewsLastUpdated(new Date());
        return;
      }

      const repliesRes = await supabase
        .from('review_replies')
        .select('id, review_id, admin_id, reply, created_at')
        .in('review_id', reviewIds);

      if (repliesRes.error) throw repliesRes.error;
      if (!isMountedRef.current) return;

      const map: Record<string, ReviewReplyRow[]> = {};
      for (const rr of (repliesRes.data || []) as ReviewReplyRow[]) {
        if (!map[rr.review_id]) map[rr.review_id] = [];
        map[rr.review_id].push(rr);
      }

      // newest first
      for (const k of Object.keys(map)) {
        map[k].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      setRepliesByReviewId(map);
      setReviewsLastUpdated(new Date());
    } catch (e: any) {
      console.error('fetchReviewsPanelData error:', e);
      toast({
        title: 'Could not load reviews',
        description: safeErrorMessage(e),
        variant: 'destructive',
      });
      if (!isMountedRef.current) return;
      setReviews([]);
      setRepliesByReviewId({});
      setReviewsLastUpdated(null);
    } finally {
      if (isMountedRef.current) setReviewsLoading(false);
    }
  };

  /**
   * Robust reply submit:
   * ✅ If DB allows multiple replies -> INSERT new reply
   * ✅ If DB restricts 1 reply per review (unique review_id) -> automatically UPDATE latest reply
   * ✅ Optimistic UI + rollback on failure
   */
  const submitReply = async (reviewId: string) => {
    const raw = replyByReviewId[reviewId] || '';
    const reply = raw.trim();
    if (!reply) return;

    if (!user) {
      toast({ title: 'Login required', description: 'Please log in as admin.', variant: 'destructive' });
      return;
    }

    // prevent double click / enter spamming
    if (replying[reviewId]) return;

    setReplying((p) => ({ ...p, [reviewId]: true }));

    const previousReplies = repliesByReviewId[reviewId] || [];
    const hasReplyAlready = previousReplies.length > 0;

    // --- Optimistic update
    const tempId = makeTempId();
    const nowIso = new Date().toISOString();

    const optimisticInsertRow: ReviewReplyRow = {
      id: tempId,
      review_id: reviewId,
      admin_id: user.id,
      reply,
      created_at: nowIso,
    };

    // keep a rollback snapshot
    const rollbackReplies = previousReplies.slice();

    if (!hasReplyAlready) {
      // optimistic insert
      setRepliesByReviewId((prev) => ({
        ...prev,
        [reviewId]: [optimisticInsertRow, ...(prev[reviewId] || [])],
      }));
    } else {
      // optimistic update latest reply (UI feels consistent even if DB is insert-only or update-only)
      setRepliesByReviewId((prev) => {
        const cur = prev[reviewId] || [];
        if (cur.length === 0) return prev;

        const updated0: ReviewReplyRow = { ...cur[0], reply, created_at: nowIso, admin_id: user.id };
        return { ...prev, [reviewId]: [updated0, ...cur.slice(1)] };
      });
    }

    try {
      // Try INSERT first (best when multiple replies are allowed)
      const insertRes = await supabase
        .from('review_replies')
        .insert({ review_id: reviewId, admin_id: user.id, reply })
        .select('id, review_id, admin_id, reply, created_at')
        .single();

      if (!insertRes.error && insertRes.data) {
        // Replace temp row with real row (if temp exists)
        const real = insertRes.data as ReviewReplyRow;
        setRepliesByReviewId((prev) => {
          const cur = prev[reviewId] || [];
          const replaced = cur.map((x) => (x.id === tempId ? real : x));
          // if optimistic was "update" (not insert), ensure latest becomes real
          if (!replaced.some((x) => x.id === real.id)) {
            return { ...prev, [reviewId]: [real, ...cur] };
          }
          // sort newest first
          replaced.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return { ...prev, [reviewId]: replaced };
        });

        setReplyByReviewId((prev) => ({ ...prev, [reviewId]: '' }));
        toast({ title: 'Reply sent', description: 'Your reply is now visible on the product page.' });
        return;
      }

      // If INSERT fails because only 1 reply allowed per review, fall back to UPDATE latest reply row
      const code = (insertRes.error as any)?.code;
      const msg = (insertRes.error as any)?.message || '';
      const looksLikeUnique =
        code === '23505' ||
        /duplicate key/i.test(msg) ||
        /unique constraint/i.test(msg) ||
        /violates unique/i.test(msg);

      if (!looksLikeUnique) {
        throw insertRes.error;
      }

      // UPDATE latest reply (or fetch latest if none locally)
      let targetId = previousReplies[0]?.id;

      if (!targetId) {
        const latestRes = await supabase
          .from('review_replies')
          .select('id, review_id, admin_id, reply, created_at')
          .eq('review_id', reviewId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRes.error) throw latestRes.error;
        targetId = latestRes.data?.id;
      }

      if (!targetId) {
        // should not happen, but handle gracefully
        throw new Error('Could not find an existing reply to update.');
      }

      const updateRes = await supabase
        .from('review_replies')
        .update({ reply })
        .eq('id', targetId)
        .select('id, review_id, admin_id, reply, created_at')
        .single();

      if (updateRes.error) throw updateRes.error;

      const updated = updateRes.data as ReviewReplyRow;
      setRepliesByReviewId((prev) => {
        const cur = prev[reviewId] || [];
        const next = cur.map((x) => (x.id === targetId || x.id === tempId ? updated : x));
        // if it wasn't in list, inject
        if (!next.some((x) => x.id === updated.id)) next.unshift(updated);
        next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { ...prev, [reviewId]: next };
      });

      setReplyByReviewId((prev) => ({ ...prev, [reviewId]: '' }));
      toast({ title: 'Reply updated', description: 'The latest reply was updated and is visible to customers.' });
    } catch (e: any) {
      console.error('submitReply error:', e);

      // rollback optimistic UI
      setRepliesByReviewId((prev) => ({ ...prev, [reviewId]: rollbackReplies }));

      toast({
        title: 'Reply failed',
        description: safeErrorMessage(e),
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) setReplying((p) => ({ ...p, [reviewId]: false }));
    }
  };

  // -------- Realtime for reviews (so badge & threads update)
  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;

    const ch = supabase
      .channel('admin-dashboard-reviews-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_reviews' }, () => {
        fetchReviewsPanelData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'review_replies' }, () => {
        fetchReviewsPanelData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'review_replies' }, () => {
        fetchReviewsPanelData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;
    fetchBestSellers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestMode]);

  const adminName = profile?.full_name || user?.email?.split('@')[0] || 'Admin';

  const quickLinks = useMemo(
    () => [
      {
        group: 'Sales',
        items: [
          { href: '/admin/orders', icon: <ShoppingBag className="h-4 w-4" />, label: 'View Orders' },
          { href: '/admin/customers', icon: <Users className="h-4 w-4" />, label: 'Customers' },
          { href: '/admin/sellers', icon: <Store className="h-4 w-4" />, label: 'Sellers' },
          { href: '/admin/reports', icon: <BarChart3 className="h-4 w-4" />, label: 'Reports' },
        ],
      },
      {
        group: 'Support',
        items: [{ href: '/admin/support', icon: <MessageSquare className="h-4 w-4" />, label: 'Support Tickets' }],
      },
      {
        group: 'Inventory',
        items: [{ href: '/admin/inventory', icon: <Package className="h-4 w-4" />, label: 'Inventory' }],
      },
      {
        group: 'Catalog',
        items: [
          {
            href: '/admin/products/new',
            icon: <PlusCircle className="h-4 w-4" />,
            label: 'Add Product',
            primary: true,
          },
          { href: '/admin/categories', icon: <List className="h-4 w-4" />, label: 'Categories' },
          { href: '/admin/featured', icon: <ImageIcon className="h-4 w-4" />, label: 'Featured Images' },
          { href: '/admin/vouchers', icon: <TicketPercent className="h-4 w-4" />, label: 'Vouchers' },
          { href: '/admin/blogs', icon: <Calendar className="h-4 w-4" />, label: 'Blog Posts' },
        ],
      },
    ],
    []
  );

  const maxBest =
    bestSellers.length === 0
      ? 0
      : bestMode === 'units'
        ? Math.max(...bestSellers.map((x) => x.units))
        : Math.max(...bestSellers.map((x) => x.revenue));

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="w-full px-3 md:px-4 py-8 flex flex-col xl:flex-row gap-4 flex-1">
        {/* LEFT: Quick actions */}
        <aside className="w-full xl:w-[260px] flex-shrink-0 space-y-6">
          <Card className="border-blue-100 shadow-sm sticky top-4">
            <CardHeader className="bg-white border-b">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-900" />
                Quick Actions
              </CardTitle>
              <div className="text-sm text-gray-500 mt-1">Shortcuts to your most used tools</div>
            </CardHeader>

            <CardContent className="p-4 space-y-5">
              {quickLinks.map((section) => (
                <div key={section.group}>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {section.group}
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <Link key={item.href} href={item.href} className="block">
                        <Button
                          size="sm"
                          variant={item.primary ? 'default' : 'outline'}
                          className={
                            item.primary
                              ? 'w-full justify-start bg-blue-900 hover:bg-blue-800'
                              : 'w-full justify-start hover:bg-blue-50 hover:text-blue-700'
                          }
                          type="button"
                        >
                          <span className="mr-2">{item.icon}</span>
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t text-xs text-gray-500">
                Logged in as <span className="font-semibold text-gray-700">{adminName}</span>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* RIGHT: Main */}
        <main className="flex-1 space-y-8 min-w-0">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Store performance + support workload overview</p>
              {lastRefreshed && <div className="text-xs text-gray-400 mt-1">Updated {timeAgo(lastRefreshed.toISOString())}</div>}
            </div>

            <div className="flex items-center gap-2">
              {/* Product Reviews button with unreplied count */}
              <div className="relative">
                <ReviewsButton
                  count={unrepliedCount}
                  onClick={() => {
                    setReviewsOpen((prev) => {
                      const next = !prev;
                      if (!prev) void fetchReviewsPanelData();
                      return next;
                    });
                  }}
                />

                {reviewsOpen && (
                  <div className="absolute right-0 mt-2 w-[560px] max-w-[92vw] bg-white border rounded-2xl shadow-lg z-50 overflow-hidden">
                    <div className="p-3 flex items-center justify-between bg-gray-50 border-b">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">Product Reviews</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Unreplied: <b>{unrepliedCount}</b>
                          {reviewsLastUpdated && (
                            <span className="ml-2 text-gray-400">• Updated {timeAgo(reviewsLastUpdated.toISOString())}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 bg-white"
                          onClick={fetchReviewsPanelData}
                          disabled={reviewsLoading}
                          type="button"
                        >
                          Refresh
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => setReviewsOpen(false)} type="button">
                          Close
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-[560px] overflow-y-auto">
                      {reviewsLoading ? (
                        <div className="p-4 text-sm text-gray-500">Loading…</div>
                      ) : reviews.length === 0 ? (
                        <div className="p-6 text-sm text-gray-500 text-center">No reviews yet.</div>
                      ) : (
                        <div className="divide-y">
                          {reviews.map((r) => {
                            const productName = r.products?.name || 'Product';
                            const productSlug = r.products?.slug || null;
                            const customer = r.profiles?.full_name || r.profiles?.email || 'Customer';
                            const replies = repliesByReviewId[r.id] || [];
                            const hasReply = replies.length > 0;
                            const expanded = !!expandedReplies[r.id];

                            return (
                              <div key={r.id} className="p-4 hover:bg-gray-50">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold text-gray-900 truncate">{productName}</div>
                                      {!hasReply ? (
                                        <Badge className="bg-red-50 text-red-700 border border-red-200">Unreplied</Badge>
                                      ) : (
                                        <Badge className="bg-green-50 text-green-700 border border-green-200">
                                          Replied ({replies.length})
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="mt-1">{stars(r.rating)}</div>

                                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                                      {r.comment || <span className="text-gray-400">(No comment)</span>}
                                    </div>

                                    <div className="mt-2 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span>
                                        By <span className="font-semibold text-gray-700">{customer}</span>
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {new Date(r.created_at).toLocaleDateString()} • {timeAgo(r.created_at)}
                                      </span>
                                      {productSlug && (
                                        <>
                                          <span>•</span>
                                          <Link
                                            className="text-blue-600 hover:text-blue-800"
                                            href={`/products/${productSlug}?tab=reviews`}
                                            onClick={() => setReviewsOpen(false)}
                                          >
                                            Open product
                                          </Link>
                                        </>
                                      )}
                                    </div>

                                    {/* Reply history + toggle */}
                                    {hasReply && (
                                      <div className="mt-3 rounded-xl border bg-white p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="text-xs font-semibold text-gray-600">
                                            {expanded ? 'Replies' : 'Latest Reply'}
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs bg-white"
                                            onClick={() =>
                                              setExpandedReplies((p) => ({ ...p, [r.id]: !p[r.id] }))
                                            }
                                            type="button"
                                          >
                                            {expanded ? 'Hide' : `View all (${replies.length})`}
                                          </Button>
                                        </div>

                                        {!expanded ? (
                                          <>
                                            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                                              {replies[0].reply}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2">{timeAgo(replies[0].created_at)}</div>
                                          </>
                                        ) : (
                                          <div className="mt-2 space-y-3">
                                            {replies.map((rr) => (
                                              <div key={rr.id} className="rounded-lg border bg-gray-50 p-2">
                                                <div className="text-sm text-gray-800 whitespace-pre-wrap">{rr.reply}</div>
                                                <div className="text-xs text-gray-400 mt-1">{timeAgo(rr.created_at)}</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Reply box (always available; robust insert/update handled in submitReply) */}
                                    <div className="mt-3">
                                      <div className="text-xs font-semibold text-gray-600 mb-1">
                                        {hasReply ? 'Reply again (or update latest)' : 'Reply'}
                                      </div>
                                      <textarea
                                        className="w-full min-h-[84px] text-sm rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder="Write a professional reply…"
                                        value={replyByReviewId[r.id] || ''}
                                        onChange={(e) =>
                                          setReplyByReviewId((prev) => ({ ...prev, [r.id]: e.target.value }))
                                        }
                                      />
                                      <div className="mt-2 flex items-center justify-between gap-2">
                                        <div className="text-xs text-gray-400">
                                          Replies are visible to customers on the product page.
                                        </div>
                                        <Button
                                          size="sm"
                                          className="bg-blue-900 hover:bg-blue-800"
                                          onClick={() => submitReply(r.id)}
                                          disabled={replying[r.id] || !(replyByReviewId[r.id] || '').trim()}
                                          type="button"
                                        >
                                          {replying[r.id] ? 'Sending…' : hasReply ? 'Send / Update Reply' : 'Send Reply'}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="p-3 border-t bg-white">
                      <div className="text-xs text-gray-500">
                        Showing latest 50 reviews. Badge count = reviews with <b>no reply</b>.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Link href="/admin">
                <Button variant="outline" size="sm" type="button">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              </Link>
              <Badge className="bg-blue-50 text-blue-900 border border-blue-100">Welcome, {adminName}</Badge>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            <StatCard title="Products" value={stats.products} icon={<Package className="w-4 h-4" />} accent="blue" />
            <StatCard title="Orders" value={stats.orders} icon={<ShoppingBag className="w-4 h-4" />} accent="green" />
            <StatCard title="Customers" value={stats.customers} icon={<Users className="w-4 h-4" />} accent="purple" />
            <StatCard
              title="Delivered Revenue"
              value={fmtBDT(revenueTotal)}
              icon={<TrendingUp className="w-4 h-4" />}
              accent="green"
            />
            <StatCard
              title="Pending Orders"
              value={stats.pendingOrders}
              icon={<AlertCircle className="w-4 h-4" />}
              accent="orange"
              valueClassName="text-orange-600"
            />
            <StatCard
              title="Unresolved Tickets"
              value={stats.unresolvedTickets}
              icon={<LifeBuoy className="w-4 h-4" />}
              accent="red"
              valueClassName="text-red-600"
            />
          </div>

          {/* GRID: Best Sellers + Recent Orders */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Best sellers */}
            <Card className="shadow-sm border-gray-200 overflow-hidden xl:col-span-1">
              <CardHeader className="bg-gray-50/50 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Best Sellers (30d • Delivered)
                </CardTitle>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={bestMode === 'units' ? 'default' : 'outline'}
                    className={bestMode === 'units' ? 'bg-blue-900 hover:bg-blue-800 h-8' : 'h-8'}
                    onClick={() => setBestMode('units')}
                    type="button"
                  >
                    Units
                  </Button>
                  <Button
                    size="sm"
                    variant={bestMode === 'revenue' ? 'default' : 'outline'}
                    className={bestMode === 'revenue' ? 'bg-blue-900 hover:bg-blue-800 h-8' : 'h-8'}
                    onClick={() => setBestMode('revenue')}
                    type="button"
                  >
                    Revenue
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loadingBest ? (
                  <div className="p-5 space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-12 bg-white rounded-md border animate-pulse" />
                    ))}
                  </div>
                ) : bestSellers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No sales data yet.</div>
                ) : (
                  <div className="divide-y">
                    {bestSellers.map((p, idx) => {
                      const val = bestMode === 'units' ? p.units : p.revenue;
                      const pct = maxBest > 0 ? Math.round((val / maxBest) * 100) : 0;

                      return (
                        <div key={p.product_name} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {idx + 1}
                                </Badge>
                                <div className="font-medium text-gray-900 truncate">{p.product_name}</div>
                              </div>

                              <div className="mt-2 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-900 rounded-full" style={{ width: `${pct}%` }} />
                              </div>

                              <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                                <span>
                                  <b>{p.units}</b> units
                                </span>
                                <span>
                                  <b>{fmtBDT(p.revenue)}</b>
                                </span>
                                <span>
                                  <b>{p.orders}</b> orders
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-bold text-blue-900">
                                {bestMode === 'units' ? p.units : fmtBDT(p.revenue)}
                              </div>
                              <div className="text-xs text-gray-400">{pct}%</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card className="shadow-sm border-gray-200 overflow-hidden xl:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/50 border-b">
                <CardTitle className="text-lg text-gray-800">Recent Orders</CardTitle>

                <Link href="/admin/orders">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    type="button"
                  >
                    View All <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-12 bg-white rounded-md border animate-pulse" />
                    ))}
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-14 text-gray-500">No orders found.</div>
                ) : (
                  <>
                    {/* Mobile list */}
                    <div className="md:hidden divide-y bg-white">
                      {recentOrders.map((order) => (
                        <div key={order.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900">
                                {order.order_number || order.id.slice(0, 8)}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5 truncate">
                                {order.profiles?.full_name || (order as any).customer_name || order.profiles?.email || 'Guest'}
                              </div>

                              <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                  {new Date(order.created_at).toLocaleDateString()} • {timeAgo(order.created_at)}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              {statusBadge(order.status)}
                              <div className="font-semibold text-gray-900">{fmtBDT(Number(order.total || 0))}</div>
                              <Link href={`/invoice/${order.id}`}>
                                <Button variant="outline" size="sm" className="h-8 text-xs px-3" type="button">
                                  View
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block">
                      <table className="w-full table-fixed text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-3 w-[14%]">Order</th>
                            <th className="px-3 py-3 w-[26%]">Customer</th>
                            <th className="px-3 py-3 w-[16%]">Contact</th>
                            <th className="px-3 py-3 w-[18%]">Date</th>
                            <th className="px-3 py-3 w-[10%]">Status</th>
                            <th className="px-3 py-3 w-[10%] text-right">Total</th>
                            <th className="px-3 py-3 w-[6%] text-right">Action</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 bg-white">
                          {recentOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-3 font-semibold text-gray-900">
                                <div className="truncate">{order.order_number || order.id.slice(0, 8)}</div>
                              </td>
                              <td className="px-3 py-3 min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {order.profiles?.full_name || (order as any).customer_name || order.profiles?.email || 'Guest'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{order.profiles?.email || '—'}</div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="text-sm text-gray-700 break-words">
                                  {order.contact_number || order.profiles?.phone || '—'}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2 text-gray-700">
                                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-sm truncate">{new Date(order.created_at).toLocaleDateString()}</div>
                                    <div className="text-xs text-gray-400 truncate">{timeAgo(order.created_at)}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">{statusBadge(order.status)}</td>
                              <td className="px-3 py-3 text-right font-semibold text-gray-900">
                                <span className="truncate block">{fmtBDT(Number(order.total || 0))}</span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Link href={`/invoice/${order.id}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2 text-xs hover:bg-blue-50 hover:text-blue-700"
                                    type="button"
                                  >
                                    View
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="text-xs text-gray-500">
            Product reviews can be managed from the “Product Reviews” panel (reply directly from the dashboard).
          </div>
        </main>
      </div>
    </div>
  );
}
