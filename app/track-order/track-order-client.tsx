'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrustBadges } from '@/components/ui/trust-badges';
import { OrderStatusTimeline } from '@/components/ui/order-status-timeline';
import { useToast } from '@/hooks/use-toast';
import { PackageSearch, ArrowLeft, Loader2 } from 'lucide-react';

type TrackResult = {
  order_id?: string | null;
  order_number: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivery_location: string | null;
  total: number | null;
  total_amount: number | null;
  shipping_cost: number | null;
  notes?: string | null;
  items: Array<{ product_name: string; quantity: number }>;
};

function fmtDate(v?: string | null) {
  if (!v) return '';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function statusColor(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (['delivered', 'completed'].includes(s)) return 'bg-emerald-600 hover:bg-emerald-600';
  if (['shipped'].includes(s)) return 'bg-blue-700 hover:bg-blue-700';
  if (['processing'].includes(s)) return 'bg-amber-600 hover:bg-amber-600';
  if (['cancelled', 'canceled', 'refunded'].includes(s)) return 'bg-red-600 hover:bg-red-600';
  return 'bg-gray-700 hover:bg-gray-700';
}

export default function TrackOrderClient({
  initialOrderNumber,
  initialContact,
  showSuccessToast,
}: {
  initialOrderNumber?: string;
  initialContact?: string;
  showSuccessToast?: boolean;
}) {
  const { toast } = useToast();

  const [orderNumber, setOrderNumber] = useState(initialOrderNumber || '');
  const [contact, setContact] = useState(initialContact || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);

  useEffect(() => {
    if (showSuccessToast) {
      toast({
        title: 'Order placed successfully',
        description: 'Use the details below to track your order anytime.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = useMemo(() => {
    return orderNumber.trim().length >= 4 && contact.trim().length >= 6;
  }, [orderNumber, contact]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/track-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), contact: contact.trim() }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        toast({
          title: 'Not found',
          description: 'No order matched those details. Double-check the order number and phone/email.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setResult(json.order as TrackResult);
      toast({ title: 'Order found', description: 'Showing your latest status.' });
    } catch {
      toast({ title: 'Error', description: 'Could not check order status. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Track your order</h1>
          <p className="text-sm text-gray-600 mt-1">
            Enter your <span className="font-semibold">Order Number</span> and the <span className="font-semibold">phone/email</span>{' '}
            used for the order.
          </p>
        </div>

        <Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to shop
        </Link>
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b">
          <CardTitle className="text-base text-gray-900 flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-blue-900" />
            Order lookup
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderNumber">Order Number</Label>
                <Input
                  id="orderNumber"
                  placeholder="e.g. 2025-000123"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Phone or Email</Label>
                <Input
                  id="contact"
                  placeholder="Phone or email used on the order"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!canSubmit || loading} className="bg-blue-900 hover:bg-blue-800">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…
                  </>
                ) : (
                  'Track order'
                )}
              </Button>

              <div className="text-xs text-gray-500">Tip: copy the order number from your invoice or confirmation message.</div>
            </div>
          </form>

          <Separator />
          <TrustBadges />
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6 border-gray-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-gray-900">Order #{result.order_number}</CardTitle>
                <div className="text-xs text-gray-500 mt-1">Placed: {fmtDate(result.created_at)}</div>
              </div>

              <Badge className={statusColor(result.status) + ' text-white rounded-full px-3 py-1'}>
                {(result.status || 'pending').toString().toUpperCase()}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <OrderStatusTimeline
              status={result.status}
              createdAt={result.created_at}
              shippedAt={result.shipped_at}
              deliveredAt={result.delivered_at}
            />

            <div className="flex flex-wrap items-center gap-2">
              {result.order_id && (
                <Link href={`/invoice/${result.order_id}`} className="inline-flex">
                  <Button variant="outline" size="sm" className="bg-white">
                    View invoice
                  </Button>
                </Link>
              )}
              <Link href="/support" className="inline-flex">
                <Button variant="outline" size="sm" className="bg-white">
                  Need help?
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border bg-gray-50/60 p-4">
                <div className="text-xs text-gray-500">Payment</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {result.payment_method || '—'} • {result.payment_status || '—'}
                </div>
              </div>

              <div className="rounded-xl border bg-gray-50/60 p-4">
                <div className="text-xs text-gray-500">Delivery</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{result.delivery_location || '—'}</div>
                {result.tracking_number && <div className="text-xs text-gray-600 mt-1">Tracking: {result.tracking_number}</div>}
                {result.notes && <div className="text-xs text-gray-600 mt-1">{result.notes}</div>}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="text-sm font-extrabold text-gray-900 mb-2">Items</div>
              <div className="space-y-2">
                {result.items?.length ? (
                  result.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                      <div className="text-gray-800 truncate">{it.product_name}</div>
                      <div className="font-semibold text-gray-900">× {it.quantity}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-600">—</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border bg-white p-4">
                <div className="text-xs text-gray-500">Last updated</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{fmtDate(result.updated_at) || '—'}</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{typeof result.total_amount === 'number' ? result.total_amount.toFixed(2) : '—'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
