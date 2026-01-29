'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Package,
  Eye,
  Phone,
  Mail,
  User,
  Calendar,
  Search,
  TrendingUp,
  ShoppingBag,
  Clock,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  size?: string | null;
  color_name?: string | null;
}

interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: string;

  // ✅ Guest orders store customer_name directly on orders
  customer_name?: string | null;

  total: number;
  total_amount: number;
  created_at: string;
  contact_number: string;

  payment_method: string | null;
  payment_status: string | null;

  // ✅ FIX: use payment_trx_id (matches your orders table + query)
  payment_trx_id: string | null;

  profiles: {
    full_name: string;
    email: string;
    phone: string;
  } | null;

  order_items: OrderItem[];
}

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

const fmtBDT = (n: number) => `৳${(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 0 })}`;

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const statusMeta = (status: string) => {
  switch (status) {
    case 'pending':
      return { label: 'Pending', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    case 'processing':
      return { label: 'Processing', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'shipped':
      return { label: 'Shipped', cls: 'bg-purple-100 text-purple-800 border-purple-200' };
    case 'delivered':
      return { label: 'Delivered', cls: 'bg-green-100 text-green-800 border-green-200' };
    case 'cancelled':
      return { label: 'Cancelled', cls: 'bg-red-100 text-red-800 border-red-200' };
    default:
      return { label: status, cls: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

function BkashLogo({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#E2136E" />
      <path
        d="M8.2 15.8V8.2h2.6c2.1 0 3.2 1 3.2 2.4 0 1-.6 1.7-1.5 2 1.1.3 1.8 1.1 1.8 2.2 0 1.6-1.2 3-3.7 3H8.2Zm2-4.5h.8c.9 0 1.4-.4 1.4-1 0-.6-.5-1-1.4-1h-.8v2Zm0 3h1c1.1 0 1.6-.5 1.6-1.2s-.5-1.2-1.6-1.2h-1v2.4Z"
        fill="#fff"
      />
    </svg>
  );
}

function normalizePaymentMethod(method: string | null | undefined) {
  const m = String(method || '').toLowerCase();
  if (!m) return 'unknown';
  if (m.includes('bkash')) return 'bkash';
  if (m.includes('cash') || m.includes('cod')) return 'cod';
  return 'other';
}

function PaymentBlock({
  method,
  paymentStatus,
  trxId,
}: {
  method: string | null;
  paymentStatus: string | null;
  trxId: string | null;
}) {
  const kind = normalizePaymentMethod(method);
  const paid = String(paymentStatus || '').toLowerCase() === 'paid';

  if (kind === 'bkash') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center gap-2">
          <Badge className="bg-pink-50 text-pink-700 border border-pink-200">
            <BkashLogo className="h-4 w-4" />
            bKash
          </Badge>
          <Badge
            className={
              paid
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }
          >
            {paid ? 'Paid' : 'Pending'}
          </Badge>
        </div>

        {trxId ? (
          <div className="text-[11px] text-gray-600">
            TRX ID: <span className="font-semibold text-gray-900">{trxId}</span>
          </div>
        ) : (
          <div className="text-[11px] text-gray-500 italic">TRX ID not provided</div>
        )}
      </div>
    );
  }

  if (kind === 'cod') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center gap-2">
          <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
            <Banknote className="h-4 w-4" />
            COD
          </Badge>
          <Badge className="bg-gray-50 text-gray-600 border border-gray-200">Cash</Badge>
        </div>
        <div className="text-[11px] text-gray-500">Cash on Delivery</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Badge className="bg-gray-50 text-gray-700 border border-gray-200">
        <CreditCard className="h-4 w-4" />
        {method || 'Unknown'}
      </Badge>
      <div className="text-[11px] text-gray-500">
        Status: <span className="font-semibold">{paymentStatus || '—'}</span>
      </div>
    </div>
  );
}

export default function OrdersManagement() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, filter]);

  const fetchOrders = async () => {
    setLoading(true);

    let query = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        user_id,
        status,
        customer_name,
        total,
        total_amount,
        created_at,
        contact_number,
        payment_method,
        payment_status,
        payment_trx_id,
        profiles ( full_name, email, phone ),
        order_items ( id, product_name, quantity, size, color_name )
      `
      )
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;

    if (error) {
      console.error('Supabase Fetch Error:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch orders: ${error.message}`,
        variant: 'destructive',
      });
    } else {
      setOrders((data ?? []) as any);
    }

    setLoading(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: string, customerEmail?: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'Order status updated' });
    fetchOrders();

    if (newStatus === 'processing' && customerEmail) {
      toast({ title: 'Sending Email...', description: 'Generating invoice...' });
      try {
        await fetch('/api/send-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, email: customerEmail }),
        });
        toast({ title: 'Email Sent', description: `Invoice sent to ${customerEmail}` });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (!q) return true;
      const orderNo = (o.order_number || o.id).toLowerCase();
      const name = (o.profiles?.full_name || o.customer_name || '').toLowerCase();
      const email = (o.profiles?.email || '').toLowerCase();
      const phone = (o.contact_number || o.profiles?.phone || '').toLowerCase();
      const pay = String(o.payment_method || '').toLowerCase();

      // ✅ FIX: search by payment_trx_id
      const trx = String(o.payment_trx_id || '').toLowerCase();

      return (
        orderNo.includes(q) ||
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        pay.includes(q) ||
        trx.includes(q)
      );
    });

    list.sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      const aTotal = Number(a.total || a.total_amount || 0);
      const bTotal = Number(b.total || b.total_amount || 0);

      if (sort === 'newest') return bt - at;
      if (sort === 'oldest') return at - bt;
      if (sort === 'highest') return bTotal - aTotal;
      if (sort === 'lowest') return aTotal - bTotal;
      return 0;
    });

    return list;
  }, [orders, search, sort]);

  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const revenue = orders.reduce((sum, o) => sum + Number(o.total || o.total_amount || 0), 0);
    const pending = orders.filter((o) => o.status === 'pending').length;
    const processing = orders.filter((o) => o.status === 'processing').length;
    return { totalOrders, revenue, pending, processing };
  }, [orders]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        {/* Header row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="h-9">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track orders, update statuses, view invoices, and see payment details.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, customer, email, phone, trx..."
                className="pl-9 bg-white"
              />
            </div>

            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-52 bg-white">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="w-full sm:w-44 bg-white">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="highest">Highest Total</SelectItem>
                <SelectItem value="lowest">Lowest Total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-sm border-l-4 border-l-blue-600">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Orders</p>
                <h3 className="text-2xl font-bold text-gray-900">{kpis.totalOrders}</h3>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-600 opacity-20" />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-green-600">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900">{fmtBDT(kpis.revenue)}</h3>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 opacity-20" />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-yellow-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <h3 className="text-2xl font-bold text-gray-900">{kpis.pending}</h3>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-20" />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-purple-600">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Processing</p>
                <h3 className="text-2xl font-bold text-gray-900">{kpis.processing}</h3>
              </div>
              <Package className="h-8 w-8 text-purple-600 opacity-20" />
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b px-6 py-4">
            <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Orders <span className="text-gray-400 font-normal">({filtered.length})</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white rounded-md border animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-900">No orders found</p>
                <p className="text-sm text-gray-500 mt-1">Try changing filters or search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 font-medium w-[16%]">Order</th>
                      <th className="px-6 py-3 font-medium w-[22%]">Customer</th>
                      <th className="px-6 py-3 font-medium w-[26%]">Items</th>
                      <th className="px-6 py-3 font-medium w-[14%] text-right">Total</th>
                      <th className="px-6 py-3 font-medium w-[22%] text-right">Payment</th>
                      <th className="px-6 py-3 font-medium w-[18%] text-right">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filtered.map((order) => {
                      const meta = statusMeta(order.status);
                      const orderLabel = order.order_number || order.id.slice(0, 8).toUpperCase();
                      const total = Number(order.total || order.total_amount || 0);
                      const customerName = order.profiles?.full_name || order.customer_name || 'Guest User';
                      const email = order.profiles?.email || 'N/A';
                      const phone = order.contact_number || order.profiles?.phone || 'N/A';

                      return (
                        <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                          {/* Order */}
                          <td className="px-6 py-4 align-top">
                            <div className="font-semibold text-gray-900">{orderLabel}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(order.created_at).toLocaleDateString()}</span>
                              <span className="text-gray-300">•</span>
                              <span>{timeAgo(order.created_at)}</span>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="px-6 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                                {(customerName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 flex items-center gap-2">
                                  <User className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="truncate">{customerName}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="truncate max-w-[260px]">{email}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="truncate">{phone}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Items */}
                          <td className="px-6 py-4 align-top">
                            {order.order_items && order.order_items.length > 0 ? (
                              <div className="space-y-1">
                                {order.order_items.slice(0, 3).map((item) => {
                                  const meta = [
                                    item.color_name ? `Color: ${item.color_name}` : null,
                                    item.size ? `Size: ${item.size}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' • ');
                                  return (
                                    <div key={item.id} className="flex items-start gap-2 text-sm">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
                                      <div>
                                        <div className="font-medium text-gray-800">{item.product_name}</div>
                                        <div className="text-gray-500 text-xs">
                                          x{item.quantity}
                                          {meta ? ` • ${meta}` : ''}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {order.order_items.length > 3 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    + {order.order_items.length - 3} more items
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No items found</span>
                            )}
                          </td>

                          {/* Total */}
                          <td className="px-6 py-4 align-top text-right">
                            <div className="font-bold text-blue-900">{fmtBDT(total)}</div>
                          </td>

                          {/* Payment */}
                          <td className="px-6 py-4 align-top text-right">
                            <PaymentBlock
                              method={order.payment_method}
                              paymentStatus={order.payment_status}
                              // ✅ FIX: pass payment_trx_id
                              trxId={order.payment_trx_id}
                            />
                          </td>

                          {/* Status + actions */}
                          <td className="px-6 py-4 align-top text-right">
                            <div className="flex flex-col gap-2 items-end">
                              <Select
                                value={order.status}
                                onValueChange={(value) => handleStatusChange(order.id, value, order.profiles?.email)}
                              >
                                <SelectTrigger
                                  className={`w-[150px] h-9 text-xs font-semibold border capitalize ${meta.cls}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="processing">Processing</SelectItem>
                                  <SelectItem value="shipped">Shipped</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>

                              <div className="flex gap-2">
                                <Link href={`/invoice/${order.id}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 text-xs hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                                    Invoice
                                  </Button>
                                </Link>

                                <Badge variant="outline" className="h-9 px-3 flex items-center">
                                  {meta.label}
                                </Badge>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
