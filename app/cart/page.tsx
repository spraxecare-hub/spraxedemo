'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { useCart } from '@/lib/cart/cart-context';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SIZE_OPTIONS, parseSizeChart } from '@/lib/utils/size-chart';
import {
  Trash2,
  AlertCircle,
  ShoppingBag,
  Minus,
  Plus,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SHIPPING_INSIDE_DHAKA = 60;
const SHIPPING_OUTSIDE_DHAKA = 120;
const BKASH_NUMBER = '01XXXXXXXXX';

const isClothingCategory = (name?: string | null, slug?: string | null) => {
  const hay = `${name || ''} ${slug || ''}`.toLowerCase();
  const isGender = /\b(men|mens|man|mans|women|womens|woman|female|male)\b/i.test(hay);
  const isClothing = /\b(cloth|clothing|apparel|fashion|wear)\b/i.test(hay);
  return isGender && isClothing;
};

const fmtBDT = (n: number) => `৳${(n || 0).toLocaleString('en-BD')}`;

function normalizePhone(raw: string) {
  const digits = (raw || '').replace(/\D+/g, '');
  if (digits.startsWith('8801') && digits.length >= 13) return '0' + digits.slice(2, 13);
  if (digits.startsWith('01') && digits.length >= 11) return digits.slice(0, 11);
  return digits;
}

function isValidBDPhone(raw: string) {
  return /^01\d{9}$/.test(normalizePhone(raw));
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 rounded bg-gray-100 animate-pulse ${className}`} />;
}

const EMPTY_ADDRESS_PLACEHOLDER = 'N/A';

export default function CartPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const { items, removeItem, updateQuantity, updateItemSize, subtotal, clearCart, loading: cartLoading } = useCart();
  const router = useRouter();
  const { toast } = useToast();

  const [deliveryLocation, setDeliveryLocation] = useState<'inside' | 'outside'>('inside');

  // Shipping speed selection removed (always standard)
  const shippingSpeed: 'standard' = 'standard';

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash'>('cod');
  const [trxId, setTrxId] = useState('');

  // ✅ Guest checkout (saved locally for next time)
  const [guestFullName, setGuestFullName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [orderNote, setOrderNote] = useState('');

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  useEffect(() => {
    if (user) refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user) return;
    try {
      const raw = localStorage.getItem('guest_checkout');
      if (!raw) return;
      const saved = JSON.parse(raw || '{}');
      setGuestFullName(saved.full_name || '');
      setGuestPhone(saved.phone || '');
      setGuestAddress(saved.address || '');
    } catch {
      // ignore
    }
  }, [user]);

  const baseShipping = deliveryLocation === 'inside' ? SHIPPING_INSIDE_DHAKA : SHIPPING_OUTSIDE_DHAKA;
  const shippingCost = baseShipping;
  const total = Math.max(0, subtotal) + shippingCost;

  const hasPhone = !!profile?.phone;
  // @ts-ignore
  const hasAddress = !!profile?.address;
  const isProfileComplete = hasPhone && hasAddress;

  const guestNameOk = !!guestFullName.trim();
  const guestPhoneOk = isValidBDPhone(guestPhone);
  const guestAddressOk = !!guestAddress.trim();
  const isGuestComplete = guestNameOk && guestPhoneOk && guestAddressOk;

  const cartCount = items.length;
  const missingSize = items.some(
    (item) =>
      isClothingCategory(item.product?.category_name, item.product?.category_slug) && !String(item.size || '').trim()
  );

  const trxOk = paymentMethod !== 'bkash' || !!trxId.trim();
  const canCheckout =
    cartCount > 0 && !isPlacingOrder && !missingSize && trxOk && (user ? isProfileComplete : isGuestComplete);
  const infoReady = user ? isProfileComplete : isGuestComplete;

  const handleConfirmOrder = async () => {
    if (missingSize) {
      toast({
        title: 'Size required',
        description: 'Please select a size for each clothing item before placing the order.',
        variant: 'destructive',
      });
      return;
    }

    if (paymentMethod === 'bkash' && !trxId.trim()) {
      toast({
        title: 'TRX ID required',
        description: 'Please enter your bKash transaction (TRX) ID to confirm the order.',
        variant: 'destructive',
      });
      return;
    }

    // ✅ Validate required info
    if (user) {
      const finalPhone = profile?.phone;
      // @ts-ignore
      const finalAddress = profile?.address;

      if (!finalPhone) {
        toast({
          title: 'Phone Missing',
          description: 'Please add your phone number in your Profile.',
          variant: 'destructive',
        });
        return;
      }
      if (!finalAddress) {
        toast({
          title: 'Address Missing',
          description: 'Please add your address in your Profile.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (!guestFullName.trim()) {
        toast({
          title: 'Name missing',
          description: 'Please enter your full name to place the order.',
          variant: 'destructive',
        });
        return;
      }
      if (!guestPhoneOk) {
        toast({
          title: 'Invalid phone',
          description: 'Please enter a valid Bangladesh phone number (e.g. 01XXXXXXXXX).',
          variant: 'destructive',
        });
        return;
      }
      if (!guestAddress.trim()) {
        toast({
          title: 'Address missing',
          description: 'Please enter your delivery address.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsPlacingOrder(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      const payload = {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, size: i.size ?? null })),
        deliveryLocation,
        shippingSpeed,
        paymentMethod,
        trxId: paymentMethod === 'bkash' ? trxId.trim() : null,
        guest: user
          ? null
          : {
              full_name: guestFullName.trim(),
              phone: normalizePhone(guestPhone),
              division: EMPTY_ADDRESS_PLACEHOLDER,
              district: EMPTY_ADDRESS_PLACEHOLDER,
              city: EMPTY_ADDRESS_PLACEHOLDER,
              road: guestAddress.trim(),
              zip_code: '',
              address: guestAddress.trim(),
            },
      };

      const res = await fetch('/api/place-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'Order failed');

      // Save guest details for next time
      if (!user) {
        try {
          localStorage.setItem(
            'guest_checkout',
            JSON.stringify({
              full_name: guestFullName.trim(),
              phone: normalizePhone(guestPhone),
              address: guestAddress.trim(),
            })
          );
        } catch {}
      }

      await clearCart();

      // Trigger Invoice Email (non-blocking) for signed-in users
      if (user?.email && json?.orderId) {
        fetch('/api/send-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: json.orderId, email: user.email }),
        }).catch(() => {});
      }

      toast({ title: 'Order Confirmed!', description: `Order #${json.orderNumber} placed successfully.` });

      if (user) {
        router.push('/dashboard');
      } else {
        router.push(
          `/track-order?orderNumber=${encodeURIComponent(String(json.orderNumber || ''))}&contact=${encodeURIComponent(
            normalizePhone(guestPhone)
          )}&success=1`
        );
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Order Failed', description: error?.message || 'Order failed', variant: 'destructive' });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const cartItemsPanel = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-white border flex items-center justify-center shadow-sm">
            <ShoppingBag className="h-4 w-4 text-blue-900" />
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {cartCount} item{cartCount > 1 ? 's' : ''} in cart
          </div>
        </div>
        <Button
          variant="ghost"
          className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => clearCart()}
        >
          Clear cart
        </Button>
      </div>

      {/* Cart Items Card */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-base text-gray-900">Items (আইটেম)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y lg:max-h-[520px] lg:overflow-y-auto">
            {items.map((item) => {
              const price = Number(item.product?.price || 0);
              const lineTotal = price * item.quantity;
              const colorName = String(item.product?.color_name || '').trim();
              const isClothing = isClothingCategory(item.product?.category_name, item.product?.category_slug);
              const sizeChart = parseSizeChart((item.product as any)?.size_chart);
              const sizeOptions = Array.from(
                new Set(sizeChart.length ? sizeChart.map((entry) => entry.size) : DEFAULT_SIZE_OPTIONS)
              );
              const selectedSizeDetails = sizeChart.find((entry) => entry.size === item.size);

              return (
                <div key={item.id} className="p-4 sm:p-5">
                  <div className="flex gap-4">
                    <div className="relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      {item.product?.images?.[0] ? (
                        <SafeImage
                          src={item.product.images[0]}
                          alt={item.product.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{item.product?.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Unit price: <span className="font-medium text-gray-700">{fmtBDT(price)}</span>
                          </div>
                          {colorName && (
                            <div className="mt-1 inline-flex items-center gap-2 text-xs text-gray-600">
                              <span className="h-2.5 w-2.5 rounded-full border" style={item.product?.color_hex ? { backgroundColor: item.product.color_hex } : undefined} />
                              Color: <span className="font-semibold text-gray-800">{colorName}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">{fmtBDT(lineTotal)}</div>
                          <div className="text-xs text-gray-500">Line total</div>
                        </div>
                      </div>

                      {isClothing && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-gray-700">Size</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {sizeOptions.map((size) => {
                              const active = item.size === size;
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => updateItemSize(item.id, size)}
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                    active
                                      ? 'border-blue-700 bg-blue-50 text-blue-900'
                                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                  }`}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                          {!item.size && (
                            <div className="mt-1 text-xs text-red-600">Select a size to continue checkout (চেকআউটের জন্য সাইজ দিন)।</div>
                          )}
                          {item.size && (
                            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-gray-700">
                              <div className="font-semibold text-blue-900">Measurements for {item.size}</div>
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

                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Quantity control */}
                        <div className="inline-flex items-center rounded-lg border bg-white shadow-sm overflow-hidden">
                          <button
                            className="h-9 w-10 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="h-9 min-w-[44px] px-3 flex items-center justify-center text-sm font-semibold text-gray-900 border-x">
                            {item.quantity}
                          </div>
                          <button
                            className="h-9 w-10 flex items-center justify-center hover:bg-gray-50"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove (সরান)
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );


  if (authLoading || cartLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md px-6">
            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <SkeletonLine className="w-40" />
                  <div className="h-8 w-8 rounded-full border border-gray-200 bg-white animate-pulse" />
                </div>
                <SkeletonLine className="w-2/3" />
                <div className="space-y-3 pt-2">
                  <div className="flex gap-3">
                    <div className="h-16 w-16 rounded-md border bg-white animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <SkeletonLine className="w-3/4" />
                      <SkeletonLine className="w-1/2" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-16 w-16 rounded-md border bg-white animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <SkeletonLine className="w-2/3" />
                      <SkeletonLine className="w-1/3" />
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <div className="h-10 rounded-md bg-gray-100 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-10 flex-1">
        {items.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-blue-900" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Your cart is empty (কার্ট খালি)</h2>
              <p className="text-sm text-gray-600">Browse products and add items to continue to checkout (পণ্য যোগ করে চেকআউট করুন)।</p>
              <div className="flex justify-center gap-2">
                <Link href="/products">
                  <Button className="bg-blue-900 hover:bg-blue-800">Start Shopping (শপিং শুরু করুন)</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">Back to Home (হোমে ফিরে যান)</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
            <Card className="shadow-sm border-gray-200 overflow-hidden">
              <CardHeader className="bg-white border-b">
                <CardTitle className="text-xl font-semibold text-gray-900">অর্ডার করতে নিচের তথ্যগুলি দিন</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {missingSize && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Size required</AlertTitle>
                    <AlertDescription className="text-xs">
                      Select a size for each clothing item before placing the order.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-gray-900">নাম</Label>
                    {user && (
                      <Link href="/dashboard" className="text-xs text-blue-700 hover:underline">
                        Edit
                      </Link>
                    )}
                  </div>
                  {user ? (
                    <Input value={profile?.full_name || ''} readOnly className="bg-gray-50" placeholder="আপনার নাম" />
                  ) : (
                    <Input
                      value={guestFullName}
                      onChange={(e) => setGuestFullName(e.target.value)}
                      placeholder="আপনার নাম"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-gray-900">মোবাইল নাম্বার</Label>
                    {user && (
                      <Link href="/dashboard" className="text-xs text-blue-700 hover:underline">
                        Edit
                      </Link>
                    )}
                  </div>
                  {user ? (
                    <Input value={profile?.phone || ''} readOnly className="bg-gray-50" placeholder="01XXXXXXXXX" />
                  ) : (
                    <Input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      inputMode="tel"
                    />
                  )}
                  {!user && !guestPhoneOk && guestPhone.trim() && (
                    <div className="text-xs text-red-600">Enter a valid BD phone (01XXXXXXXXX).</div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-gray-900">ঠিকানা</Label>
                    {user && (
                      <Link href="/dashboard" className="text-xs text-blue-700 hover:underline">
                        Edit
                      </Link>
                    )}
                  </div>
                  {user ? (
                    <Textarea
                      value={(profile as any)?.address || ''}
                      readOnly
                      rows={3}
                      className="bg-gray-50"
                      placeholder="আপনার বাসার সম্পূর্ণ ঠিকানা"
                    />
                  ) : (
                    <Textarea
                      value={guestAddress}
                      onChange={(e) => setGuestAddress(e.target.value)}
                      rows={3}
                      placeholder="আপনার বাসার সম্পূর্ণ ঠিকানা"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-900">অর্ডার নোট</Label>
                  <Textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    rows={2}
                    placeholder="স্পেশাল কিছু বলতে চাইলে লিখুন (অপশনাল)"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold text-gray-900">ডেলিভারি এলাকা</Label>
                  <RadioGroup
                    value={deliveryLocation}
                    onValueChange={(val: 'inside' | 'outside') => setDeliveryLocation(val)}
                    className="grid gap-3"
                  >
                    <div
                      onClick={() => setDeliveryLocation('inside')}
                      className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer ${
                        deliveryLocation === 'inside' ? 'border-emerald-500 bg-emerald-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="inside" id="inside" />
                        <Label htmlFor="inside" className="cursor-pointer font-semibold text-gray-900">
                          ঢাকা সিটির ভিতরে
                        </Label>
                      </div>
                      <div className="text-lg font-bold text-gray-900">{fmtBDT(SHIPPING_INSIDE_DHAKA)}</div>
                    </div>

                    <div
                      onClick={() => setDeliveryLocation('outside')}
                      className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer ${
                        deliveryLocation === 'outside' ? 'border-emerald-500 bg-emerald-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="outside" id="outside" />
                        <Label htmlFor="outside" className="cursor-pointer font-semibold text-gray-900">
                          ঢাকা সিটির বাইরে
                        </Label>
                      </div>
                      <div className="text-lg font-bold text-gray-900">{fmtBDT(SHIPPING_OUTSIDE_DHAKA)}</div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold text-gray-900">পেমেন্ট পদ্ধতি</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(val: 'cod' | 'bkash') => setPaymentMethod(val)}
                    className="grid gap-3"
                  >
                    <div
                      onClick={() => setPaymentMethod('cod')}
                      className={`flex flex-col gap-2 rounded-xl border p-4 cursor-pointer ${
                        paymentMethod === 'cod' ? 'border-emerald-500 bg-emerald-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="cod" id="cod" />
                          <Label htmlFor="cod" className="cursor-pointer font-semibold text-gray-900">
                            ক্যাশ অন ডেলিভারি (COD)
                          </Label>
                        </div>
                        <span className="text-sm text-gray-600">পণ্য হাতে পেয়ে পরিশোধ</span>
                      </div>
                      {paymentMethod === 'cod' && (
                        <div className="text-sm text-gray-700">
                          ডেলিভারি ম্যানের কাছে পণ্য দেখে টাকা প্রদান করুন।
                        </div>
                      )}
                    </div>

                    <div
                      onClick={() => setPaymentMethod('bkash')}
                      className={`flex flex-col gap-3 rounded-xl border p-4 cursor-pointer ${
                        paymentMethod === 'bkash' ? 'border-emerald-500 bg-emerald-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="bkash" id="bkash" />
                          <Label htmlFor="bkash" className="cursor-pointer font-semibold text-gray-900">
                            বিকাশ
                          </Label>
                        </div>
                        <span className="text-sm text-gray-600">আগে পেমেন্ট করুন</span>
                      </div>
                      {paymentMethod === 'bkash' && (
                        <div className="space-y-3 rounded-lg border border-emerald-100 bg-white p-3">
                          <div className="text-sm font-semibold text-gray-900">
                            এই নম্বরে টাকা পাঠান: <span className="font-bold">{BKASH_NUMBER}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            টাকা পাঠানোর পর আপনার বিকাশ TRX ID লিখুন।
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-900">TRX ID</Label>
                            <Input
                              value={trxId}
                              onChange={(e) => setTrxId(e.target.value)}
                              placeholder="Transaction ID দিন"
                            />
                            {!trxOk && (
                              <div className="text-xs text-red-600">TRX ID দিন যাতে আপনার পেমেন্ট যাচাই করা যায়।</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">{fmtBDT(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="font-semibold">{fmtBDT(shippingCost)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>{fmtBDT(total)}</span>
                  </div>
                </div>

                {!infoReady && (
                  <div className="text-xs text-red-600">Please fill in name, phone, and address to continue.</div>
                )}
                {paymentMethod === 'bkash' && !trxOk && (
                  <div className="text-xs text-red-600">Please provide the bKash TRX ID to continue.</div>
                )}

                <Button
                  className="w-full bg-blue-900 hover:bg-blue-800 h-11 text-base"
                  onClick={handleConfirmOrder}
                  disabled={!canCheckout}
                >
                  {isPlacingOrder ? 'Processing...' : 'Confirm Order'}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
              {cartItemsPanel}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
