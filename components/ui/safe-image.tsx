'use client';

import * as React from 'react';
import Image, { type ImageProps } from 'next/image';

// Allowlisted remote hosts for Next/Image (OPTIONAL).
// We keep this list for future use, but by default we do NOT use next/image for remote
// to avoid runtime crashes when next.config.js images.domains / remotePatterns aren't set.
const ALLOWED_REMOTE_HOSTS = new Set<string>([
  'images.pexels.com',
  'kybgrsqqvejbvjediowo.supabase.co',
]);

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const host = new URL(supabaseUrl).hostname;
    if (host) ALLOWED_REMOTE_HOSTS.add(host);
  }
} catch {
  // ignore
}

function looksLikeHostPath(src: string): boolean {
  // e.g. example.com/path/to.jpg (no protocol)
  return /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(src);
}

function normalizeRemoteSrc(src: string): string {
  if (!src) return src;
  const s = src.trim();
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (looksLikeHostPath(s)) return `https://${s}`;
  return s;
}

function isRemoteUrl(src: string): boolean {
  if (!src) return false;
  return (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('//') ||
    looksLikeHostPath(src)
  );
}

function isSafeForNextImageRemote(src: string): boolean {
  // NOTE: Even if this returns true, next/image can still throw at runtime
  // if next.config.js does not allow the hostname. That's why remote next/image is opt-in.
  if (!src) return false;
  if (src.startsWith('data:') || src.startsWith('blob:')) return false;

  try {
    const u = new URL(src);
    return ALLOWED_REMOTE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function toProxyUrl(src: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}

type SafeImageProps = Omit<ImageProps, 'src'> & {
  src: string;
  /**
   * Opt-in: if true, we may use next/image for allowlisted remote hosts.
   * Default false to avoid client-side exceptions when Next image domains aren't configured.
   */
  preferNextImageForRemote?: boolean;
};

/**
 * SafeImage
 * - Uses next/image for local /... assets.
 * - For remote URLs:
 *   - Uses <img> with referrerPolicy="no-referrer" to bypass many hotlink blocks.
 *   - On error, falls back to /api/image-proxy (adds caching + avoids mixed content).
 * - Optional opt-in to use next/image for allowlisted remote hosts via preferNextImageForRemote.
 */
export function SafeImage({
  src,
  alt,
  fill,
  className,
  // Keep default FALSE to avoid runtime crashes if Next/Image remotePatterns/domains
  // aren't configured in the current deployment environment.
  preferNextImageForRemote = false,
  ...rest
}: SafeImageProps) {
  const normalized = React.useMemo(() => normalizeRemoteSrc(String(src ?? '')), [src]);

  // 1) Local assets: always safe for next/image
  const isLocal = normalized.startsWith('/');

  // 2) Remote: default to <img> to avoid Next/Image domain config crashes
  const remoteOkForNextImage =
    preferNextImageForRemote && isRemoteUrl(normalized) && isSafeForNextImageRemote(normalized);

  if (isLocal || remoteOkForNextImage) {
    // For local, Next.js optimizes safely.
    // For remote, ONLY if user opted in and host is allowlisted.
    const { unoptimized, ...imgRest } = rest as any;

    return (
      <Image
        src={normalized}
        alt={alt}
        fill={fill}
        className={className}
        unoptimized={unoptimized}
        {...imgRest}
      />
    );
  }

  // For <img>, strip next/image-only props to avoid passing invalid DOM attributes.
  const {
    width,
    height,
    loading,
    quality,
    priority,
    placeholder,
    blurDataURL,
    loader,
    unoptimized,
    onLoadingComplete,
    onError,
    ...imgRest
  } = rest as any;

  // If site is https and the image is http, direct loading will be blocked (mixed content),
  // so start with proxy immediately.
  const initial = React.useMemo(() => {
    if (!normalized) return '';
    if (isRemoteUrl(normalized) && typeof window !== 'undefined') {
      const isHttpsPage = window.location.protocol === 'https:';
      if (isHttpsPage && normalized.startsWith('http://')) {
        return toProxyUrl(normalized);
      }
    }
    return normalized;
  }, [normalized]);

  const [imgSrc, setImgSrc] = React.useState<string>(initial);
  React.useEffect(() => {
    setImgSrc(initial);
  }, [initial]);

  const didProxyRef = React.useRef(false);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    // Call any consumer-provided handler too.
    try {
      onError?.(e);
    } catch {
      // ignore
    }

    if (!normalized) return;
    if (!isRemoteUrl(normalized)) return;

    if (!didProxyRef.current) {
      didProxyRef.current = true;
      setImgSrc(toProxyUrl(normalized));
    }
  };

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={imgSrc}
      alt={alt}
      loading={loading ?? 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      {...imgRest}
      onError={handleError}
      className={fill ? `absolute inset-0 h-full w-full ${className ?? ''}` : className}
    />
  );
}
