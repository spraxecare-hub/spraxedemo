// lib/site-url.server.ts
// Utilities to compute the *current request* origin safely behind proxies/CDNs.
// This helps when your app is reachable from multiple domains (Render default URL, custom domain, etc.).
//
// IMPORTANT: This file is server-only.

import 'server-only';
import { headers } from 'next/headers';

function firstHeaderValue(value: string | null): string {
  if (!value) return '';
  // Some proxies send comma-separated values (e.g., "https, http").
  return value.split(',')[0]?.trim() || '';
}

function ensureProtocol(urlOrHost: string): string {
  const v = (urlOrHost || '').trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  // If someone provided only host (example.com), default to https.
  return `https://${v}`;
}

/**
 * Best-effort origin for the *incoming request*.
 *
 * Order:
 * 1) x-forwarded-proto + x-forwarded-host
 * 2) host (assume https)
 * 3) fallbackOrigin
 */
export function getRequestOrigin(fallbackOrigin: string): string {
  const h = headers();

  const proto = firstHeaderValue(h.get('x-forwarded-proto')) || 'https';
  const forwardedHost = firstHeaderValue(h.get('x-forwarded-host'));
  const host = forwardedHost || firstHeaderValue(h.get('host'));

  if (host) {
    // If host already contains scheme (rare), normalize.
    const maybeUrl = ensureProtocol(host);
    try {
      const u = new URL(maybeUrl);
      // If host was just a hostname without scheme, ensureProtocol added https://.
      // But we still want to respect proto from headers when provided.
      const scheme = proto || u.protocol.replace(':', '') || 'https';
      return `${scheme}://${u.host}`.replace(/\/$/, '');
    } catch {
      // If host is malformed, fall back.
    }
  }

  return ensureProtocol(fallbackOrigin).replace(/\/$/, '');
}

/**
 * Turns an origin string into a safe URL object.
 * If the origin is invalid, falls back to http://localhost:3000.
 */
export function toSafeUrl(origin: string): URL {
  const normalized = ensureProtocol(origin).replace(/\/$/, '');
  try {
    return new URL(normalized);
  } catch {
    return new URL('http://localhost:3000');
  }
}
