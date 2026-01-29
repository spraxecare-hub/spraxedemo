// lib/invoice/invoice-generator.ts
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;

  // ✅ NEW: payment info (COD / bKash + optional TRX)
  payment: {
    method: 'Cash on Delivery' | 'bKash' | string;
    trxId?: string;
  };

  customer: {
    name: string;
    phone: string;
    address: string;
  };

  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;

  subtotal: number;
  discountCode?: string;
  discountAmount: number;
  shippingCost: number;
  totalAmount: number;
  notes: string;
}

/** ---------------------------
 * Helpers
 * --------------------------*/
const safeNum = (value: any): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const clamp0 = (n: number) => (n < 0 ? 0 : n);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNum(amount));
};

const esc = (v: any) =>
  String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const fmtDateBD = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return new Date().toLocaleDateString('en-BD');
  }
};

const makeInvoiceNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${randomSuffix}`;
};

/** Normalize payment method label */
const normalizePaymentMethod = (method: any): string => {
  const m = String(method ?? '').trim();
  if (!m) return 'Cash on Delivery';

  const low = m.toLowerCase();
  if (low.includes('bkash')) return 'bKash';
  if (low.includes('cod') || low.includes('cash')) return 'Cash on Delivery';

  return m;
};

/** ---------------------------
 * Fetch + build invoice data
 * --------------------------*/
export async function getInvoiceData(orderId: string): Promise<InvoiceData | null> {
  try {
    // 1) Fetch Order + Profile
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`*, profiles ( full_name, email, phone, address, division, district, city, road, zip_code )`)
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('Invoice order fetch error:', orderError.message);
    }

    const order =
      orderData || ({
        id: orderId,
        order_number: 'ORD-MISSING',
        created_at: new Date().toISOString(),
        subtotal: 0,
        total: 0,
        discount: 0,
        shipping_cost: 0,
        contact_number: '',
        shipping_address: '',
        delivery_location: '',
        customer_name: '',

        // ✅ fallback payment fields
        payment_method: 'Cash on Delivery',
        payment_trx_id: null,
      } as any);

    const profile =
      order?.profiles && (Array.isArray(order.profiles) ? order.profiles[0] : order.profiles);

    // ✅ Payment info (from orders table)
    const paymentMethod = normalizePaymentMethod((order as any).payment_method);
    const trxIdRaw = String((order as any).payment_trx_id ?? '').trim();
    const paymentTrxId = trxIdRaw ? trxIdRaw : undefined;

    // 2) Fetch Items
    const { data: orderItems, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsErr) console.error('Invoice items fetch error:', itemsErr.message);

    const items =
      orderItems?.map((item: any) => {
        const qty = safeNum(item.quantity);
        const unit = safeNum(item.unit_price ?? item.price);
        const line = safeNum(item.total_price ?? item.total ?? qty * unit);
        const meta = [
          item.color_name ? `Color: ${String(item.color_name)}` : null,
          item.size ? `Size: ${String(item.size)}` : null,
        ]
          .filter(Boolean)
          .join(' • ');
        const name = String(item.product_name || item.name || item.title || 'Product');

        return {
          name: meta ? `${name} (${meta})` : name,
          quantity: qty,
          price: unit,
          total: line,
        };
      }) || [];

    // 3) Compute totals reliably (fallback if order fields are missing)
    // NOTE: `items` may be inferred as `any` under strict TS settings, so avoid
    // generic type arguments on `reduce` ("Untyped function calls may not accept type arguments").
    const computedSubtotal = clamp0(
      (Array.isArray(items) ? (items as any[]) : []).reduce(
        (acc: number, it: any) => acc + safeNum(it.total),
        0
      )
    );
    const subtotal = safeNum(order.subtotal) || computedSubtotal;

    // discount support
    const discountAmount = clamp0(
      safeNum((order as any).discount_amount ?? (order as any).discount ?? 0)
    );

    const shippingCost = clamp0(safeNum(order.shipping_cost ?? (order as any).shipping ?? 0));

    const totalFromOrder = safeNum((order as any).total_amount ?? order.total);
    const totalAmount = totalFromOrder || clamp0(subtotal - discountAmount + shippingCost);

    // 4) Fetch/Create Invoice record (idempotent: upsert by order_id)
    const issueISO = new Date().toISOString();
    const dueISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const newInvoiceObj = {
      order_id: orderId,
      invoice_number: makeInvoiceNumber(),
      issue_date: issueISO,
      due_date: dueISO,
      subtotal,
      total_amount: totalAmount,
      notes: 'Thank you for shopping with Spraxe!',
    };

    const { data: invoiceUpserted, error: invErr } = await supabaseAdmin
      .from('invoices')
      .upsert(newInvoiceObj, { onConflict: 'order_id' })
      .select()
      .maybeSingle();

    if (invErr) console.error('Invoice upsert error:', invErr.message);

    let invoice = invoiceUpserted;
    if (!invoice) {
      const { data: existing } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      invoice = existing || (newInvoiceObj as any);
    }

    // 5) Customer block
    const fullName = profile?.full_name || (order as any).customer_name || 'Valued Customer';

    const phone = (order as any).contact_number || (order as any).phone || profile?.phone || 'N/A';

    const address =
      (order as any).shipping_address ||
      profile?.address ||
      (order as any).address ||
      (order as any).delivery_location ||
      'Address not provided';

    return {
      invoiceNumber: String(invoice.invoice_number || newInvoiceObj.invoice_number),
      issueDate: fmtDateBD(String(invoice.issue_date || issueISO)),
      dueDate: fmtDateBD(String(invoice.due_date || dueISO)),

      // ✅ Payment in invoice data
      payment: {
        method: paymentMethod,
        ...(paymentMethod.toLowerCase().includes('bkash') && paymentTrxId ? { trxId: paymentTrxId } : {}),
      },

      customer: {
        name: String(fullName),
        phone: String(phone),
        address: String(address),
      },

      items,
      subtotal: safeNum(subtotal),
      discountCode: String((order as any).discount_code || '') || undefined,
      discountAmount: safeNum(discountAmount),
      shippingCost: safeNum(shippingCost),
      totalAmount: safeNum(totalAmount),
      notes: String(invoice.notes || ''),
    };
  } catch (e) {
    console.error('Invoice generator fatal error:', e);
    return null;
  }
}

/** ======================================================
 * 1) WEB/PDF VERSION (Professional, print-perfect A4)
 * =======================================================*/
export function generateInvoiceHTML(data: InvoiceData): string {
  if (!data) return '<h1>No Data</h1>';

  const discountLabel = data.discountCode ? `Voucher Discount (${esc(data.discountCode)})` : 'Discount';

  const itemsHTML =
    data.items?.length > 0
      ? data.items
          .map(
            (item) => `
      <tr>
        <td class="td">
          <div class="name">${esc(item.name)}</div>
        </td>
        <td class="td center">${esc(item.quantity)}</td>
        <td class="td right">৳${esc(formatCurrency(item.price))}</td>
        <td class="td right"><b>৳${esc(formatCurrency(item.total))}</b></td>
      </tr>
    `
          )
          .join('')
      : `
      <tr>
        <td class="td" colspan="4" style="color:#64748b;padding:14px;">No items found.</td>
      </tr>
    `;

  // Invoice header uses the public/header.png wordmark (already includes the brand name)
  // so we only show the phone number below it.
  const BRAND_NAME = 'Spraxe';
  const BRAND_PHONE = '+8809638371951';
  const LOGO_URL = '/header.png';

  const subtotal = safeNum(data.subtotal);
  const discount = safeNum(data.discountAmount);
  const shipping = safeNum(data.shippingCost);
  const total = safeNum(data.totalAmount);

  const payMethod = String(data.payment?.method || 'Cash on Delivery');
  const payTrx = String(data.payment?.trxId || '').trim();
  const showTrx = payMethod.toLowerCase().includes('bkash') && !!payTrx;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Invoice ${esc(data.invoiceNumber)}</title>

  <style>
    :root{
      --ink:#0f172a;
      --muted:#64748b;
      --line:#e2e8f0;
      --bg:#f8fafc;
      --card:#ffffff;
      --brand:#1e3a8a;
    }

    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      color:var(--ink);
      background:var(--bg);
    }

    .wrap{ max-width: 980px; margin: 20px auto; padding: 0 18px; }
    .sheet{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:16px;
      box-shadow: 0 10px 30px rgba(15,23,42,.06);
      overflow:hidden;
    }

    .top{
      padding: 20px 22px 14px;
      border-bottom:1px solid var(--line);
      background: linear-gradient(180deg, rgba(30,58,138,.08), rgba(255,255,255,0));
    }

    .row{ display:flex; gap:18px; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; }

    .brand{ display:flex; flex-direction:column; gap:6px; align-items:flex-start; }
    .logo{
      width:220px; height:64px;
      border-radius:0;
      background:transparent;
      border:none;
      display:flex; align-items:center; justify-content:flex-start;
      overflow:hidden;
      flex: 0 0 auto;
    }
    .logo img{ width:100%; height:100%; object-fit:contain; display:block; }
    .brand .muted{ margin:0; font-size:12px; color:var(--muted); line-height:1.4; font-weight:800; }

    .title{
      text-align:right;
      min-width: 240px;
    }
    .title .h{
      font-size:22px;
      font-weight:900;
      margin:0;
      color: var(--brand);
      letter-spacing:.02em;
    }
    .title .sub{
      margin-top:6px;
      font-size:12px;
      color:var(--muted);
      display:flex;
      justify-content:flex-end;
      gap:10px;
      flex-wrap:wrap;
    }
    .pill{
      display:inline-flex; align-items:center; gap:6px;
      padding:4px 10px; border-radius:999px; font-weight:800;
      font-size:11px; border:1px solid var(--line); background:#fff;
      color: var(--ink);
      white-space: nowrap;
    }

    .body{ padding: 16px 22px 20px; }
    .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
    @media (max-width: 720px){
      .grid{ grid-template-columns:1fr; }
      .title{ text-align:left; }
      .title .sub{ justify-content:flex-start; }
    }

    .card{
      border:1px solid var(--line);
      border-radius:14px;
      padding:14px;
      background:#fff;
    }
    .card h3{
      margin:0 0 10px 0;
      font-size:12px;
      color:var(--muted);
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    table{ width:100%; border-collapse:collapse; margin-top:12px; }
    thead th{
      font-size:11px; text-transform:uppercase; letter-spacing:.08em;
      color:var(--muted);
      background:#f8fafc;
      border-top:1px solid var(--line);
      border-bottom:1px solid var(--line);
      padding:10px 10px;
      text-align:left;
    }
    .td{
      padding:10px 10px;
      border-bottom:1px solid #eef2f7;
      font-size:12px;
      vertical-align:top;
    }
    .right{ text-align:right; }
    .center{ text-align:center; }
    .name{ font-weight:800; color:var(--ink); }

    .totals{
      margin-top:12px;
      display:flex;
      justify-content:flex-end;
    }
    .totals .box{
      width: 340px;
      border:1px solid var(--line);
      border-radius:14px;
      padding:14px;
      background:#fff;
    }
    .line{
      display:flex; justify-content:space-between; padding:6px 0;
      font-size:12px; color:var(--muted);
      border-bottom: 1px dashed #e5e7eb;
    }
    .line:last-child{ border-bottom:none; }
    .line b{ color:var(--ink); }
    .grand{
      margin-top:10px;
      padding-top:10px;
      border-top:1px solid var(--line);
      display:flex;
      justify-content:space-between;
      font-size:14px;
      font-weight:900;
      color:var(--brand);
    }

    .notes{
      margin-top:12px;
      border:1px dashed #cbd5e1;
      border-radius:14px;
      padding:12px 14px;
      background: #fbfdff;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .footer{
      padding: 14px 22px 18px;
      border-top:1px solid var(--line);
      background:#fff;
      color:var(--muted);
      font-size:11px;
      display:flex;
      justify-content:space-between;
      gap:10px;
      flex-wrap:wrap;
    }

    /* PRINT (A4) */
    @media print{
      body{ background:#fff; }
      .wrap{ margin:0; padding:0; max-width:none; }
      .sheet{ border:none; border-radius:0; box-shadow:none; }
      .top{ border-bottom:1px solid #ddd; background:#fff; }
      .footer{ border-top:1px solid #ddd; }
      @page{ size:A4; margin: 12mm; }
    }
  </style>
</head>

<body>
  <div class="wrap">
    <div class="sheet">
      <div class="top">
        <div class="row">
          <div class="brand">
            <div class="logo">
              <img src="${esc(LOGO_URL)}" alt="${esc(BRAND_NAME)}" crossorigin="anonymous" />
            </div>
            <div class="muted">${esc(BRAND_PHONE)}</div>
          </div>

          <div class="title">
            <p class="h">INVOICE</p>
            <div class="sub">
              <span class="pill">${esc(data.invoiceNumber)}</span>
              <span class="pill">Issue: <b style="color:var(--ink)">${esc(data.issueDate)}</b></span>
              <span class="pill">Due: <b style="color:var(--ink)">${esc(data.dueDate)}</b></span>
              <span class="pill">Payment: <b style="color:var(--ink)">${esc(payMethod)}</b></span>
              ${
                showTrx
                  ? `<span class="pill">TRX: <b style="color:var(--ink)">${esc(payTrx)}</b></span>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>

      <div class="body">
        <div class="grid">
          <div class="card">
            <h3>Bill To</h3>
            <div style="font-size:12px; line-height:1.55;">
              <div style="font-weight:900; color:var(--ink); font-size:13px;">${esc(data.customer.name)}</div>
              <div style="color:var(--muted); margin-top:2px;">${esc(data.customer.phone)}</div>
              <div style="color:var(--muted); margin-top:6px;">${esc(data.customer.address)}</div>
            </div>
          </div>

          <div class="card">
            <h3>Summary</h3>
            <div style="font-size:12px; line-height:1.55;">
              <div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed #e5e7eb;">
                <span style="color:var(--muted)">Payment Method</span>
                <b>${esc(payMethod)}</b>
              </div>
              ${
                showTrx
                  ? `<div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed #e5e7eb;">
                      <span style="color:var(--muted)">bKash TRX ID</span>
                      <b>${esc(payTrx)}</b>
                    </div>`
                  : ''
              }

              <div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed #e5e7eb; margin-top:6px;">
                <span style="color:var(--muted)">Subtotal</span>
                <b>৳${esc(formatCurrency(subtotal))}</b>
              </div>

              ${
                discount > 0
                  ? `<div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed #e5e7eb;">
                      <span style="color:#b91c1c;">${discountLabel}</span>
                      <b style="color:#b91c1c;">-৳${esc(formatCurrency(discount))}</b>
                    </div>`
                  : ''
              }

              ${
                shipping > 0
                  ? `<div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed #e5e7eb;">
                      <span style="color:var(--muted)">Shipping</span>
                      <b>৳${esc(formatCurrency(shipping))}</b>
                    </div>`
                  : ''
              }

              <div style="display:flex; justify-content:space-between; gap:10px; padding:10px 0; margin-top:6px; border-top:1px solid var(--line); font-weight:900; color:var(--brand);">
                <span>Total</span>
                <span>৳${esc(formatCurrency(total))}</span>
              </div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:52%;">Item</th>
              <th class="center" style="width:12%;">Qty</th>
              <th class="right" style="width:18%;">Price</th>
              <th class="right" style="width:18%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="totals">
          <div class="box">
            <div class="line"><span>Subtotal</span><b>৳${esc(formatCurrency(subtotal))}</b></div>
            ${
              discount > 0
                ? `<div class="line"><span style="color:#b91c1c;">${discountLabel}</span><b style="color:#b91c1c;">-৳${esc(
                    formatCurrency(discount)
                  )}</b></div>`
                : ''
            }
            ${
              shipping > 0
                ? `<div class="line"><span>Shipping</span><b>৳${esc(formatCurrency(shipping))}</b></div>`
                : ''
            }
            <div class="grand"><span>Total</span><span>৳${esc(formatCurrency(total))}</span></div>
          </div>
        </div>

        ${
          data.notes
            ? `<div class="notes"><b style="color:var(--ink)">Notes:</b> ${esc(data.notes)}</div>`
            : ''
        }
      </div>

      <div class="footer">
        <div>Thank you for your purchase.</div>
        <div>Invoice: <b style="color:var(--ink)">${esc(data.invoiceNumber)}</b></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** ======================================================
 * 2) EMAIL VERSION (Safe escaping + improved polish)
 * =======================================================*/
export function generateEmailInvoiceHTML(data: InvoiceData): string {
  if (!data) return '<h1>No Data</h1>';

  const discountLabel = data.discountCode ? `Voucher Discount (${esc(data.discountCode)})` : 'Discount';

  const itemsHTML =
    data.items?.length > 0
      ? data.items
          .map(
            (item) => `
    <tr>
      <td style="padding:10px; border-bottom:1px solid #eee; font-family: Arial, sans-serif; color:#0f172a;">
        <b>${esc(item.name)}</b>
      </td>
      <td style="padding:10px; border-bottom:1px solid #eee; text-align:center; font-family: Arial, sans-serif; color:#0f172a;">
        ${esc(item.quantity)}
      </td>
      <td style="padding:10px; border-bottom:1px solid #eee; text-align:right; font-family: Arial, sans-serif; color:#0f172a;">
        ৳${esc(formatCurrency(item.price))}
      </td>
      <td style="padding:10px; border-bottom:1px solid #eee; text-align:right; font-family: Arial, sans-serif; color:#0f172a;">
        <b>৳${esc(formatCurrency(item.total))}</b>
      </td>
    </tr>
  `
          )
          .join('')
      : `
    <tr>
      <td colspan="4" style="padding:14px; color:#64748b; font-family: Arial, sans-serif;">
        No items found.
      </td>
    </tr>
  `;

  const subtotal = safeNum(data.subtotal);
  const discount = safeNum(data.discountAmount);
  const shipping = safeNum(data.shippingCost);
  const total = safeNum(data.totalAmount);

  const payMethod = String(data.payment?.method || 'Cash on Delivery');
  const payTrx = String(data.payment?.trxId || '').trim();
  const showTrx = payMethod.toLowerCase().includes('bkash') && !!payTrx;

  // Emails generally need an absolute URL for images.
  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  const LOGO_URL = SITE_URL ? `${SITE_URL}/header.png` : '/header.png';
  const BRAND_PHONE = '+8809638371951';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${esc(data.invoiceNumber)}</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: Arial, sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    Your invoice ${esc(data.invoiceNumber)} is ready.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:10px; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:20px 26px; border-bottom:3px solid #1e3a8a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top">
                    <img src="${esc(LOGO_URL)}" alt="Spraxe" width="160" style="display:block; border:0; outline:none; text-decoration:none; margin-bottom:8px;" />
                    <div style="color:#64748b; font-size:13px; line-height:1.5; font-weight:700;">
                      ${esc(BRAND_PHONE)}
                    </div>
                  </td>
                  <td valign="top" align="right">
                    <div style="margin:0; font-size:22px; color:#1e3a8a; font-weight:900; letter-spacing:.02em;">INVOICE</div>
                    <div style="margin-top:6px; font-size:14px; color:#0f172a; font-weight:800;">${esc(
                      data.invoiceNumber
                    )}</div>
                    <div style="margin-top:4px; font-size:12px; color:#64748b;">
                      Issue: ${esc(data.issueDate)}<br/>
                      Due: ${esc(data.dueDate)}<br/>
                      <b style="color:#0f172a;">Payment:</b> ${esc(payMethod)}
                      ${showTrx ? `<br/><b style="color:#0f172a;">TRX:</b> ${esc(payTrx)}` : ''}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bill To -->
          <tr>
            <td style="padding:22px 26px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:10px; border-left:4px solid #1e3a8a;">
                <tr>
                  <td style="padding:16px 16px;">
                    <div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; font-weight:800;">Bill To</div>
                    <div style="margin-top:6px; font-size:16px; font-weight:900; color:#0f172a;">${esc(
                      data.customer.name
                    )}</div>
                    <div style="margin-top:4px; color:#0f172a; font-size:13px;">${esc(
                      data.customer.phone
                    )}</div>
                    <div style="margin-top:6px; color:#64748b; font-size:13px; line-height:1.45;">${esc(
                      data.customer.address
                    )}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:0 26px 12px 26px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th align="left" style="padding:12px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#475569;">Item</th>
                    <th align="center" style="padding:12px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#475569;">Qty</th>
                    <th align="right" style="padding:12px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#475569;">Price</th>
                    <th align="right" style="padding:12px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#475569;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding: 0 26px 22px 26px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="55%"></td>
                  <td width="45%">
                    <table width="100%" cellpadding="6" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:10px;">
                      <tr>
                        <td style="color:#64748b; font-size:13px;">Subtotal</td>
                        <td align="right" style="font-weight:800; color:#0f172a;">৳${esc(
                          formatCurrency(subtotal)
                        )}</td>
                      </tr>

                      ${
                        discount > 0
                          ? `<tr>
                              <td style="color:#b91c1c; font-size:13px;">${discountLabel}</td>
                              <td align="right" style="font-weight:900; color:#b91c1c;">-৳${esc(
                                formatCurrency(discount)
                              )}</td>
                            </tr>`
                          : ''
                      }

                      ${
                        shipping > 0
                          ? `<tr>
                              <td style="color:#64748b; font-size:13px;">Shipping</td>
                              <td align="right" style="font-weight:800; color:#0f172a;">৳${esc(
                                formatCurrency(shipping)
                              )}</td>
                            </tr>`
                          : ''
                      }

                      <tr>
                        <td style="padding-top:10px; border-top:2px solid #1e3a8a; color:#1e3a8a; font-weight:900; font-size:14px;">
                          Total
                        </td>
                        <td align="right" style="padding-top:10px; border-top:2px solid #1e3a8a; color:#1e3a8a; font-weight:900; font-size:14px;">
                          ৳${esc(formatCurrency(total))}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                data.notes
                  ? `<div style="margin-top:14px; color:#64748b; font-size:12px; line-height:1.5;">
                      <b style="color:#0f172a;">Notes:</b> ${esc(data.notes)}
                    </div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:18px 26px; border-top:1px solid #eee; color:#94a3b8; font-size:12px;">
              Thank you for shopping with Spraxe!
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
