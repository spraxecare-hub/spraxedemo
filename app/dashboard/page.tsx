'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Order } from '@/lib/supabase/types';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShoppingBag,
  User,
  MapPin,
  Package,
  FileText,
  Pencil,
  Save,
  X,
  Phone,
  Home,
  ShieldCheck,
  Sparkles,
  Calendar,
  Receipt,
  Truck,
  Search,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// --- BANGLADESH LOCATION DATA ---
const BD_DIVISIONS = ['Barisal', 'Chittagong', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet'];

const BD_DISTRICTS: Record<string, string[]> = {
  Barisal: ['Barguna', 'Barisal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'],
  Chittagong: [
    'Bandarban',
    'Brahmanbaria',
    'Chandpur',
    'Chittagong',
    'Comilla',
    "Cox's Bazar",
    'Feni',
    'Khagrachhari',
    'Lakshmipur',
    'Noakhali',
    'Rangamati',
  ],
  Dhaka: [
    'Dhaka',
    'Faridpur',
    'Gazipur',
    'Gopalganj',
    'Kishoreganj',
    'Madaripur',
    'Manikganj',
    'Munshiganj',
    'Narayanganj',
    'Narsingdi',
    'Rajbari',
    'Shariatpur',
    'Tangail',
  ],
  Khulna: ['Bagerhat', 'Chuadanga', 'Jessore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
  Mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
  Rajshahi: ['Bogra', 'Chapainawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
  Rangpur: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  Sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
};

type TabKey = 'orders' | 'profile' | 'addresses';

const fmtBDT = (n: number) => `৳${(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 0 })}`;

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getStatusMeta = (status: string) => {
  const s = (status || '').toLowerCase();
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200', label: 'Pending' },
    confirmed: { cls: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'Confirmed' },
    processing: { cls: 'bg-purple-100 text-purple-800 border border-purple-200', label: 'Processing' },
    shipped: { cls: 'bg-indigo-100 text-indigo-800 border border-indigo-200', label: 'Shipped' },
    delivered: { cls: 'bg-green-100 text-green-800 border border-green-200', label: 'Delivered' },
    cancelled: { cls: 'bg-red-100 text-red-800 border border-red-200', label: 'Cancelled' },
  };
  return map[s] || { cls: 'bg-gray-100 text-gray-800 border border-gray-200', label: s || 'Unknown' };
};

// ✅ Payment meta helper (COD / bKash)
const getPaymentMeta = (method: any) => {
  const m = String(method ?? '').trim().toLowerCase();
  if (m.includes('bkash')) {
    return {
      label: 'bKash',
      Icon: CreditCard,
      cls: 'bg-pink-50 text-pink-700 border border-pink-200',
    };
  }
  // default
  return {
    label: 'Cash on Delivery',
    Icon: Banknote,
    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };
};

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 rounded bg-gray-100 animate-pulse ${className}`} />;
}

// Bangladesh mobile validation (common strict pattern):
// - 11 digits
// - starts with 01
// - operator digit 3-9
const isValidBDPhone = (phone: string) => /^01[3-9]\d{8}$/.test(phone);

export default function DashboardPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const router = useRouter();

const [search, setSearch] = useState<string>('');

// Keep query string in sync without relying on Next's /* searchParams_removed */ hook
// (which can cause prerender to deopt into full client-side rendering).
useEffect(() => {
  const update = () => setSearch(window.location.search || '');
  update();

  window.addEventListener('popstate', update);

const originalPushState = window.history.pushState.bind(window.history);
const originalReplaceState = window.history.replaceState.bind(window.history);

window.history.pushState = (...args: Parameters<History["pushState"]>) => {
  const ret = originalPushState(...args);
  update();
  return ret;
};

window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
  const ret = originalReplaceState(...args);
  update();
  return ret;
};


  return () => {
    window.removeEventListener('popstate', update);
    window.history.pushState = originalPushState as any;
    window.history.replaceState = originalReplaceState as any;
  };
}, []);
  const pathname = usePathname();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Filters
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');

  // Phone Editing State
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  // Address Editing State
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Structured Address State
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [road, setRoad] = useState('');
  const [zipCode, setZipCode] = useState('');

  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const p = (profile || {}) as any;
  const hasPhone = !!p.phone;
  const hasAddress = !!p.address;

  const setUrlParams = (updates: Record<string, string | null>) => {
    const sp = new URLSearchParams((search || '').replace(/^\?/, ''));
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    });
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const goToTab = (tab: TabKey, edit?: 'phone' | 'address') => {
    setActiveTab(tab);

    if (edit === 'phone') {
      setIsEditingPhone(true);
      setIsEditingAddress(false);
      setUrlParams({ tab: 'profile', edit: 'phone' });
      return;
    }
    if (edit === 'address') {
      setIsEditingAddress(true);
      setIsEditingPhone(false);
      setUrlParams({ tab: 'addresses', edit: 'address' });
      return;
    }

    setIsEditingPhone(false);
    setIsEditingAddress(false);
    setUrlParams({ tab, edit: null });
  };

  const fetchOrders = async () => {
    if (!user) return;
    setLoadingOrders(true);

    // ✅ Include payment_method so customer can see it
    const { data, error } = await supabase
      .from('orders')
      .select('*') // your Order type likely matches this already
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Could not load orders', description: error.message, variant: 'destructive' });
    } else {
      setOrders((data || []) as Order[]);
    }

    setLoadingOrders(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Sync inputs with profile data
  useEffect(() => {
    if (!profile) return;

    if (profile.phone) setPhoneInput(profile.phone);

    const pp = profile as any;
    setDivision(pp.division || '');
    setDistrict(pp.district || '');
    setCity(pp.city || '');
    setRoad(pp.road || '');
    setZipCode(pp.zip_code || '');
  }, [profile]);

  // URL-driven tab + edit modes
  useEffect(() => {
    const tab = (new URLSearchParams(search).get('tab') || 'orders') as TabKey;
    const edit = new URLSearchParams(search).get('edit'); // phone | address | null

    const validTab: TabKey = tab === 'orders' || tab === 'profile' || tab === 'addresses' ? tab : 'orders';

    if (edit === 'phone') {
      setActiveTab('profile');
      setIsEditingPhone(true);
      setIsEditingAddress(false);
      return;
    }

    if (edit === 'address') {
      setActiveTab('addresses');
      setIsEditingAddress(true);
      setIsEditingPhone(false);
      return;
    }

    setActiveTab(validTab);
  }, [search]);

  // Auto-focus phone input
  useEffect(() => {
    if (activeTab === 'profile' && isEditingPhone) {
      setTimeout(() => phoneInputRef.current?.focus(), 50);
    }
  }, [activeTab, isEditingPhone]);

  const handleSavePhone = async () => {
    if (!user) return;
    const cleaned = phoneInput.replace(/\s+/g, '').trim();

    if (!isValidBDPhone(cleaned)) {
      toast({
        title: 'Invalid Phone',
        description: 'Enter a valid BD number (e.g. 017XXXXXXXX). Must be 11 digits and start with 01.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('profiles').update({ phone: cleaned }).eq('id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update phone', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Phone updated' });
      await refreshProfile();
      setIsEditingPhone(false);
      setUrlParams({ edit: null });
    }
    setIsSaving(false);
  };

  const handleSaveAddress = async () => {
    if (!user) return;

    if (!division || !district || !city || !road) {
      toast({ title: 'Missing Fields', description: 'Please fill all required address fields.', variant: 'destructive' });
      return;
    }

    if (zipCode && !/^\d{4}$/.test(zipCode.trim())) {
      toast({ title: 'Invalid Zip Code', description: 'Zip code should be 4 digits (e.g. 1230).', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const fullAddress = `${road}, ${city}, ${zipCode ? zipCode + ', ' : ''}${district}, ${division}`;

    const updates = {
      division,
      district,
      city,
      road,
      zip_code: zipCode,
      address: fullAddress,
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update address', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Address updated successfully' });
      await refreshProfile();
      setIsEditingAddress(false);
      setUrlParams({ edit: null });
    }
    setIsSaving(false);
  };

  // Loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6">
          <Card className="w-full max-w-md shadow-sm">
            <CardContent className="p-6 space-y-4">
              <SkeletonLine className="w-40" />
              <SkeletonLine className="w-2/3" />
              <div className="space-y-3 pt-2">
                <SkeletonLine />
                <SkeletonLine className="w-5/6" />
                <SkeletonLine className="w-3/4" />
              </div>
              <div className="h-10 rounded bg-gray-100 animate-pulse" />
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const statusOptions = useMemo(() => {
    const set = new Set<string>((orders || []).map((o) => (o.status || '').toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (orders || []).filter((o) => {
      const oid = String(o.id || '').toLowerCase();
      const num = String((o as any).order_number || '').toLowerCase();
      const st = String(o.status || '').toLowerCase();
      const pm = String((o as any).payment_method || '').toLowerCase();

      const matchesQuery = !q || oid.includes(q) || num.includes(q) || pm.includes(q);
      const matchesStatus = statusFilter === 'all' || st === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [orders, query, statusFilter]);

  const totalSpend = useMemo(() => {
    return (orders || []).reduce((sum, o) => sum + (Number((o as any).total) || 0), 0);
  }, [orders]);

  const missingCount = Number(!hasPhone) + Number(!hasAddress);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      {/* Top band */}
      <div className="bg-gradient-to-b from-blue-50/70 to-transparent">
        <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 pt-8 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900">
                <ShieldCheck className="h-4 w-4" />
                My Dashboard
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 border">
                  <Sparkles className="h-3 w-3 text-blue-900" />
                  Account & Orders
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-600">
                Manage orders, update phone, and save your delivery address for faster checkout.
              </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
              <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
                <div className="text-xs text-gray-500">Orders</div>
                <div className="text-lg font-bold text-gray-900">{orders.length}</div>
              </div>
              <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
                <div className="text-xs text-gray-500">Total spend</div>
                <div className="text-lg font-bold text-blue-900">{fmtBDT(totalSpend)}</div>
              </div>
            </div>
          </div>

          {/* Profile completion banner */}
          {missingCount > 0 && (
            <div className="mt-4">
              <Alert className="bg-white">
                <AlertTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Complete your profile
                </AlertTitle>
                <AlertDescription className="text-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-gray-600">
                    {!hasPhone && !hasAddress && 'Add a phone number and address to avoid checkout issues.'}
                    {!hasPhone && hasAddress && 'Add a phone number for delivery confirmation.'}
                    {hasPhone && !hasAddress && 'Add an address to deliver your orders.'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!hasPhone && (
                      <Button size="sm" className="bg-blue-900 hover:bg-blue-800" onClick={() => goToTab('profile', 'phone')}>
                        <Phone className="h-4 w-4 mr-2" /> Add phone
                      </Button>
                    )}
                    {!hasAddress && (
                      <Button size="sm" variant="outline" className="bg-white" onClick={() => goToTab('addresses', 'address')}>
                        <MapPin className="h-4 w-4 mr-2" /> Add address
                      </Button>
                    )}
                    <Link href="/cart">
                      <Button size="sm" variant="outline" className="bg-white" disabled={!hasPhone || !hasAddress}>
                        Go to checkout <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 pb-10 flex-1">
        <Tabs value={activeTab} onValueChange={(v) => goToTab(v as TabKey)} className="space-y-6">
          {/* Tabs */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="orders" className="gap-2">
                <ShoppingBag className="w-4 h-4" />
                Orders
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-2">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="addresses" className="gap-2">
                <MapPin className="w-4 h-4" />
                Address
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Link href="/products">
                <Button variant="outline" className="h-9 bg-white">
                  Continue Shopping <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* ORDERS TAB */}
          <TabsContent value="orders">
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-white">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">My Orders</CardTitle>
                    <CardDescription>Track your latest purchases, payment method, and download invoices.</CardDescription>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-[260px]">
                      <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by order id / number / payment"
                        className="pl-9 bg-white"
                      />
                    </div>

                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                      <SelectTrigger className="bg-white w-full sm:w-[200px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button variant="outline" className="bg-white" onClick={fetchOrders}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loadingOrders ? (
                  <div className="p-6 space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="rounded-xl border bg-white p-4">
                        <div className="flex items-center justify-between">
                          <SkeletonLine className="w-44" />
                          <SkeletonLine className="w-24" />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <SkeletonLine className="w-32" />
                          <SkeletonLine className="w-28" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No orders found</h3>
                    <p className="text-sm text-gray-600 mb-5">
                      {orders.length === 0 ? 'You have not placed any orders yet.' : 'Try changing the search or status filter.'}
                    </p>
                    <Link href="/products">
                      <Button className="bg-blue-900 hover:bg-blue-800">Browse Products</Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left">Order</th>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-left">Payment</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y bg-white">
                          {filteredOrders.map((order) => {
                            const meta = getStatusMeta(order.status);
                            const orderId = String(order.id || '');
                            const orderLabel = (order as any).order_number || (orderId ? `#${orderId.slice(0, 8)}` : '—');
                            const pay = getPaymentMeta((order as any).payment_method);
                            const PayIcon = pay.Icon;

                            return (
                              <tr key={orderId} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  <div className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4 text-gray-400" />
                                    <span className="truncate">{orderLabel}</span>
                                  </div>
                                  {orderId && <div className="text-xs text-gray-500 mt-0.5">ID: {orderId.slice(0, 12)}…</div>}
                                </td>

                                <td className="px-4 py-3 text-gray-700">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    <div>
                                      <div>{new Date(order.created_at).toLocaleDateString()}</div>
                                      <div className="text-xs text-gray-500">{timeAgo(order.created_at)}</div>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-4 py-3">
                                  <Badge className={meta.cls}>{meta.label}</Badge>
                                </td>

                                {/* ✅ Payment column */}
                                <td className="px-4 py-3">
                                  <Badge className={`${pay.cls} inline-flex items-center gap-1.5`}>
                                    <PayIcon className="h-3.5 w-3.5" />
                                    {pay.label}
                                  </Badge>
                                </td>

                                <td className="px-4 py-3 text-right font-bold text-blue-900">
                                  {fmtBDT(Number((order as any).total || 0))}
                                </td>

                                <td className="px-4 py-3 text-right">
                                  <Link href={`/invoice/${orderId}`}>
                                    <Button variant="outline" size="sm" className="gap-2 bg-white">
                                      <FileText className="w-4 h-4" />
                                      Invoice
                                    </Button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y bg-white">
                      {filteredOrders.map((order) => {
                        const meta = getStatusMeta(order.status);
                        const orderId = String(order.id || '');
                        const orderLabel = (order as any).order_number || (orderId ? `#${orderId.slice(0, 8)}` : '—');
                        const pay = getPaymentMeta((order as any).payment_method);
                        const PayIcon = pay.Icon;

                        return (
                          <div key={orderId} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{orderLabel}</div>

                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                                  <span className="text-gray-300">•</span>
                                  <span>{timeAgo(order.created_at)}</span>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Badge className={meta.cls}>{meta.label}</Badge>
                                  <Badge className={`${pay.cls} inline-flex items-center gap-1.5`}>
                                    <PayIcon className="h-3.5 w-3.5" />
                                    {pay.label}
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <div className="font-extrabold text-blue-900">{fmtBDT(Number((order as any).total || 0))}</div>
                                <Link href={`/invoice/${orderId}`}>
                                  <Button variant="outline" size="sm" className="gap-2 bg-white">
                                    <FileText className="w-4 h-4" />
                                    Invoice
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROFILE TAB */}
          <TabsContent value="profile">
            {/* unchanged below */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader className="border-b bg-white">
                  <CardTitle className="text-base">Profile Information</CardTitle>
                  <CardDescription>Manage your personal details for faster checkout.</CardDescription>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl border bg-white p-4">
                      <div className="text-xs text-gray-500">Full Name</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">{p?.full_name || 'N/A'}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-4">
                      <div className="text-xs text-gray-500">Email</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">{user?.email}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded-xl border bg-gray-50/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="flex items-center gap-2 text-gray-700 font-semibold">
                        <Phone className="h-4 w-4" /> Contact Phone
                      </Label>
                      {!isEditingPhone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => goToTab('profile', 'phone')}
                          className="text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>

                    {isEditingPhone ? (
                      <div className="flex flex-col gap-2 max-w-md">
                        <Input
                          ref={phoneInputRef}
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          className="bg-white"
                          inputMode="numeric"
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleSavePhone} disabled={isSaving} size="sm" className="bg-blue-900 hover:bg-blue-800">
                            {isSaving ? 'Saving...' : <Save className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingPhone(false);
                              setPhoneInput(p?.phone || '');
                              setUrlParams({ edit: null });
                            }}
                            disabled={isSaving}
                            className="bg-white"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-gray-500">
                          Use an active number for delivery confirmation. Example: <span className="font-semibold">017XXXXXXXX</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className={`text-base font-semibold ${!hasPhone ? 'text-red-600' : 'text-gray-900'}`}>
                          {p?.phone || 'No phone number added'}
                        </div>
                        {!hasPhone && <Badge className="bg-red-50 text-red-700 border border-red-200">Required</Badge>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-blue-100">
                <CardHeader className="border-b bg-white">
                  <CardTitle className="text-base">Account checklist</CardTitle>
                  <CardDescription>Complete these to checkout faster.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Phone className="h-4 w-4 text-gray-500" /> Phone
                    </div>
                    <Badge className={hasPhone ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}>
                      {hasPhone ? 'Done' : 'Missing'}
                    </Badge>
                  </div>

                  {!hasPhone && (
                    <Button variant="outline" className="w-full bg-white" onClick={() => goToTab('profile', 'phone')}>
                      Add phone now
                    </Button>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Home className="h-4 w-4 text-gray-500" /> Address
                    </div>
                    <Badge className={hasAddress ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}>
                      {hasAddress ? 'Done' : 'Missing'}
                    </Badge>
                  </div>

                  {!hasAddress && (
                    <Button variant="outline" className="w-full bg-white" onClick={() => goToTab('addresses', 'address')}>
                      Add address now
                    </Button>
                  )}

                  <Separator />

                  <div className="text-sm text-gray-600">Tip: Keep your details updated to avoid delivery delays.</div>

                  <Link href="/cart">
                    <Button className="w-full bg-blue-900 hover:bg-blue-800" disabled={!hasPhone || !hasAddress}>
                      Go to Checkout
                    </Button>
                  </Link>

                  {hasPhone && hasAddress && (
                    <div className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Your account is ready for checkout.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ADDRESSES TAB */}
          <TabsContent value="addresses">
            {/* unchanged below */}
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-white">
                <CardTitle className="text-base">Saved Address</CardTitle>
                <CardDescription>This address will be pre-filled during checkout.</CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <div className="max-w-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Home className="h-4 w-4" /> Default Delivery Address
                    </Label>
                    {!isEditingAddress && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => goToTab('addresses', 'address')}
                        className="text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                      >
                        <Pencil className="w-3 h-3 mr-1" /> {p?.address ? 'Edit Address' : 'Add Address'}
                      </Button>
                    )}
                  </div>

                  {isEditingAddress ? (
                    <div className="space-y-4 rounded-xl border bg-gray-50/60 p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Division *</Label>
                          <Select
                            value={division}
                            onValueChange={(val) => {
                              setDivision(val);
                              setDistrict('');
                            }}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select Division" />
                            </SelectTrigger>
                            <SelectContent>
                              {BD_DIVISIONS.map((div) => (
                                <SelectItem key={div} value={div}>
                                  {div}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>District *</Label>
                          <Select value={district} onValueChange={setDistrict} disabled={!division}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder={division ? 'Select District' : 'Select division first'} />
                            </SelectTrigger>
                            <SelectContent>
                              {division &&
                                BD_DISTRICTS[division]?.map((dist) => (
                                  <SelectItem key={dist} value={dist}>
                                    {dist}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>City / Area *</Label>
                          <Input placeholder="e.g. Uttara" value={city} onChange={(e) => setCity(e.target.value)} className="bg-white" />
                        </div>
                        <div className="space-y-2">
                          <Label>Zip Code</Label>
                          <Input placeholder="e.g. 1230" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="bg-white" inputMode="numeric" />
                          <div className="text-[11px] text-gray-500">Optional. Use 4 digits.</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Road / House No / Details *</Label>
                        <Input
                          placeholder="e.g. House 12, Road 5, Sector 4"
                          value={road}
                          onChange={(e) => setRoad(e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button onClick={handleSaveAddress} disabled={isSaving} className="bg-blue-900 hover:bg-blue-800">
                          {isSaving ? 'Saving...' : 'Save Address'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingAddress(false);
                            setUrlParams({ edit: null });
                          }}
                          disabled={isSaving}
                          className="bg-white"
                        >
                          Cancel
                        </Button>
                        <div className="text-xs text-gray-500 sm:ml-auto sm:text-right sm:self-center">
                          Make sure the address is complete for courier delivery.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-xl border p-5 ${p?.address ? 'bg-gray-50/60 border-gray-200' : 'bg-yellow-50 border-yellow-200 border-dashed'}`}>
                      {p?.address ? (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">{p.address}</div>

                          {(p?.division || p?.district || p?.city || p?.road) && (
                            <>
                              <Separator />
                              <div className="text-xs text-gray-600">
                                <span className="font-semibold text-gray-700">Details:</span> {[p.road, p.city, p.district, p.division].filter(Boolean).join(', ')}
                              </div>
                            </>
                          )}

                          <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                            <Truck className="h-3.5 w-3.5" />
                            Used for checkout and delivery label.
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-700">
                          <div className="mx-auto h-12 w-12 rounded-full bg-white border flex items-center justify-center mb-3">
                            <MapPin className="h-6 w-6 text-yellow-700" />
                          </div>
                          <div className="font-semibold">No address saved</div>
                          <div className="text-sm text-gray-600 mt-1">Add an address to speed up checkout.</div>
                          <Button variant="outline" className="mt-4 bg-white" onClick={() => goToTab('addresses', 'address')}>
                            Add Address
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {(!hasPhone || !hasAddress) && (
                    <Alert className="mt-5">
                      <AlertTitle>Complete your profile</AlertTitle>
                      <AlertDescription className="text-xs">
                        {!hasPhone && !hasAddress && 'Add phone and address to avoid checkout issues.'}
                        {!hasPhone && hasAddress && 'Add a phone number for delivery confirmation.'}
                        {hasPhone && !hasAddress && 'Add an address to deliver your orders.'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
}