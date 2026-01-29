// lib/supabase/client.ts
// Browser/client Supabase client.
//
// IMPORTANT:
// - This module is imported across many client components.
// - Throwing at import-time causes the entire app to crash (even for pages that don't
//   need Supabase yet).
//
// So we create a *safe* client:
// - If env vars are present, we create the real Supabase client.
// - If not, we export a Proxy that throws a clear error only when the client is used.

import { createClient } from '@supabase/supabase-js';

function missingEnvProxy(label: string) {
  const err = new Error(
    `[${label}] Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment (.env.local).`
  );

  // Proxy to delay the failure until a method/property is actually accessed.
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : missingEnvProxy('supabase');
