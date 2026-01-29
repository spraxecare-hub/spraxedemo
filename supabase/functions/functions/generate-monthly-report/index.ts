// supabase/functions/generate-monthly-report/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

function monthStartISO(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`; // date string ok for Postgres date input
}

function previousMonthStart() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return monthStartISO(d);
}

function parseTargetMonth(body: any): string {
  // Accept:
  // { month: "previous" } (default)
  // { month: "2025-12" }  -> uses 2025-12-01
  // { month: "2025-12-01" }
  const m = String(body?.month ?? "previous").trim().toLowerCase();
  if (m === "previous") return previousMonthStart();

  // "YYYY-MM" -> "YYYY-MM-01"
  if (/^\d{4}-\d{2}$/.test(m)) return `${m}-01`;

  // "YYYY-MM-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m;

  // fallback
  return previousMonthStart();
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Protect this endpoint (cron + admin only)
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const body = await req.json().catch(() => ({}));
  const month_start = parseTargetMonth(body);

  const { data, error } = await supabase.rpc("generate_monthly_report", {
    month_start,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, month_start, report: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
