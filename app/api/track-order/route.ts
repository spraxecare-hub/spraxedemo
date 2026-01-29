import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Payload = {
  orderNumber?: string;
  contact?: string; // phone or email
};

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function normalizePhone(v: string) {
  // Keep digits only (works for +88, spaces, dashes)
  return v.replace(/\D+/g, '');
}

function phoneMatches(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const aa = normalizePhone(a);
  const bb = normalizePhone(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;

  // Some users type with/without country code; compare last 10/11 digits
  const tailA = aa.slice(-11);
  const tailB = bb.slice(-11);
  return tailA === tailB || aa.slice(-10) === bb.slice(-10);
}

function isEmail(v: string) {
  return v.includes('@');
}

// Very small in-memory rate limit (best-effort; resets when server restarts)
function rateLimit(ip: string, limit = 20, windowMs = 10 * 60 * 1000) {
  const g = globalThis as any;
  if (!g.__track_order_rl) g.__track_order_rl = new Map<string, { count: number; reset: number }>();
  const map: Map<string, { count: number; reset: number }> = g.__track_order_rl;

  const now = Date.now();
  const existing = map.get(ip);

  if (!existing || existing.reset < now) {
    map.set(ip, { count: 1, reset: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) return { ok: false, retryAfterMs: existing.reset - now };

  existing.count += 1;
  map.set(ip, existing);
  return { ok: true };
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
    const orderNumber = (body.orderNumber || '').trim();
    const contactRaw = (body.contact || '').trim();

    if (!orderNumber || !contactRaw) {
      return NextResponse.json({ ok: false, message: 'Order number and contact are required.' }, { status: 400 });
    }

    const contactIsEmail = isEmail(contactRaw);
    const contactEmail = contactIsEmail ? normalizeEmail(contactRaw) : null;
    const contactPhone = contactIsEmail ? null : normalizePhone(contactRaw);

    // Pull the order + minimal related info (bypasses RLS via service role)
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(
        `
        id,
        user_id,
        order_number,
        status,
        created_at,
        updated_at,
        payment_method,
        payment_status,
        tracking_number,
        shipped_at,
        delivered_at,
        total,
        total_amount,
        shipping_cost,
        notes,
        delivery_location,
        contact_number,
        profiles (
          email,
          phone,
          full_name
        ),
        order_items (
          product_name,
          quantity
        )
      `
      )
      .ilike('order_number', orderNumber)
      .limit(1)
      .maybeSingle();

    if (error || !order) {
      // Generic response to reduce data leakage
      return NextResponse.json({ ok: false, message: 'Order not found.' }, { status: 404 });
    }

    const profileEmail = (order as any)?.profiles?.email ? normalizeEmail((order as any).profiles.email) : null;
    const profilePhone = (order as any)?.profiles?.phone || null;
    const orderPhone = (order as any)?.contact_number || null;

    let matched = false;

    if (contactIsEmail) {
      matched = !!profileEmail && profileEmail === contactEmail;
      // If profiles.email isn't present in schema, the above stays false and we fall back below.
      if (!matched && (order as any).user_id) {
        try {
          const res = await supabaseAdmin.auth.admin.getUserById((order as any).user_id);
          const authEmail = res.data?.user?.email ? normalizeEmail(res.data.user.email) : null;
          matched = !!authEmail && authEmail === contactEmail;
        } catch {
          // ignore
        }
      }
    } else {
      matched = phoneMatches(contactPhone, orderPhone) || phoneMatches(contactPhone, profilePhone);
    }

    if (!matched) {
      return NextResponse.json({ ok: false, message: 'Order not found.' }, { status: 404 });
    }

    // Return only what's needed for tracking
    return NextResponse.json({
      ok: true,
      order: {
        order_id: order.id,
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        tracking_number: (order as any).tracking_number ?? null,
        shipped_at: (order as any).shipped_at ?? null,
        delivered_at: (order as any).delivered_at ?? null,
        delivery_location: (order as any).delivery_location ?? null,
        total: order.total ?? null,
        total_amount: (order as any).total_amount ?? null,
        shipping_cost: (order as any).shipping_cost ?? null,
        notes: (order as any).notes ?? null,
        items: (order as any).order_items ?? [],
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: 'Something went wrong.' }, { status: 500 });
  }
}
