// lib/supabase/admin.ts
// Server-only Supabase admin client (Service Role Key). Bypasses RLS.
//
// IMPORTANT:
// - This file is imported by route handlers (e.g., /api/place-order).
// - Throwing at import-time would break builds and local dev even for pages
//   that never hit those endpoints.
//
// Therefore we export a *safe* admin client that throws a clear error only
// when it is actually used.

import { createClient } from '@supabase/supabase-js';

function missingEnvProxy(label: string) {
  const err = new Error(
    `[${label}] Supabase admin is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.`
  );

  return new Proxy(
    {},
    {
      get() {
        throw err;
      },
      apply() {
        throw err;
      },
    }
  ) as any;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a client with the Service Role Key (Bypasses RLS)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : missingEnvProxy('supabaseAdmin');
