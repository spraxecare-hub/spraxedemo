import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

type ItemPayload = { product_id: string; quantity: number };

type GuestPayload = {
  full_name: string;
  phone: string;
  division: string;
  district: string;
  city: string;
  road: string;
  zip_code?: string;
  address: string; // full formatted address
};

type Payload = {
  items: ItemPayload[];
  deliveryLocation: 'inside' | 'outside';
  shippingSpeed?: 'standard' | 'express';
  discountCode?: string | null;
  paymentMethod: 'cod' | 'bkash';
  trxId?: string | null;
  guest?: GuestPayload | null;
};

const SHIPPING_INSIDE_DHAKA = 60;
const SHIPPING_OUTSIDE_DHAKA = 120;

const EXPRESS_SURCHARGE_INSIDE_DHAKA = 60;
const EXPRESS_SURCHARGE_OUTSIDE_DHAKA = 80;

function normalizePhone(raw: string) {
  const digits = (raw || '').replace(/\D+/g, '');
  // Allow +8801XXXXXXXXX or 8801XXXXXXXXX -> 01XXXXXXXXX
  if (digits.startsWith('8801') && digits.length >= 13) return '0' + digits.slice(2, 13);
  if (digits.startsWith('01') && digits.length >= 11) return digits.slice(0, 11);
  return digits;
}

function isValidBDPhone(raw: string) {
  const p = normalizePhone(raw);
  return /^01\d{9}$/.test(p);
}

function rateLimit(ip: string, limit = 20, windowMs = 10 * 60 * 1000) {
  const g = globalThis as any;
  if (!g.__place_order_rl) g.__place_order_rl = new Map<string, { count: number; reset: number }>();
  const map: Map<string, { count: number; reset: number }> = g.__place_order_rl;

  const now = Date.now();
  const existing = map.get(ip);

  if (!existing || existing.reset < now) {
    map.set(ip, { count: 1, reset: now + windowMs });
    return { ok: true as const };
  }

  if (existing.count >= limit) return { ok: false as const, retryAfterMs: existing.reset - now };

  existing.count += 1;
  map.set(ip, existing);
  return { ok: true as const };
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function safeInt(v: any, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function makeOrderNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${ymd}-${rnd}`;
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const rl = rateLimit(ip);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } }
      );
    }

    const body = (await req.json()) as Payload;

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json({ ok: false, message: 'Cart is empty.' }, { status: 400 });
    }

    // Payment validation
    const paymentMethod = body.paymentMethod === 'bkash' ? 'bkash' : 'cod';
    const trxId = String(body.trxId ?? '').trim();
    if (paymentMethod === 'bkash' && !trxId) {
      return NextResponse.json({ ok: false, message: 'TRX ID is required for bKash.' }, { status: 400 });
    }

    // Auth (optional)
    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    let userId: string | null = null;

    if (bearer) {
      const { data } = await supabaseAdmin.auth.getUser(bearer);
      userId = data?.user?.id ?? null;
    }

    // Contact + address
    let contactPhone = '';
    let shippingAddress = '';
    let customerName = '';
    const deliveryLocation: 'inside' | 'outside' = body.deliveryLocation === 'outside' ? 'outside' : 'inside';

    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, phone, address')
        .eq('id', userId)
        .maybeSingle();

      customerName = String((profile as any)?.full_name ?? '').trim();
      contactPhone = String(profile?.phone ?? '').trim();
      shippingAddress = String((profile as any)?.address ?? '').trim();

      if (!customerName || !contactPhone || !shippingAddress) {
        return NextResponse.json(
          { ok: false, message: 'Please add your full name, phone number, and address in your Profile.' },
          { status: 400 }
        );
      }
    } else {
      const g = body.guest;
      if (!g) {
        return NextResponse.json({ ok: false, message: 'Guest details are required.' }, { status: 400 });
      }

      customerName = String((g as any).full_name ?? '').trim();
      if (!customerName) {
        return NextResponse.json({ ok: false, message: 'Full name is required.' }, { status: 400 });
      }

      if (!isValidBDPhone(g.phone)) {
        return NextResponse.json({ ok: false, message: 'Invalid phone number.' }, { status: 400 });
      }

      const required = [g.division, g.district, g.city, g.road];
      if (required.some((x) => !String(x ?? '').trim())) {
        return NextResponse.json({ ok: false, message: 'Please fill all required address fields.' }, { status: 400 });
      }

      const zip = String(g.zip_code ?? '').trim();
      if (zip && !/^\d{4}$/.test(zip)) {
        return NextResponse.json({ ok: false, message: 'Zip code must be 4 digits.' }, { status: 400 });
      }

      contactPhone = normalizePhone(g.phone);
      shippingAddress = String(g.address ?? '').trim();

      if (!shippingAddress) {
        return NextResponse.json({ ok: false, message: 'Address is required.' }, { status: 400 });
      }
    }

    // Products server-side
    const productIds = uniq(items.map((x) => String(x.product_id || '')).filter(Boolean));
    if (!productIds.length) {
      return NextResponse.json({ ok: false, message: 'Invalid cart items.' }, { status: 400 });
    }

    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, sku, price, stock_quantity')
      .in('id', productIds);

    if (prodErr || !products?.length) {
      return NextResponse.json({ ok: false, message: 'Could not load products for checkout.' }, { status: 500 });
    }

    const productMap = new Map<string, any>();
    (products || []).forEach((p: any) => productMap.set(String(p.id), p));

    const orderItems: any[] = [];
    let subtotal = 0;

    for (const it of items) {
      const pid = String(it.product_id || '');
      const qty = safeInt(it.quantity, 0);
      if (!pid || qty <= 0) continue;

      const p = productMap.get(pid);
      if (!p) {
        return NextResponse.json({ ok: false, message: 'One or more items are unavailable.' }, { status: 400 });
      }

      const stock = safeInt(p.stock_quantity, 0);
      if (stock > 0 && qty > stock) {
        return NextResponse.json(
          { ok: false, message: `Insufficient stock for ${String(p.name || 'a product')}.` },
          { status: 400 }
        );
      }

      const unit = safeNum(p.price, 0);
      const line = unit * qty;

      subtotal += line;
      orderItems.push({
        product_id: pid,
        product_name: String(p.name || 'Product'),
        product_sku: String(p.sku || pid),
        quantity: qty,
        unit_price: unit,
        total_price: line,
      });
    }

    if (!orderItems.length) {
      return NextResponse.json({ ok: false, message: 'No valid items to order.' }, { status: 400 });
    }

    // Voucher discount (applies to subtotal only, excludes shipping)
    const rawCode = String((body as any).discountCode || '').trim();
    const discountCode = rawCode ? rawCode.toUpperCase() : null;
    let discountAmount = 0;
    let voucherRow: any = null;

    if (discountCode) {
      const { data: v, error: vErr } = await supabaseAdmin
        .from('discount_codes')
        .select('code,discount_type,discount_value,min_purchase,max_uses,current_uses,valid_from,valid_until,is_active')
        .eq('code', discountCode)
        .maybeSingle();

      if (vErr) {
        console.error('Discount code lookup error:', vErr);
        return NextResponse.json({ ok: false, message: 'Could not validate voucher.' }, { status: 500 });
      }

      if (!v) {
        return NextResponse.json({ ok: false, message: 'Invalid voucher code.' }, { status: 400 });
      }

      const now = new Date();
      if (!v.is_active) return NextResponse.json({ ok: false, message: 'Voucher is inactive.' }, { status: 400 });
      if (v.valid_from && now < new Date(v.valid_from)) {
        return NextResponse.json({ ok: false, message: 'Voucher is not active yet.' }, { status: 400 });
      }
      if (v.valid_until && now > new Date(v.valid_until)) {
        return NextResponse.json({ ok: false, message: 'Voucher has expired.' }, { status: 400 });
      }

      const min = safeNum(v.min_purchase, 0);
      if (min > 0 && subtotal < min) {
        return NextResponse.json(
          { ok: false, message: `Minimum purchase ৳${min.toLocaleString('en-BD')} required for this voucher.` },
          { status: 400 }
        );
      }

      const maxUses = safeInt(v.max_uses, 0);
      const used = safeInt(v.current_uses, 0);
      if (maxUses > 0 && used >= maxUses) {
        return NextResponse.json({ ok: false, message: 'Voucher usage limit reached.' }, { status: 400 });
      }

      const t = String(v.discount_type || '').toLowerCase();
      const val = safeNum(v.discount_value, 0);
      if (val <= 0) {
        return NextResponse.json({ ok: false, message: 'Voucher is invalid.' }, { status: 400 });
      }

      if (t === 'percentage' || t === 'percent') discountAmount = (subtotal * val) / 100;
      else discountAmount = val;

      discountAmount = Math.max(0, Math.min(subtotal, discountAmount));
      discountAmount = Math.round(discountAmount);
      voucherRow = v;
    }

        const shippingSpeed: 'standard' | 'express' = body.shippingSpeed === 'express' ? 'express' : 'standard';
    const baseShipping = deliveryLocation === 'inside' ? SHIPPING_INSIDE_DHAKA : SHIPPING_OUTSIDE_DHAKA;
    const expressSurcharge =
      shippingSpeed === 'express'
        ? deliveryLocation === 'inside'
          ? EXPRESS_SURCHARGE_INSIDE_DHAKA
          : EXPRESS_SURCHARGE_OUTSIDE_DHAKA
        : 0;
    const shippingCost = baseShipping + expressSurcharge;
    const total = Math.max(0, subtotal - discountAmount) + shippingCost;

    const orderNumber = makeOrderNumber();

    const finalPaymentMethod = paymentMethod === 'cod' ? 'Cash on Delivery' : 'bKash';
    const finalPaymentStatus = 'pending';

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',

        subtotal,
        discount: discountAmount,
        shipping_cost: shippingCost,
        total,

        tax_amount: 0,
        discount_code: discountCode,
        discount_amount: discountAmount,
        total_amount: total,

        delivery_location: deliveryLocation,
        contact_number: contactPhone,
        shipping_address: shippingAddress,
        customer_name: customerName,

        notes: `Shipping: ${shippingSpeed === 'express' ? 'Express' : 'Standard'} • Area: ${deliveryLocation === 'inside' ? 'Inside Dhaka' : 'Outside Dhaka'}`,

        payment_method: finalPaymentMethod,
        payment_status: finalPaymentStatus,
        payment_trx_id: paymentMethod === 'bkash' ? trxId : null,
      })
      .select('id, order_number')
      .single();

    if (orderErr || !order) {
      console.error('Order insert error:', orderErr);
      return NextResponse.json({ ok: false, message: 'Failed to create order.' }, { status: 500 });
    }

    const itemsToInsert = orderItems.map((row) => ({ ...row, order_id: order.id }));

    const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(itemsToInsert as any);

    if (itemsErr) {
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      console.error('Order items insert error:', itemsErr);
      return NextResponse.json({ ok: false, message: 'Failed to create order items.' }, { status: 500 });
    }

    // Best-effort: count voucher usage
    if (voucherRow?.code) {
      const nextUses = safeInt(voucherRow.current_uses, 0) + 1;
      const { error: vUpdErr } = await supabaseAdmin
        .from('discount_codes')
        .update({ current_uses: nextUses })
        .eq('code', voucherRow.code)
        .limit(1);
      if (vUpdErr) console.warn('Voucher use update failed:', vUpdErr.message);
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      contact: contactPhone,
    });
  } catch (e) {
    console.error('Place order fatal:', e);
    return NextResponse.json({ ok: false, message: 'Something went wrong.' }, { status: 500 });
  }
}
