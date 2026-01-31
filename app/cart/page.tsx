'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { useCart } from '@/lib/cart/cart-context';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SIZE_OPTIONS, parseSizeChart } from '@/lib/utils/size-chart';
import {
  Trash2,
  Phone,
  MapPin,
  Truck,
  Home,
  AlertCircle,
  ExternalLink,
  ShoppingBag,
  ShieldCheck,
  CreditCard,
  Minus,
  Plus,
  User,
  Sparkles,
  Banknote,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SHIPPING_INSIDE_DHAKA = 60;
const SHIPPING_OUTSIDE_DHAKA = 120;

// ✅ Change this to your real bKash merchant/personal number
const BKASH_NUMBER = '01XXXXXXXXX';

// ✅ Put your bKash logo here: /public/payments/bkash.svg
const BKASH_LOGO_PATH = '/payments/bkash.svg';

const isClothingCategory = (name?: string | null, slug?: string | null) => {
  const hay = `${name || ''} ${slug || ''}`.toLowerCase();
  const isGender = /\b(men|mens|man|mans|women|womens|woman|female|male)\b/i.test(hay);
  const isClothing = /\b(cloth|clothing|apparel|fashion|wear)\b/i.test(hay);
  return isGender && isClothing;
};

type VoucherRow = {
  code: string;
  discount_type: string | null;
  discount_value: number | null;
  min_purchase: number | null;
  max_uses: number | null;
  current_uses: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean | null;
};

const fmtBDT = (n: number) => `৳${(n || 0).toLocaleString('en-BD')}`;

function addDays(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function formatEtaRange(minDays: number, maxDays: number) {
  const now = new Date();
  const a = addDays(now, Math.max(0, minDays));
  const b = addDays(now, Math.max(0, maxDays));
  const fmt = (x: Date) =>
    x.toLocaleDateString('en-BD', {
      month: 'short',
      day: '2-digit',
    });
  if (minDays === maxDays) return `${fmt(a)}`;
  return `${fmt(a)} – ${fmt(b)}`;
}

function getDeliveryEstimate(location: 'inside' | 'outside') {
  // Standard delivery estimates (shipping speed selection removed)
  if (location === 'inside') return { minDays: 1, maxDays: 2, label: '1–2 days delivery (Dhaka)' };
  return { minDays: 3, maxDays: 5, label: '3–5 days delivery (Outside Dhaka)' };
}

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

function StepPill({
  active,
  title,
  icon,
}: {
  active?: boolean;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-600'
      }`}
    >
      <span className={`${active ? 'text-blue-900' : 'text-gray-500'}`}>{icon}</span>
      {title}
    </div>
  );
}

function PaymentOption({
  active,
  title,
  subtitle,
  left,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  left: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-3 cursor-pointer transition-all ${
        active ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 pointer-events-none">
          {children}
          <div className="flex items-center gap-2">
            {left}
            <div>
              <div className="font-semibold text-gray-900 leading-4">{title}</div>
              <div className="text-xs text-gray-600">{subtitle}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const { items, removeItem, updateQuantity, updateItemSize, subtotal, clearCart, loading: cartLoading } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [deliveryLocation, setDeliveryLocation] = useState<'inside' | 'outside'>('inside');

  // Shipping speed selection removed (always standard)
  const shippingSpeed: 'standard' = 'standard';

  // ✅ Payment
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash'>('cod');
  const [trxId, setTrxId] = useState('');

  // ✅ Guest checkout (saved locally for next time)
  const [guestFullName, setGuestFullName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestDivision, setGuestDivision] = useState('');
  const [guestDistrict, setGuestDistrict] = useState('');
  const [guestCity, setGuestCity] = useState('');
  const [guestRoad, setGuestRoad] = useState('');
  const [guestZipCode, setGuestZipCode] = useState('');

  // Voucher
  const [voucherInput, setVoucherInput] = useState('');
  const [voucher, setVoucher] = useState<VoucherRow | null>(null);
  const [voucherMsg, setVoucherMsg] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (searchParams?.get('checkout') === '1') {
      setCheckoutStep(1);
    }
  }, [searchParams]);

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
      setGuestDivision(saved.division || '');
      setGuestDistrict(saved.district || '');
      setGuestCity(saved.city || '');
      setGuestRoad(saved.road || '');
      setGuestZipCode(saved.zip_code || '');
    } catch {
      // ignore
    }
  }, [user]);

  // Restore voucher input (does not auto-apply)
  useEffect(() => {
    try {
      const c = localStorage.getItem('voucher_code');
      if (c) setVoucherInput(c);
    } catch {}
  }, []);

  const baseShipping = deliveryLocation === 'inside' ? SHIPPING_INSIDE_DHAKA : SHIPPING_OUTSIDE_DHAKA;
  const shippingCost = baseShipping;

  const eta = getDeliveryEstimate(deliveryLocation);
  const etaRange = formatEtaRange(eta.minDays, eta.maxDays);

  const voucherDiscount = (() => {
    if (!voucher) return 0;
    if (!voucher.is_active) return 0;
    const now = new Date();
    if (voucher.valid_from && now < new Date(voucher.valid_from)) return 0;
    if (voucher.valid_until && now > new Date(voucher.valid_until)) return 0;
    const min = Number(voucher.min_purchase || 0);
    if (min > 0 && subtotal < min) return 0;
    const maxUses = Number(voucher.max_uses || 0);
    const used = Number(voucher.current_uses || 0);
    if (maxUses > 0 && used >= maxUses) return 0;

    const t = String(voucher.discount_type || '').toLowerCase();
    const val = Number(voucher.discount_value || 0);
    if (val <= 0) return 0;

    let d = 0;
    if (t === 'percentage' || t === 'percent') d = (subtotal * val) / 100;
    else d = val;

    d = Math.max(0, Math.min(subtotal, d));
    return Math.round(d);
  })();

  const total = Math.max(0, subtotal - voucherDiscount) + shippingCost;

  const hasPhone = !!profile?.phone;
  // @ts-ignore
  const hasAddress = !!profile?.address;
  const isProfileComplete = hasPhone && hasAddress;

  const guestNameOk = !!guestFullName.trim();
  const guestPhoneOk = isValidBDPhone(guestPhone);
  const guestZipOk = !guestZipCode.trim() || /^\d{4}$/.test(guestZipCode.trim());
  const guestAddressOk = !!guestDivision.trim() && !!guestDistrict.trim() && !!guestCity.trim() && !!guestRoad.trim();
  const guestAddress = `${guestRoad.trim()}, ${guestCity.trim()}, ${guestZipCode.trim() ? guestZipCode.trim() + ', ' : ''}${guestDistrict.trim()}, ${guestDivision.trim()}`;
  const isGuestComplete = guestNameOk && guestPhoneOk && guestAddressOk && guestZipOk;

  const cartCount = items.length;
  const missingSize = items.some(
    (item) =>
      isClothingCategory(item.product?.category_name, item.product?.category_slug) && !String(item.size || '').trim()
  );

  const trxOk = paymentMethod !== 'bkash' || !!trxId.trim();
  const canCheckout =
    cartCount > 0 && !isPlacingOrder && trxOk && !missingSize && (user ? isProfileComplete : isGuestComplete);
  const infoReady = user ? isProfileComplete : isGuestComplete;

  const applyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucher(null);
      setVoucherMsg('');
      try {
        localStorage.removeItem('voucher_code');
      } catch {}
      return;
    }

    setVoucherLoading(true);
    setVoucherMsg('');

    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('code,discount_type,discount_value,min_purchase,max_uses,current_uses,valid_from,valid_until,is_active')
        .eq('code', code)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setVoucher(null);
        setVoucherMsg('Invalid voucher code.');
        return;
      }

      // validate
      const now = new Date();
      if (!data.is_active) {
        setVoucher(null);
        setVoucherMsg('Voucher is inactive.');
        return;
      }
      if (data.valid_from && now < new Date(data.valid_from)) {
        setVoucher(null);
        setVoucherMsg('Voucher is not active yet.');
        return;
      }
      if (data.valid_until && now > new Date(data.valid_until)) {
        setVoucher(null);
        setVoucherMsg('Voucher has expired.');
        return;
      }
      const min = Number(data.min_purchase || 0);
      if (min > 0 && subtotal < min) {
        setVoucher(null);
        setVoucherMsg(`Minimum purchase ৳${min.toLocaleString('en-BD')} required.`);
        return;
      }
      const maxUses = Number(data.max_uses || 0);
      const used = Number(data.current_uses || 0);
      if (maxUses > 0 && used >= maxUses) {
        setVoucher(null);
        setVoucherMsg('Voucher usage limit reached.');
        return;
      }

      setVoucher(data as VoucherRow);
      setVoucherMsg(`Voucher ${code} applied.`);
      try {
        localStorage.setItem('voucher_code', code);
      } catch {}
    } catch (e: any) {
      console.error(e);
      setVoucher(null);
      setVoucherMsg(e?.message || 'Could not validate voucher.');
    } finally {
      setVoucherLoading(false);
    }
  };

  const clearVoucher = () => {
    setVoucher(null);
    setVoucherInput('');
    setVoucherMsg('');
    try {
      localStorage.removeItem('voucher_code');
    } catch {}
  };

  const handleConfirmOrder = async () => {
    if (missingSize) {
      toast({
        title: 'Size required',
        description: 'Please select a size for each clothing item before placing the order.',
        variant: 'destructive',
      });
      return;
    }

    // ✅ Require TRX ID if bKash selected
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
      if (!guestDivision.trim() || !guestDistrict.trim() || !guestCity.trim() || !guestRoad.trim()) {
        toast({
          title: 'Address missing',
          description: 'Please fill all required address fields.',
          variant: 'destructive',
        });
        return;
      }
      if (!guestZipOk) {
        toast({
          title: 'Invalid Zip Code',
          description: 'Zip code should be 4 digits (e.g. 1230).',
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
        discountCode: voucher?.code || null,
        paymentMethod,
        trxId: paymentMethod === 'bkash' ? trxId.trim() : null,
        guest: user
          ? null
          : {
              full_name: guestFullName.trim(),
              phone: normalizePhone(guestPhone),
              division: guestDivision.trim(),
              district: guestDistrict.trim(),
              city: guestCity.trim(),
              road: guestRoad.trim(),
              zip_code: guestZipCode.trim(),
              address: guestAddress,
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
              division: guestDivision.trim(),
              district: guestDistrict.trim(),
              city: guestCity.trim(),
              road: guestRoad.trim(),
              zip_code: guestZipCode.trim(),
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

  const handleContinueToPayment = () => {
    if (!infoReady) {
      toast({
        title: 'Complete your details',
        description: 'Please fill in your name, phone number, and address before continuing.',
        variant: 'destructive',
      });
      return;
    }
    setCheckoutStep(2);
  };

  const handleContinueToConfirm = () => {
    if (!trxOk) {
      toast({
        title: 'Payment details required',
        description: 'Please enter your bKash TRX ID to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (missingSize) {
      toast({
        title: 'Size required',
        description: 'Select a size for each clothing item before continuing.',
        variant: 'destructive',
      });
      return;
    }
    setCheckoutStep(3);
  };

  const cartItemsPanel = (
    <div className="space-y-6">
      {/* Cart header actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-white border flex items-center justify-center shadow-sm">
            <ShoppingBag className="h-4 w-4 text-blue-900" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Cart Items</div>
            <div className="text-lg font-bold text-gray-900">
              {cartCount} item{cartCount > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/products">
            <Button variant="outline" className="h-9">
              Continue Shopping
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => clearCart()}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cart
          </Button>
        </div>
      </div>

      {missingSize && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Size required</AlertTitle>
          <AlertDescription className="text-xs">
            Select a size for each clothing item to continue checkout.
          </AlertDescription>
        </Alert>
      )}

      {/* Cart Items Card */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-base text-gray-900">Items</CardTitle>
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
                            <div className="mt-1 text-xs text-red-600">Select a size to continue checkout.</div>
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
                            Remove
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

      {/* Trust / info band */}
      <Card className="shadow-sm border-blue-100">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-blue-900" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Reliable delivery</div>
                <div className="text-sm text-gray-600">
                  We confirm every order and deliver quickly. Keep your phone available for confirmation.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              <div className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg border bg-white px-3 py-2 text-sm text-gray-700">
                <CreditCard className="h-4 w-4 text-gray-500" />
                COD / bKash
              </div>
              <div className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-lg border bg-white px-3 py-2 text-sm text-gray-700">
                <Truck className="h-4 w-4 text-gray-500" />
                Fast Shipping
              </div>
            </div>
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      {/* Subtle top gradient band */}
      <div className="bg-gradient-to-b from-blue-50/70 to-transparent">
        <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 pt-8 pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900">
                <ShoppingBag className="h-4 w-4" />
                Checkout (চেকআউট)
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 border">
                  <Sparkles className="h-3 w-3 text-blue-900" />
                  Secure checkout
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                Review your order (অর্ডার পর্যালোচনা)
              </h1>
              <p className="text-sm text-gray-600">
                Confirm items, shipping, and contact info. Choose <b>Cash on Delivery</b> or <b>bKash</b>.
              </p>
            </div>

            {/* Steps */}
            <div className="flex flex-wrap items-center gap-2">
              <StepPill active={checkoutStep >= 1} title="Details (বিস্তারিত)" icon={<User className="h-3.5 w-3.5" />} />
              <StepPill active={checkoutStep >= 2} title="Payment (পেমেন্ট)" icon={<CreditCard className="h-3.5 w-3.5" />} />
              <StepPill active={checkoutStep >= 3} title="Confirm (নিশ্চিতকরণ)" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 pb-10 flex-1">
        {items.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-blue-900" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Your cart is empty</h2>
              <p className="text-sm text-gray-600">Browse products and add items to continue to checkout.</p>
              <div className="flex justify-center gap-2">
                <Link href="/products">
                  <Button className="bg-blue-900 hover:bg-blue-800">Start Shopping</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">Back to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {checkoutStep === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
                <div className="lg:col-span-2 order-1">
                  <Card className="shadow-md border-blue-100 overflow-hidden">
                    <CardHeader className="bg-white border-b">
                      <CardTitle className="text-base text-gray-900">
                        Step 1: Contact & Address (ধাপ ১: যোগাযোগ ও ঠিকানা)
                      </CardTitle>
                      <div className="text-xs text-gray-500">Add your delivery details before payment.</div>
                      <div className="text-[11px] text-blue-900 font-semibold">Secure checkout</div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">

                  {/* Full Name */}
                  <div className="rounded-xl border bg-gray-50/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="flex items-center gap-2 text-gray-700 font-semibold">
                        <User className="h-4 w-4" /> Full Name
                      </Label>
                      {user ? (
                        <Link href="/dashboard" className="text-xs text-blue-700 hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Edit
                        </Link>
                      ) : (
                        <Link href="/login" className="text-xs text-blue-700 hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Sign in (optional)
                        </Link>
                      )}
                    </div>

                    {user ? (
                      <div className="text-sm font-semibold text-gray-900 pl-6">{profile?.full_name || '—'}</div>
                    ) : (
                      <div className="pl-6 space-y-2">
                        <Input
                          value={guestFullName}
                          onChange={(e) => setGuestFullName(e.target.value)}
                          placeholder="Your full name"
                        />
                        {!guestNameOk && guestFullName.trim() === '' && (
                          <div className="text-xs text-gray-500">Name is required for delivery & invoice.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="rounded-xl border bg-gray-50/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="flex items-center gap-2 text-gray-700 font-semibold">
                        <Phone className="h-4 w-4" /> Phone Number
                      </Label>
                      {user ? (
                        <Link href="/dashboard" className="text-xs text-blue-700 hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> {hasPhone ? 'Edit' : 'Add'}
                        </Link>
                      ) : (
                        <Link href="/login" className="text-xs text-blue-700 hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Sign in (optional)
                        </Link>
                      )}
                    </div>

                    {user ? (
                      hasPhone ? (
                        <div className="text-sm font-semibold text-gray-900 pl-6">{profile?.phone}</div>
                      ) : (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Phone required</AlertTitle>
                          <AlertDescription className="text-xs">
                            Add your phone number in Profile to place an order.
                          </AlertDescription>
                        </Alert>
                      )
                    ) : (
                      <div className="pl-6 space-y-2">
                        <Input
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          inputMode="tel"
                        />
                        <div className="text-xs text-gray-500">We'll call this number to confirm your order.</div>
                        {!guestPhoneOk && guestPhone.trim() && (
                          <div className="text-xs text-red-600">Enter a valid BD phone (01XXXXXXXXX).</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  <div className="rounded-xl border bg-gray-50/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="flex items-center gap-2 text-gray-700 font-semibold">
                        <Home className="h-4 w-4" /> Delivery Address
                      </Label>
                      {user ? (
                        <Link href="/dashboard" className="text-xs text-blue-700 hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> {hasAddress ? 'Edit' : 'Add'}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-500">Fill the address below</span>
                      )}
                    </div>

                    {user ? (
                      hasAddress ? (
                        <div className="text-sm text-gray-900 pl-6 whitespace-pre-wrap leading-relaxed">
                          {/* @ts-ignore */}
                          {profile?.address}
                        </div>
                      ) : (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Address required</AlertTitle>
                          <AlertDescription className="text-xs">
                            Add your delivery address in Profile to place an order.
                          </AlertDescription>
                        </Alert>
                      )
                    ) : (
                      <div className="pl-6 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Division *</Label>
                            <Input value={guestDivision} onChange={(e) => setGuestDivision(e.target.value)} placeholder="Dhaka" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">District *</Label>
                            <Input value={guestDistrict} onChange={(e) => setGuestDistrict(e.target.value)} placeholder="Dhaka" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">City / Thana *</Label>
                            <Input value={guestCity} onChange={(e) => setGuestCity(e.target.value)} placeholder="Dhanmondi" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Road / House *</Label>
                            <Input value={guestRoad} onChange={(e) => setGuestRoad(e.target.value)} placeholder="Road 10, House 12" />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Zip Code</Label>
                            <Input value={guestZipCode} onChange={(e) => setGuestZipCode(e.target.value)} placeholder="1205" inputMode="numeric" />
                          </div>
                        </div>

                        {!guestZipOk && guestZipCode.trim() && (
                          <div className="text-xs text-red-600">Zip code must be 4 digits.</div>
                        )}

                        <div className="rounded-lg border bg-white p-3 text-xs text-gray-700">
                          <div className="font-semibold text-gray-900 mb-1">Address Preview</div>
                          <div className="whitespace-pre-wrap">{guestAddress}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {user ? (
                    !isProfileComplete && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Profile incomplete</AlertTitle>
                        <AlertDescription className="text-xs">
                          Add phone number and address to place an order.
                        </AlertDescription>
                      </Alert>
                    )
                  ) : (
                    !isGuestComplete && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Missing details</AlertTitle>
                        <AlertDescription className="text-xs">
                          Add your phone number and delivery address to place an order as a guest.
                        </AlertDescription>
                      </Alert>
                    )
                  )}

                  {!user && (
                    <Alert className="py-2">
                      <AlertTitle>Guest checkout enabled</AlertTitle>
                      <AlertDescription className="text-xs">
                        You can order without logging in. If you sign in, your saved profile will be used automatically.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button
                      className="bg-blue-900 hover:bg-blue-800 h-11 px-6"
                      onClick={handleContinueToPayment}
                      disabled={!infoReady}
                    >
                      Continue to Payment
                    </Button>
                  </div>
                  </CardContent>
                </Card>
              </div>
              <div className="lg:col-span-1 order-2 lg:sticky lg:top-24 lg:self-start">
                {cartItemsPanel}
              </div>
            </div>
            )}

            {checkoutStep === 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
                <div className="lg:col-span-2 order-1">
                  <Card className="shadow-md border-blue-100 overflow-hidden">
                    <CardHeader className="bg-white border-b">
                      <CardTitle className="text-base text-gray-900">
                        Step 2: Payment & Shipping (ধাপ ২: পেমেন্ট ও শিপিং)
                      </CardTitle>
                      <div className="text-xs text-gray-500">Choose how you want to pay and where to deliver.</div>
                      <div className="text-[11px] text-blue-900 font-semibold">Secure checkout</div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-4">

                      {/* ✅ Payment selection */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-gray-700 font-semibold">
                          <CreditCard className="h-4 w-4" /> Payment Method
                        </Label>

                        <RadioGroup
                          value={paymentMethod}
                          onValueChange={(val: 'cod' | 'bkash') => setPaymentMethod(val)}
                          className="grid grid-cols-1 gap-2"
                        >
                          {/* COD */}
                          <PaymentOption
                            active={paymentMethod === 'cod'}
                            title="Cash on Delivery"
                            subtitle="Pay when you receive the product"
                            onClick={() => setPaymentMethod('cod')}
                            left={
                              <div className="h-9 w-9 rounded-lg border bg-white flex items-center justify-center">
                                <Banknote className="h-5 w-5 text-gray-700" />
                              </div>
                            }
                          >
                            <RadioGroupItem value="cod" id="cod" />
                          </PaymentOption>

                          {/* bKash */}
                          <PaymentOption
                            active={paymentMethod === 'bkash'}
                            title="bKash"
                            subtitle="Pay now, then provide TRX ID"
                            onClick={() => setPaymentMethod('bkash')}
                            left={
                              <div className="h-9 w-9 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                                <SafeImage
                                  src={BKASH_LOGO_PATH}
                                  alt="bKash"
                                  width={24}
                                  height={24}
                                  className="h-6 w-6 object-contain"
                                />
                              </div>
                            }
                          >
                            <RadioGroupItem value="bkash" id="bkash" />
                          </PaymentOption>
                        </RadioGroup>

                        {paymentMethod === 'bkash' && (
                          <div className="mt-2 rounded-xl border bg-white p-3 space-y-2">
                            <div className="text-sm font-semibold text-gray-900">Send bKash to:</div>
                            <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                              <div className="text-sm font-bold text-gray-900">{BKASH_NUMBER}</div>
                              <div className="text-xs text-gray-500">bKash</div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-sm font-semibold text-gray-700">TRX ID</Label>
                              <input
                                value={trxId}
                                onChange={(e) => setTrxId(e.target.value)}
                                placeholder="Enter bKash Transaction ID"
                                className="w-full h-10 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                              />
                              <div className="text-xs text-gray-500">
                                Please provide the transaction ID to confirm your order.
                              </div>
                            </div>

                            <Alert className="py-2">
                              <AlertTitle className="text-sm">Note</AlertTitle>
                              <AlertDescription className="text-xs">
                                Orders with bKash will be verified using your TRX ID.
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}
                      </div>

                      {/* Shipping selection */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-gray-700 font-semibold">
                          <MapPin className="h-4 w-4" /> Shipping Area
                        </Label>

                        <RadioGroup
                          value={deliveryLocation}
                          onValueChange={(val: 'inside' | 'outside') => setDeliveryLocation(val)}
                          className="grid grid-cols-1 gap-2"
                        >
                          {/* Inside */}
                          <div
                            onClick={() => setDeliveryLocation('inside')}
                            className={`rounded-xl border p-3 cursor-pointer transition-all ${
                              deliveryLocation === 'inside'
                                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm'
                                : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 pointer-events-none">
                                <RadioGroupItem value="inside" id="inside" />
                                <Label htmlFor="inside" className="cursor-pointer font-semibold text-gray-900">
                                  Inside Dhaka
                                </Label>
                              </div>
                              <div className="text-sm font-bold text-gray-900">{fmtBDT(SHIPPING_INSIDE_DHAKA)}</div>
                            </div>
                            <div className="text-xs text-gray-600 mt-1 pl-6">Standard delivery inside Dhaka city.</div>
                          </div>

                          {/* Outside */}
                          <div
                            onClick={() => setDeliveryLocation('outside')}
                            className={`rounded-xl border p-3 cursor-pointer transition-all ${
                              deliveryLocation === 'outside'
                                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm'
                                : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 pointer-events-none">
                                <RadioGroupItem value="outside" id="outside" />
                                <Label htmlFor="outside" className="cursor-pointer font-semibold text-gray-900">
                                  Outside Dhaka
                                </Label>
                              </div>
                              <div className="text-sm font-bold text-gray-900">{fmtBDT(SHIPPING_OUTSIDE_DHAKA)}</div>
                            </div>
                            <div className="text-xs text-gray-600 mt-1 pl-6">Courier delivery to other districts.</div>
                          </div>
                        </RadioGroup>

                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5" />
                          Estimated delivery: <span className="font-semibold text-gray-700">{etaRange}</span>
                        </div>
                      </div>

                      <Separator />

                      {/* Totals */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-700">
                          <span>Subtotal</span>
                          <span className="font-semibold">{fmtBDT(subtotal)}</span>
                        </div>

                        {/* Voucher */}
                        <div className="rounded-xl border bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">Voucher</span>
                            {voucher && voucherDiscount > 0 && (
                              <span className="text-xs font-bold text-green-700">Applied</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={voucherInput}
                              onChange={(e) => setVoucherInput(e.target.value)}
                              placeholder="Enter voucher code"
                              className="bg-white"
                            />
                            {voucher ? (
                              <Button type="button" variant="outline" className="bg-white" onClick={clearVoucher}>
                                Remove
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="bg-white"
                                onClick={() => void applyVoucher()}
                                disabled={voucherLoading || !voucherInput.trim()}
                              >
                                {voucherLoading ? '...' : 'Apply'}
                              </Button>
                            )}
                          </div>
                          {voucherMsg && (
                            <div className={`text-xs ${voucher ? 'text-green-700' : 'text-red-600'}`}>{voucherMsg}</div>
                          )}
                          <div className="text-[11px] text-gray-500">Discount applies to product subtotal (shipping excluded).</div>
                        </div>

                        {voucherDiscount > 0 && (
                          <div className="flex justify-between text-gray-700">
                            <span className="font-semibold text-green-700">Voucher Discount {voucher?.code ? `(${voucher.code})` : ''}</span>
                            <span className="font-semibold text-green-700">- {fmtBDT(voucherDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-700">
                          <span>Shipping</span>
                          <span className="font-semibold">{fmtBDT(shippingCost)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between text-lg font-extrabold text-blue-900">
                          <span>Total</span>
                          <span>{fmtBDT(total)}</span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5" />
                          {paymentMethod === 'cod' ? 'Cash on Delivery available' : 'bKash payment selected'}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button variant="outline" className="h-11" onClick={() => setCheckoutStep(1)}>
                          Back to Details
                        </Button>
                        <Button
                          className="flex-1 bg-blue-900 hover:bg-blue-800 h-11"
                          onClick={handleContinueToConfirm}
                          disabled={!trxOk || missingSize}
                        >
                          Continue to Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-1 order-2 lg:sticky lg:top-24 lg:self-start">
                  {cartItemsPanel}
                </div>
              </div>
            )}

            {checkoutStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
                <div className="lg:col-span-2 order-1">
                  <Card className="shadow-md border-blue-100 overflow-hidden">
                    <CardHeader className="bg-white border-b">
                      <CardTitle className="text-base text-gray-900">
                        Step 3: Review & Confirm (ধাপ ৩: পর্যালোচনা ও নিশ্চিতকরণ)
                      </CardTitle>
                      <div className="text-xs text-gray-500">Review everything before placing your order.</div>
                      <div className="text-[11px] text-blue-900 font-semibold">Secure checkout</div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-4">
                      <div className="rounded-xl border bg-gray-50/60 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-800">Contact & Address</div>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setCheckoutStep(1)}>
                            Edit
                          </Button>
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <div><span className="font-semibold">Name:</span> {user ? profile?.full_name || '—' : guestFullName}</div>
                          <div><span className="font-semibold">Phone:</span> {user ? profile?.phone || '—' : normalizePhone(guestPhone)}</div>
                          <div className="whitespace-pre-wrap">
                            <span className="font-semibold">Address:</span>{' '}
                            {user ? (profile as any)?.address || '—' : guestAddress}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-gray-50/60 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-800">Payment & Shipping</div>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setCheckoutStep(2)}>
                            Edit
                          </Button>
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <div><span className="font-semibold">Payment:</span> {paymentMethod === 'cod' ? 'Cash on Delivery' : 'bKash'}</div>
                          {paymentMethod === 'bkash' && (
                            <div><span className="font-semibold">TRX ID:</span> {trxId || '—'}</div>
                          )}
                          <div><span className="font-semibold">Shipping:</span> {deliveryLocation === 'inside' ? 'Inside Dhaka' : 'Outside Dhaka'}</div>
                          <div><span className="font-semibold">ETA:</span> {etaRange}</div>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-white p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-700">
                          <span>Subtotal</span>
                          <span className="font-semibold">{fmtBDT(subtotal)}</span>
                        </div>
                        {voucherDiscount > 0 && (
                          <div className="flex justify-between text-gray-700">
                            <span className="font-semibold text-green-700">Voucher Discount {voucher?.code ? `(${voucher.code})` : ''}</span>
                            <span className="font-semibold text-green-700">- {fmtBDT(voucherDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-700">
                          <span>Shipping</span>
                          <span className="font-semibold">{fmtBDT(shippingCost)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between text-lg font-extrabold text-blue-900">
                          <span>Total</span>
                          <span>{fmtBDT(total)}</span>
                        </div>
                      </div>

                      {!user && (
                        <Alert className="py-2">
                          <AlertTitle>Guest checkout enabled</AlertTitle>
                          <AlertDescription className="text-xs">
                            You can order without logging in. If you sign in, your saved profile will be used automatically.
                          </AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="w-full bg-blue-900 hover:bg-blue-800 h-11 text-base shadow-sm"
                        onClick={handleConfirmOrder}
                        disabled={!canCheckout}
                      >
                        {isPlacingOrder ? 'Processing...' : 'Confirm Order'}
                      </Button>

                      <div className="text-center text-xs text-gray-500">
                        By confirming, you agree to be contacted to verify your order.
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-1 order-2 lg:sticky lg:top-24 lg:self-start">
                  {cartItemsPanel}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
