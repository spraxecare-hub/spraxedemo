// lib/supabase/server.ts
// Public (anon) Supabase client for SERVER usage (RSC, route handlers, sitemap/robots).
// Do NOT use the Service Role key here.

import { createClient } from '@supabase/supabase-js';

type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey, serviceRoleKey: serviceRoleKey || undefined };
}

function missingEnvClient(label: string) {
  const err = new Error(
    `[${label}] Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment (.env.local).`
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

/**
 * Creates a Supabase client suitable for server-side rendering and server-only files.
 * This uses the public anon key, so it respects RLS.
 */
const SUPABASE_FETCH_TIMEOUT_MS = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS || 12000);

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const hasSignal = Boolean(init?.signal);
  const signal = hasSignal ? init!.signal : AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS);
  return fetch(input as any, { ...(init || {}), signal });
}

export function createServerSupabase() {
  const env = getSupabaseEnv();
  if (!env) return missingEnvClient('createServerSupabase');

  return createClient(env.url, env.anonKey, {
    global: { fetch: fetchWithTimeout as any },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Server-only Supabase client for PUBLIC content reads.
 *
 * Why:
 * - Public pages (like /blog) run without an authenticated user session.
 * - If your `blogs` table has RLS enabled without a public read policy,
 *   anon reads will return empty.
 *
 * Recommended:
 * - Add an RLS policy that allows `select` where `is_published = true`.
 *
 * Fallback:
 * - If you set `SUPABASE_SERVICE_ROLE_KEY` on the server, this will use it
 *   ONLY for public content queries.
 */
export function createServerSupabasePublicRead() {
  const env = getSupabaseEnv();
  if (!env) return missingEnvClient('createServerSupabasePublicRead');

  const key = env.serviceRoleKey || env.anonKey;

  return createClient(env.url, key, {
    global: { fetch: fetchWithTimeout as any },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSiteUrl(): string {
  const normalize = (value: string) => {
    const v = String(value || '').trim().replace(/\/$/, '');
    if (!v) return '';
    // Ensure we always return a valid absolute URL.
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    // If someone configured only a host (example.com), default to https.
    return `https://${v}`;
  };

  // Prefer explicit configuration
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.RENDER_EXTERNAL_URL;

  if (explicit) return normalize(explicit);

  // Common platform-provided hostnames
  const vercel = process.env.VERCEL_URL;
  if (vercel) return normalize(`https://${vercel}`);

  const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME;
  if (renderHost) return normalize(`https://${renderHost}`);

  // Local/dev fallback
  return 'http://localhost:3000';
}
