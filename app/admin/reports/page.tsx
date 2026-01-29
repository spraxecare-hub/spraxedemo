'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/hooks/use-toast';
import { bdt } from '@/lib/utils/money';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SafeImage } from '@/components/ui/safe-image';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  Download,
  FileText,
  RefreshCcw,
  Save,
  Search,
  Filter,
  CalendarDays,
  Banknote,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock3,
  TrendingUp,
  Package,
  BadgeCheck,
} from 'lucide-react';

import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns';

// Which statuses count as "real sales"
const SALES_ORDER_STATUSES = ['processing', 'shipped', 'delivered', 'completed'];

// Brand
const BRAND_NAME = 'SPRAXE';
const BRAND_TAGLINE = 'Admin Sales Report';
const BRAND_ADDR = 'Gazipur, Dhaka, Bangladesh';
const BRAND_PHONE = '09638371951';
const LOGO_URL =
  'https://kybgrsqqvejbvjediowo.supabase.co/storage/v1/object/public/category/spraxe.png';

// Types (lightweight)
type OrderRow = {
  id: string;
  created_at: string;
  status: string | null;
  total: number | null;
  total_amount: number | null;
  order_number?: string | null;
  payment_method: string | null;
  payment_status: string | null;
};

type ItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  total_price: number | null;
};

type Summary = {
  revenue: number;
  orders: number;
  itemsSold: number;
  delivered: number;

  codOrders: number;
  bkashOrders: number;

  paidOrders: number;
  unpaidOrders: number;

  avgOrderValue: number;
};

type BreakdownRow = {
  date: string; // YYYY-MM-DD
  orders: number;
  revenue: number;
  itemsSold: number;
};

type TopProductRow = {
  product_id: string;
  product_name: string;
  qty: number;
  revenue: number;
};

type PaymentBreakdownRow = {
  method: 'COD' | 'bKash' | 'Other';
  orders: number;
  revenue: number;
};

type StatusBreakdownRow = {
  status: string;
  orders: number;
  revenue: number;
};

type PaymentStatusBreakdownRow = {
  status: string; // paid | unpaid | pending | failed | unknown
  orders: number;
  revenue: number;
};

function safeNumber(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function orderRevenue(o: OrderRow) {
  // your table has total and total_amount; prefer total if present
  const v = o.total ?? o.total_amount ?? 0;
  return safeNumber(v);
}

function isSalesStatus(status: string | null | undefined) {
  const s = String(status || '').toLowerCase();
  return SALES_ORDER_STATUSES.includes(s);
}

function ymd(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function normalizePaymentMethod(method: any): 'COD' | 'bKash' | 'Other' {
  const m = String(method ?? '').trim().toLowerCase();
  if (m.includes('bkash')) return 'bKash';
  if (m.includes('cod') || m.includes('cash')) return 'COD';
  return 'Other';
}

function normalizePaymentStatus(status: any): 'paid' | 'unpaid' | 'pending' | 'failed' | 'unknown' {
  const s = String(status ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('paid') || s === 'success') return 'paid';
  if (s.includes('unpaid')) return 'unpaid';
  if (s.includes('pending')) return 'pending';
  if (s.includes('fail') || s.includes('cancel')) return 'failed';
  return s as any;
}

function statusMeta(status: any) {
  const s = String(status ?? '').toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
    confirmed: { label: 'Confirmed', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
    processing: { label: 'Processing', cls: 'bg-purple-50 text-purple-800 border-purple-200' },
    shipped: { label: 'Shipped', cls: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    delivered: { label: 'Delivered', cls: 'bg-green-50 text-green-800 border-green-200' },
    completed: { label: 'Completed', cls: 'bg-green-50 text-green-800 border-green-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-800 border-red-200' },
  };
  return map[s] || { label: s || 'Unknown', cls: 'bg-gray-50 text-gray-700 border-gray-200' };
}

function paymentMeta(method: any) {
  const m = normalizePaymentMethod(method);
  if (m === 'bKash') {
    return { label: 'bKash', Icon: CreditCard, cls: 'bg-pink-50 text-pink-800 border-pink-200' };
  }
  if (m === 'COD') {
    return { label: 'Cash on Delivery', Icon: Banknote, cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  return { label: 'Other', Icon: CreditCard, cls: 'bg-gray-50 text-gray-700 border-gray-200' };
}

function payStatusMeta(s: any) {
  const p = normalizePaymentStatus(s);
  const map: Record<string, { label: string; Icon: any; cls: string }> = {
    paid: { label: 'Paid', Icon: CheckCircle2, cls: 'bg-green-50 text-green-800 border-green-200' },
    unpaid: { label: 'Unpaid', Icon: XCircle, cls: 'bg-red-50 text-red-800 border-red-200' },
    pending: { label: 'Pending', Icon: Clock3, cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
    failed: { label: 'Failed', Icon: XCircle, cls: 'bg-red-50 text-red-800 border-red-200' },
    unknown: { label: 'Unknown', Icon: Clock3, cls: 'bg-gray-50 text-gray-700 border-gray-200' },
  };
  return map[p] || map.unknown;
}

export default function AdminReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);

  // Controls
  const today = useMemo(() => new Date(), []);
  const [dailyDate, setDailyDate] = useState(() => ymd(today));
  const [weeklyDate, setWeeklyDate] = useState(() => ymd(today)); // any date within week
  const [monthlyDate, setMonthlyDate] = useState(() => format(today, 'yyyy-MM')); // "YYYY-MM"

  // Advanced filters
  const [search, setSearch] = useState('');
  const [includeNonSales, setIncludeNonSales] = useState(false); // by default show “real sales”
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cod' | 'bkash' | 'other'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending' | 'failed' | 'unknown'>('all');
  const [minTotal, setMinTotal] = useState<string>(''); // keep as string to allow empty
  const [maxTotal, setMaxTotal] = useState<string>('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // Data
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdownRow[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdownRow[]>([]);
  const [paymentStatusBreakdown, setPaymentStatusBreakdown] = useState<PaymentStatusBreakdownRow[]>([]);
  const [ordersInRange, setOrdersInRange] = useState<OrderRow[]>([]);

  // Monthly snapshots
  const [monthlySnapshots, setMonthlySnapshots] = useState<{ month: string }[]>([]);
  const [useStoredMonthly, setUseStoredMonthly] = useState(true);

  const printRef = useRef<HTMLDivElement>(null);

  // Basic admin guard
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (profile && profile.role !== 'admin') {
      router.push('/');
    }
  }, [user, profile, router]);

  // Load monthly snapshots list
  useEffect(() => {
    const loadSnapshots = async () => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('month')
        .order('month', { ascending: false })
        .limit(24);

      if (!error && data) {
        setMonthlySnapshots(data.map((r: any) => ({ month: String(r.month).slice(0, 10) })));
      }
    };

    void loadSnapshots();
  }, []);

  // Fetch report whenever controls change
  useEffect(() => {
    if (!user || (profile && profile.role !== 'admin')) return;
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    dailyDate,
    weeklyDate,
    monthlyDate,
    useStoredMonthly,
    // filters
    search,
    includeNonSales,
    statusFilter,
    paymentMethodFilter,
    paymentStatusFilter,
    minTotal,
    maxTotal,
    sort,
  ]);

  function getRange(mode: 'daily' | 'weekly' | 'monthly', d: string, w: string, m: string) {
    if (mode === 'daily') {
      const day = new Date(d);
      return { start: startOfDay(day), end: endOfDay(day) };
    }
    if (mode === 'weekly') {
      const any = new Date(w);
      const s = startOfWeek(any, { weekStartsOn: 6 }); // Saturday start (BD common). Use 1 for Monday.
      const e = endOfWeek(any, { weekStartsOn: 6 });
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    // monthly
    const ms = startOfMonth(new Date(`${m}-01`));
    const me = endOfMonth(ms);
    return { start: startOfDay(ms), end: endOfDay(me) };
  }

  async function fetchOrders(start: Date, end: Date): Promise<OrderRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, created_at, status, total, total_amount, payment_method, payment_status')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as any;
  }

  function applyFilters(raw: OrderRow[]): OrderRow[] {
    const q = search.trim().toLowerCase();
    const min = minTotal.trim() === '' ? null : Number(minTotal);
    const max = maxTotal.trim() === '' ? null : Number(maxTotal);

    const filtered = raw.filter((o) => {
      const st = String(o.status ?? '').toLowerCase();
      const oid = String(o.id ?? '').toLowerCase();
      const onum = String(o.order_number ?? '').toLowerCase();

      // sales gating
      if (!includeNonSales && !isSalesStatus(st)) return false;

      // status filter
      if (statusFilter !== 'all' && st !== String(statusFilter).toLowerCase()) return false;

      // payment method filter
      const pm = normalizePaymentMethod(o.payment_method);
      if (paymentMethodFilter === 'cod' && pm !== 'COD') return false;
      if (paymentMethodFilter === 'bkash' && pm !== 'bKash') return false;
      if (paymentMethodFilter === 'other' && pm !== 'Other') return false;

      // payment status filter
      const ps = normalizePaymentStatus(o.payment_status);
      if (paymentStatusFilter !== 'all' && ps !== paymentStatusFilter) return false;

      // totals filter
      const total = orderRevenue(o);
      if (min !== null && Number.isFinite(min) && total < min) return false;
      if (max !== null && Number.isFinite(max) && total > max) return false;

      // search
      if (q) {
        const hay = `${oid} ${onum} ${st} ${String(o.payment_method ?? '').toLowerCase()} ${String(o.payment_status ?? '').toLowerCase()}`;
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    // sorting (for the orders table + CSV)
    filtered.sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      const ar = orderRevenue(a);
      const br = orderRevenue(b);

      if (sort === 'newest') return bt - at;
      if (sort === 'oldest') return at - bt;
      if (sort === 'highest') return br - ar;
      if (sort === 'lowest') return ar - br;
      return 0;
    });

    return filtered;
  }

  async function computeFromOrders(orders: OrderRow[], start: Date, end: Date) {
    const countedOrderIds = orders.map((o) => o.id);

    // Fetch order_items only for these orders
    let items: ItemRow[] = [];
    if (countedOrderIds.length > 0) {
      const { data: itemData, error: itemErr } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, product_name, quantity, total_price')
        .in('order_id', countedOrderIds);

      if (itemErr) throw itemErr;
      items = (itemData || []) as any;
    }

    // Summary
    const revenue = orders.reduce((sum, o) => sum + orderRevenue(o), 0);
    const ordersCount = orders.length;

    const delivered = orders.filter((o) => ['delivered', 'completed'].includes(String(o.status || '').toLowerCase())).length;

    const codOrders = orders.filter((o) => normalizePaymentMethod(o.payment_method) === 'COD').length;
    const bkashOrders = orders.filter((o) => normalizePaymentMethod(o.payment_method) === 'bKash').length;

    const paidOrders = orders.filter((o) => normalizePaymentStatus(o.payment_status) === 'paid').length;
    const unpaidOrders = orders.filter((o) => ['unpaid', 'pending', 'unknown', 'failed'].includes(normalizePaymentStatus(o.payment_status))).length;

    const itemsSold = items.reduce((sum, it) => sum + safeNumber(it.quantity), 0);
    const avgOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;

    // Breakdown by day
    const days = eachDayOfInterval({ start, end });
    const dayMap: Record<string, BreakdownRow> = {};
    for (const d of days) {
      const key = ymd(d);
      dayMap[key] = { date: key, orders: 0, revenue: 0, itemsSold: 0 };
    }

    for (const o of orders) {
      const key = ymd(new Date(o.created_at));
      if (!dayMap[key]) dayMap[key] = { date: key, orders: 0, revenue: 0, itemsSold: 0 };
      dayMap[key].orders += 1;
      dayMap[key].revenue += orderRevenue(o);
    }

    // Items sold per day (based on the order created_at)
    const orderCreatedAtMap = new Map<string, string>();
    for (const o of orders) orderCreatedAtMap.set(o.id, o.created_at);

    for (const it of items) {
      const createdAt = orderCreatedAtMap.get(it.order_id);
      if (!createdAt) continue;
      const key = ymd(new Date(createdAt));
      if (!dayMap[key]) dayMap[key] = { date: key, orders: 0, revenue: 0, itemsSold: 0 };
      dayMap[key].itemsSold += safeNumber(it.quantity);
    }

    const breakdownRows = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    // Top products
    const prodMap = new Map<string, TopProductRow>();
    for (const it of items) {
      const pid = String(it.product_id || 'unknown');
      const name = String(it.product_name || 'Unknown');
      const qty = safeNumber(it.quantity);
      const rev = safeNumber(it.total_price);

      const prev = prodMap.get(pid) || { product_id: pid, product_name: name, qty: 0, revenue: 0 };
      prev.qty += qty;
      prev.revenue += rev;
      prev.product_name = name;
      prodMap.set(pid, prev);
    }

    const topProducts = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 20);

    // Payment breakdown
    const payMap = new Map<'COD' | 'bKash' | 'Other', PaymentBreakdownRow>();
    for (const o of orders) {
      const pm = normalizePaymentMethod(o.payment_method);
      const prev = payMap.get(pm) || { method: pm, orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += orderRevenue(o);
      payMap.set(pm, prev);
    }
    const paymentBreakdown = Array.from(payMap.values()).sort((a, b) => b.orders - a.orders);

    // Status breakdown
    const stMap = new Map<string, StatusBreakdownRow>();
    for (const o of orders) {
      const st = String(o.status ?? 'unknown').toLowerCase();
      const prev = stMap.get(st) || { status: st, orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += orderRevenue(o);
      stMap.set(st, prev);
    }
    const statusBreakdown = Array.from(stMap.values()).sort((a, b) => b.orders - a.orders);

    // Payment status breakdown
    const psMap = new Map<string, PaymentStatusBreakdownRow>();
    for (const o of orders) {
      const ps = normalizePaymentStatus(o.payment_status);
      const prev = psMap.get(ps) || { status: ps, orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += orderRevenue(o);
      psMap.set(ps, prev);
    }
    const paymentStatusBreakdown = Array.from(psMap.values()).sort((a, b) => b.orders - a.orders);

    return {
      summary: {
        revenue,
        orders: ordersCount,
        itemsSold,
        delivered,
        codOrders,
        bkashOrders,
        paidOrders,
        unpaidOrders,
        avgOrderValue,
      } as Summary,
      breakdown: breakdownRows,
      topProducts,
      paymentBreakdown,
      statusBreakdown,
      paymentStatusBreakdown,
    };
  }

  async function loadReport() {
    setLoading(true);

    try {
      // MONTHLY: if using stored snapshots, try load first
      if (tab === 'monthly' && useStoredMonthly) {
        const monthStart = startOfMonth(new Date(`${monthlyDate}-01`));
        const monthKey = ymd(monthStart);

        const { data: snap, error: snapErr } = await supabase
          .from('monthly_reports')
          .select('*')
          .eq('month', monthKey)
          .maybeSingle();

        if (!snapErr && snap) {
          const metrics = ((snap as any).metrics || {}) as any;

          setSummary({
            revenue: safeNumber(metrics.revenue),
            orders: safeNumber(metrics.orders),
            itemsSold: safeNumber(metrics.itemsSold),
            delivered: safeNumber(metrics.delivered),
            codOrders: safeNumber(metrics.codOrders),
            bkashOrders: safeNumber(metrics.bkashOrders),
            paidOrders: safeNumber(metrics.paidOrders),
            unpaidOrders: safeNumber(metrics.unpaidOrders),
            avgOrderValue: safeNumber(metrics.avgOrderValue),
          });

          setBreakdown(((snap as any).breakdown as any) || []);
          setTopProducts(((snap as any).top_products as any) || []);
          setPaymentBreakdown(((snap as any).payment_breakdown as any) || []);
          setStatusBreakdown(((snap as any).status_breakdown as any) || []);
          setPaymentStatusBreakdown(((snap as any).payment_status_breakdown as any) || []);
          setOrdersInRange(((snap as any).orders as any) || []); // optional if you store them later

          setLoading(false);
          return;
        }
      }

      // Otherwise compute live from orders + order_items
      const { start, end } = getRange(tab, dailyDate, weeklyDate, monthlyDate);
      const rawOrders = await fetchOrders(start, end);

      const filteredOrders = applyFilters(rawOrders);
      setOrdersInRange(filteredOrders);

      const computed = await computeFromOrders(filteredOrders, start, end);

      setSummary(computed.summary);
      setBreakdown(computed.breakdown);
      setTopProducts(computed.topProducts);
      setPaymentBreakdown(computed.paymentBreakdown);
      setStatusBreakdown(computed.statusBreakdown);
      setPaymentStatusBreakdown(computed.paymentStatusBreakdown);
    } catch (e: any) {
      toast({
        title: 'Report Error',
        description: e?.message || 'Failed to load report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function exportCSV() {
    if (!summary) return;

    const lines: string[] = [];
    lines.push(`"${BRAND_NAME} Admin Report"`);
    lines.push(`"Range","${tab}"`);
    lines.push(`"Generated At","${new Date().toISOString()}"`);
    lines.push('');

    lines.push(`"Summary"`);
    lines.push(`"Revenue",${summary.revenue}`);
    lines.push(`"Orders",${summary.orders}`);
    lines.push(`"Items Sold",${summary.itemsSold}`);
    lines.push(`"Delivered",${summary.delivered}`);
    lines.push(`"COD Orders",${summary.codOrders}`);
    lines.push(`"bKash Orders",${summary.bkashOrders}`);
    lines.push(`"Paid Orders",${summary.paidOrders}`);
    lines.push(`"Unpaid Orders",${summary.unpaidOrders}`);
    lines.push(`"Avg Order Value",${summary.avgOrderValue}`);
    lines.push('');

    lines.push(`"Payment Breakdown"`);
    lines.push(`"Method","Orders","Revenue"`);
    for (const r of paymentBreakdown) lines.push(`"${r.method}",${r.orders},${r.revenue}`);
    lines.push('');

    lines.push(`"Status Breakdown"`);
    lines.push(`"Status","Orders","Revenue"`);
    for (const r of statusBreakdown) lines.push(`"${r.status}",${r.orders},${r.revenue}`);
    lines.push('');

    lines.push(`"Payment Status Breakdown"`);
    lines.push(`"PaymentStatus","Orders","Revenue"`);
    for (const r of paymentStatusBreakdown) lines.push(`"${r.status}",${r.orders},${r.revenue}`);
    lines.push('');

    lines.push(`"Breakdown (Daily)"`);
    lines.push(`"Date","Orders","Revenue","ItemsSold"`);
    for (const r of breakdown) lines.push(`"${r.date}",${r.orders},${r.revenue},${r.itemsSold}`);
    lines.push('');

    lines.push(`"Top Products"`);
    lines.push(`"ProductID","ProductName","Qty","Revenue"`);
    for (const p of topProducts) {
      lines.push(`${p.product_id},"${(p.product_name || '').replace(/"/g, '""')}",${p.qty},${p.revenue}`);
    }
    lines.push('');

    // Useful: order-level export too
    lines.push(`"Orders (Filtered)"`);
    lines.push(`"OrderID","OrderNumber","CreatedAt","Status","PaymentMethod","PaymentStatus","Total"`);
    for (const o of ordersInRange) {
      lines.push(
        `"${o.id}","${String(o.order_number ?? '').replace(/"/g, '""')}","${o.created_at}","${String(o.status ?? '').replace(
          /"/g,
          '""'
        )}","${String(o.payment_method ?? '').replace(/"/g, '""')}","${String(o.payment_status ?? '').replace(
          /"/g,
          '""'
        )}",${orderRevenue(o)}`
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `spraxe-report-${tab}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    const el = printRef.current;
    if (!el) return;

    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf()
      .from(el)
      .set({
        margin: 8, // mm
        filename: `spraxe-report-${tab}-${Date.now()}.pdf`,
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .save();
  }

  async function saveMonthlySnapshot() {
    if (tab !== 'monthly') return;
    if (!summary) return;

    const monthStart = startOfMonth(new Date(`${monthlyDate}-01`));
    const monthKey = ymd(monthStart);

    const payload = {
      month: monthKey,
      metrics: summary,
      breakdown,
      top_products: topProducts,
      payment_breakdown: paymentBreakdown,
      status_breakdown: statusBreakdown,
      payment_status_breakdown: paymentStatusBreakdown,
      // optionally store filtered orders too (comment out if you don't want)
      orders: ordersInRange,
    };

    const { error } = await supabase.from('monthly_reports').upsert(payload, { onConflict: 'month' });

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Saved', description: `Monthly report stored for ${monthKey}` });

    const { data } = await supabase
      .from('monthly_reports')
      .select('month')
      .order('month', { ascending: false })
      .limit(24);

    if (data) setMonthlySnapshots(data.map((r: any) => ({ month: String(r.month).slice(0, 10) })));
  }

  const headerTitle = useMemo(() => {
    if (tab === 'daily') return `Daily Report`;
    if (tab === 'weekly') return `Weekly Report`;
    return `Monthly Report`;
  }, [tab]);

  const rangeLabel = useMemo(() => {
    if (tab === 'daily') return dailyDate;
    if (tab === 'weekly') return `Week of ${weeklyDate}`;
    return monthlyDate;
  }, [tab, dailyDate, weeklyDate, monthlyDate]);

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-5">
          <div className="rounded-2xl border bg-white shadow-sm p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="relative h-12 w-12 rounded-2xl border bg-blue-50 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <SafeImage src={LOGO_URL} alt={BRAND_NAME} fill sizes="56px" className="object-cover" crossOrigin="anonymous" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {BRAND_NAME} • {BRAND_TAGLINE}
                  </div>
                  <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Reports</h1>
                  <div className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{headerTitle}</span>
                    <Badge variant="secondary">{rangeLabel}</Badge>
                    <Badge variant="outline" className="bg-white">
                      Filters: {includeNonSales ? 'All statuses' : 'Sales only'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={loadReport} className="gap-2 bg-white">
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </Button>
                <Button variant="outline" onClick={exportCSV} className="gap-2 bg-white">
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button onClick={exportPDF} className="gap-2 bg-blue-900 hover:bg-blue-800">
                  <FileText className="h-4 w-4" /> PDF (A4)
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          {/* Controls */}
          <div className="mt-4">
            <Card className="shadow-sm">
              <CardContent className="p-4 md:p-5 space-y-4">
                {/* Range controls */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    {tab === 'daily' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" /> Date
                        </Label>
                        <input
                          type="date"
                          value={dailyDate}
                          onChange={(e) => setDailyDate(e.target.value)}
                          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                      </div>
                    )}

                    {tab === 'weekly' && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" /> Any day in week
                        </Label>
                        <input
                          type="date"
                          value={weeklyDate}
                          onChange={(e) => setWeeklyDate(e.target.value)}
                          className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                      </div>
                    )}

                    {tab === 'monthly' && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" /> Month
                          </Label>
                          <input
                            type="month"
                            value={monthlyDate}
                            onChange={(e) => setMonthlyDate(e.target.value)}
                            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600/20"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-gray-700 font-semibold">Use stored</Label>
                          <input
                            type="checkbox"
                            checked={useStoredMonthly}
                            onChange={(e) => setUseStoredMonthly(e.target.checked)}
                            className="h-4 w-4"
                          />
                        </div>

                        <Button variant="outline" className="gap-2 bg-white" onClick={saveMonthlySnapshot} disabled={loading || !summary}>
                          <Save className="h-4 w-4" /> Save Snapshot
                        </Button>
                      </div>
                    )}
                  </div>

                  {tab === 'monthly' && monthlySnapshots.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Stored snapshots: {monthlySnapshots[0]?.month} … ({monthlySnapshots.length})
                    </div>
                  )}
                </div>

                <Separator />

                {/* Advanced filters */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-4">
                    <Label className="text-xs font-bold text-gray-600">Search</Label>
                    <div className="relative mt-1">
                      <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Order id / number / payment / status…"
                        className="pl-9 bg-white"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-gray-600">Status</Label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                      <SelectTrigger className="mt-1 bg-white">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-gray-600">Payment Method</Label>
                    <Select value={paymentMethodFilter} onValueChange={(v) => setPaymentMethodFilter(v as any)}>
                      <SelectTrigger className="mt-1 bg-white">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="cod">COD</SelectItem>
                        <SelectItem value="bkash">bKash</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-gray-600">Payment Status</Label>
                    <Select value={paymentStatusFilter} onValueChange={(v) => setPaymentStatusFilter(v as any)}>
                      <SelectTrigger className="mt-1 bg-white">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <Label className="text-xs font-bold text-gray-600">Sort Orders</Label>
                    <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                      <SelectTrigger className="mt-1 bg-white">
                        <SelectValue placeholder="Newest" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="oldest">Oldest</SelectItem>
                        <SelectItem value="highest">Highest Total</SelectItem>
                        <SelectItem value="lowest">Lowest Total</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-3">
                    <Label className="text-xs font-bold text-gray-600">Total Range (৳)</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <Input value={minTotal} onChange={(e) => setMinTotal(e.target.value)} placeholder="Min" inputMode="numeric" className="bg-white" />
                      <Input value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} placeholder="Max" inputMode="numeric" className="bg-white" />
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 bg-white w-full"
                      onClick={() => {
                        setSearch('');
                        setIncludeNonSales(false);
                        setStatusFilter('all');
                        setPaymentMethodFilter('all');
                        setPaymentStatusFilter('all');
                        setMinTotal('');
                        setMaxTotal('');
                        setSort('newest');
                      }}
                    >
                      <Filter className="h-4 w-4" /> Reset filters
                    </Button>
                    <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 h-10">
                      <input
                        type="checkbox"
                        checked={includeNonSales}
                        onChange={(e) => setIncludeNonSales(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-semibold text-gray-700">Include non-sales</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <TabsContent value="daily" className="mt-5">
            <ReportBody
              loading={loading}
              summary={summary}
              breakdown={breakdown}
              topProducts={topProducts}
              paymentBreakdown={paymentBreakdown}
              statusBreakdown={statusBreakdown}
              paymentStatusBreakdown={paymentStatusBreakdown}
              orders={ordersInRange}
              printRef={printRef}
              headerTitle={headerTitle}
              rangeLabel={rangeLabel}
            />
          </TabsContent>

          <TabsContent value="weekly" className="mt-5">
            <ReportBody
              loading={loading}
              summary={summary}
              breakdown={breakdown}
              topProducts={topProducts}
              paymentBreakdown={paymentBreakdown}
              statusBreakdown={statusBreakdown}
              paymentStatusBreakdown={paymentStatusBreakdown}
              orders={ordersInRange}
              printRef={printRef}
              headerTitle={headerTitle}
              rangeLabel={rangeLabel}
            />
          </TabsContent>

          <TabsContent value="monthly" className="mt-5">
            <ReportBody
              loading={loading}
              summary={summary}
              breakdown={breakdown}
              topProducts={topProducts}
              paymentBreakdown={paymentBreakdown}
              statusBreakdown={statusBreakdown}
              paymentStatusBreakdown={paymentStatusBreakdown}
              orders={ordersInRange}
              printRef={printRef}
              headerTitle={headerTitle}
              rangeLabel={rangeLabel}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReportBody({
  loading,
  summary,
  breakdown,
  topProducts,
  paymentBreakdown,
  statusBreakdown,
  paymentStatusBreakdown,
  orders,
  printRef,
  headerTitle,
  rangeLabel,
}: {
  loading: boolean;
  summary: Summary | null;
  breakdown: BreakdownRow[];
  topProducts: TopProductRow[];
  paymentBreakdown: PaymentBreakdownRow[];
  statusBreakdown: StatusBreakdownRow[];
  paymentStatusBreakdown: PaymentStatusBreakdownRow[];
  orders: OrderRow[];
  printRef: React.RefObject<HTMLDivElement>;
  headerTitle: string;
  rangeLabel: string;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-7 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-40 mb-3" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-40 mb-3" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Print/PDF styles */}
      <style>{`
        /* A4-friendly spacing when exported */
        .pdf-page {
          background: #fff;
        }
        .pdf-header {
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
          border:1px solid #e5e7eb;
          border-radius:16px;
          padding:16px;
          background: linear-gradient(180deg, rgba(30,58,138,.06), rgba(255,255,255,0));
        }
        .pdf-footer {
          margin-top: 12px;
          border-top:1px solid #e5e7eb;
          padding-top:10px;
          color:#64748b;
          font-size:11px;
          display:flex;
          justify-content:space-between;
          gap:10px;
          flex-wrap:wrap;
        }
      `}</style>

      {/* PDF/Print Header */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="pdf-header">
            <div className="flex items-start gap-12">
              <div className="flex items-start gap-12">
                <div className="flex items-start gap-12">
                  <div className="flex items-start gap-12">
                    <div className="flex items-start gap-12">
                      <div className="flex items-start gap-12">
                        <div className="flex items-start gap-12">
                          <div className="flex items-start gap-12">
                            <div className="flex items-start gap-12">
                              <div className="flex items-start gap-12">
                                <div className="flex items-start gap-12">
                                  <div className="flex items-start gap-12">
                                    <div className="flex items-start gap-12">
                                      <div className="flex items-start gap-12">
                                        <div className="flex items-start gap-12">
                                          <div className="flex items-start gap-12">
                                            <div className="flex items-start gap-12">
                                              <div className="flex items-start gap-12">
                                                <div className="flex items-start gap-12">
                                                  <div className="flex items-start gap-12">
                                                    <div className="flex items-start gap-12">
                                                      <div className="flex items-start gap-12">
                                                        <div className="flex items-start gap-12">
                                                          <div className="relative h-14 w-14 rounded-2xl border bg-blue-50 overflow-hidden flex items-center justify-center">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <SafeImage
                                                              src={LOGO_URL}
                                                              alt={BRAND_NAME}
                                                              fill
                                                              sizes="56px"
                                                              className="object-cover"
                                                              crossOrigin="anonymous"
                                                            />
                                                          </div>
                                                          <div>
                                                            <div className="text-xs font-bold text-blue-900">{BRAND_NAME}</div>
                                                            <div className="text-xl font-extrabold text-gray-900">{headerTitle}</div>
                                                            <div className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                                                              <Badge variant="secondary">{rangeLabel}</Badge>
                                                              <Badge variant="outline" className="bg-white">
                                                                Generated: {new Date().toLocaleString()}
                                                              </Badge>
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-2">
                                                              {BRAND_ADDR} • {BRAND_PHONE}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-500">Report ID</div>
              <div className="font-extrabold text-gray-900">{`RPT-${Date.now()}`}</div>
              <div className="text-xs text-gray-500 mt-2">Currency</div>
              <div className="font-bold text-blue-900">BDT (৳)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard icon={<TrendingUp className="h-4 w-4 text-gray-500" />} title="Revenue" value={summary ? bdt(summary.revenue) : '—'} />
        <MetricCard icon={<Package className="h-4 w-4 text-gray-500" />} title="Orders" value={summary ? String(summary.orders) : '—'} />
        <MetricCard icon={<BadgeCheck className="h-4 w-4 text-gray-500" />} title="Delivered" value={summary ? String(summary.delivered) : '—'} />
        <MetricCard icon={<Banknote className="h-4 w-4 text-gray-500" />} title="COD Orders" value={summary ? String(summary.codOrders) : '—'} />
        <MetricCard icon={<CreditCard className="h-4 w-4 text-gray-500" />} title="bKash Orders" value={summary ? String(summary.bkashOrders) : '—'} />
        <MetricCard icon={<TrendingUp className="h-4 w-4 text-gray-500" />} title="Avg Order" value={summary ? bdt(summary.avgOrderValue) : '—'} />
      </div>

      {/* Payment + Status insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="font-extrabold text-gray-900 mb-2">Payment Methods</div>
            <Separator className="mb-3" />
            {paymentBreakdown.length === 0 ? (
              <div className="text-sm text-gray-600">No data.</div>
            ) : (
              <div className="space-y-2">
                {paymentBreakdown.map((r) => {
                  const meta = paymentMeta(r.method);
                  const Icon = meta.Icon;
                  return (
                    <div key={r.method} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`border ${meta.cls} inline-flex items-center gap-1.5`}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-gray-500">{r.orders} orders</span>
                      </div>
                      <div className="font-extrabold text-blue-900">{bdt(r.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="font-extrabold text-gray-900 mb-2">Payment Status</div>
            <Separator className="mb-3" />
            {paymentStatusBreakdown.length === 0 ? (
              <div className="text-sm text-gray-600">No data.</div>
            ) : (
              <div className="space-y-2">
                {paymentStatusBreakdown.map((r) => {
                  const meta = payStatusMeta(r.status);
                  const Icon = meta.Icon;
                  return (
                    <div key={r.status} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`border ${meta.cls} inline-flex items-center gap-1.5`}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-gray-500">{r.orders} orders</span>
                      </div>
                      <div className="font-extrabold text-blue-900">{bdt(r.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="font-extrabold text-gray-900 mb-2">Order Status</div>
            <Separator className="mb-3" />
            {statusBreakdown.length === 0 ? (
              <div className="text-sm text-gray-600">No data.</div>
            ) : (
              <div className="space-y-2">
                {statusBreakdown.slice(0, 8).map((r) => {
                  const meta = statusMeta(r.status);
                  return (
                    <div key={r.status} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
                      <Badge className={`border ${meta.cls}`}>{meta.label}</Badge>
                      <div className="text-xs text-gray-500">{r.orders} orders</div>
                      <div className="font-extrabold text-blue-900">{bdt(r.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="font-extrabold text-gray-900 mb-2">Daily Breakdown</div>
          <Separator className="mb-3" />
          {breakdown.length === 0 ? (
            <div className="text-sm text-gray-600">No data for this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Orders</th>
                    <th className="py-2 pr-3">Revenue</th>
                    <th className="py-2 pr-3">Items Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((r) => (
                    <tr key={r.date} className="border-t">
                      <td className="py-2 pr-3 font-semibold text-gray-900">{r.date}</td>
                      <td className="py-2 pr-3">{r.orders}</td>
                      <td className="py-2 pr-3 font-semibold text-blue-900">{bdt(r.revenue)}</td>
                      <td className="py-2 pr-3">{r.itemsSold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders list (with payment type COD/bKash) */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="font-extrabold text-gray-900 mb-2">Orders in Range</div>
          <Separator className="mb-3" />
          {orders.length === 0 ? (
            <div className="text-sm text-gray-600">No orders matched the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Payment</th>
                    <th className="py-2 pr-3">Pay Status</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 250).map((o) => {
                    const st = statusMeta(o.status);
                    const pm = paymentMeta(o.payment_method);
                    const ps = payStatusMeta(o.payment_status);
                    const PMIcon = pm.Icon;
                    const PSIcon = ps.Icon;
                    const label = o.order_number || `#${String(o.id).slice(0, 8).toUpperCase()}`;

                    return (
                      <tr key={o.id} className="border-t hover:bg-gray-50/60">
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-gray-900">{label}</div>
                          <div className="text-xs text-gray-500">ID: {String(o.id).slice(0, 12)}…</div>
                        </td>
                        <td className="py-2 pr-3 text-gray-700">{new Date(o.created_at).toLocaleString()}</td>
                        <td className="py-2 pr-3">
                          <Badge className={`border ${st.cls}`}>{st.label}</Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge className={`border ${pm.cls} inline-flex items-center gap-1.5`}>
                            <PMIcon className="h-3.5 w-3.5" />
                            {pm.label}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge className={`border ${ps.cls} inline-flex items-center gap-1.5`}>
                            <PSIcon className="h-3.5 w-3.5" />
                            {ps.label}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-right font-extrabold text-blue-900">{bdt(orderRevenue(o))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {orders.length > 250 && (
                <div className="text-xs text-gray-500 mt-3">
                  Showing first 250 orders for performance. Use filters to narrow down.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top products */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="font-extrabold text-gray-900 mb-2">Top Products</div>
          <Separator className="mb-3" />
          {topProducts.length === 0 ? (
            <div className="text-sm text-gray-600">No top products yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.product_id} className="border-t">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-gray-900">{p.product_name}</div>
                        <div className="text-xs text-gray-500">{p.product_id}</div>
                      </td>
                      <td className="py-2 pr-3 font-semibold">{p.qty}</td>
                      <td className="py-2 pr-3 font-semibold text-blue-900">{bdt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer for PDF */}
      <div className="pdf-footer">
        <div>
          <b style={{ color: '#0f172a' }}>{BRAND_NAME}</b> • Internal use only
        </div>
        <div>
          Generated at: <b style={{ color: '#0f172a' }}>{new Date().toLocaleString()}</b>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-gray-500">{title}</div>
          {icon}
        </div>
        <div className="text-lg md:text-xl font-extrabold text-gray-900 mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
