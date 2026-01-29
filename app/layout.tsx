// app/layout.tsx

import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { Suspense } from 'react';
import { AuthProvider } from '@/lib/auth/auth-context';
import { CartProvider } from '@/lib/cart/cart-context';
import { CompareProvider } from '@/lib/compare/compare-context';
import { WishlistProvider } from '@/lib/wishlist/wishlist-context';
import { Toaster } from '@/components/ui/toaster';
import { FloatingCartButton } from '@/components/cart/floating-cart-button';
import { CompareBar } from '@/components/compare/compare-bar';
import GAEvents from '@/components/GAEvents';
import { getSiteUrl } from '@/lib/supabase/server';
import { getRequestOrigin, toSafeUrl } from '@/lib/site-url.server';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-XXXXXXXXXX';

// Performance: warm up connections to Supabase (storage + rest) to speed up
// first-image and first-data load on cold clients.
let SUPABASE_ORIGIN: string | null = null;
try {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (u) SUPABASE_ORIGIN = new URL(u).origin;
} catch {
  SUPABASE_ORIGIN = null;
}

export async function generateMetadata(): Promise<Metadata> {
  // Prefer request-derived origin (works for both Render default URL and custom domains).
  // Fallback to env-based configuration.
  const base = getRequestOrigin(getSiteUrl());
  const metadataBase = toSafeUrl(base);

  return {
    title: {
      default: 'Spraxe Bangladesh — Apple Accessories, Gadgets & Computer Accessories',
      template: '%s | Spraxe Bangladesh',
    },
    description:
      'Buy Apple accessories, USB‑C hubs, adapters, chargers, cables, docks and gadgets in Bangladesh. Fast delivery, warranty support, and secure checkout.',
    keywords: [
      'Apple accessories Bangladesh',
      'Apple gadget shop BD',
      'USB-C hub price in BD',
      'Thunderbolt dock Bangladesh',
      'MacBook adapter Bangladesh',
      'iPhone accessories Bangladesh',
      'computer accessories Bangladesh',
    ],
    applicationName: 'Spraxe',
    metadataBase,
    openGraph: {
      type: 'website',
      siteName: 'Spraxe Bangladesh',
      title: 'Spraxe Bangladesh — Apple Accessories, Gadgets & Computer Accessories',
      description:
        'Shop Apple accessories and gadgets in Bangladesh — USB‑C hubs, adapters, chargers, cables and docks with fast delivery and warranty support.',
      url: '/',
      images: [
        {
          url: '/og.png',
          width: 1200,
          height: 630,
          alt: 'Spraxe Bangladesh — Apple Accessories, Gadgets & Computer Accessories',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Spraxe Bangladesh — Apple Accessories, Gadgets & Computer Accessories',
      description:
        'Apple accessories & gadgets in Bangladesh — USB‑C hubs, adapters, chargers, cables and docks with fast delivery & warranty.',
      images: ['/og.png'],
    },
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      other: [{ rel: 'mask-icon', url: '/favicon.ico' }],
    },
    manifest: '/site.webmanifest',
    themeColor: '#0b1f4a',
  };
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteOrigin = getRequestOrigin(getSiteUrl());
  return (
    // NOTE: We intentionally avoid `next/font/google` here.
    // Some hosting/build environments block outbound access to Google Fonts,
    // which causes builds to fail.
    <html lang="en-BD" className="antialiased" suppressHydrationWarning>
      <head>
        {SUPABASE_ORIGIN ? (
          <>
            <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="" />
            <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
          </>
        ) : null}
      </head>
      <body className="min-h-screen bg-white text-gray-900 antialiased font-sans">
        {/* Skip link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg focus:ring-2 focus:ring-blue-900"
        >
          Skip to content
        </a>
        {/* ✅ Google Analytics (GA4) */}
        {GA_MEASUREMENT_ID && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX' && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
              `}
            </Script>

            {/* Track client-side route changes (SPA navigation) */}
            <Suspense fallback={null}>
              <GAEvents />
            </Suspense>
          </>
        )}


        {/* ✅ Structured data for Google */}
        <Script
          id="ld-org"
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Spraxe Bangladesh',
              url: siteOrigin,
              logo: `${siteOrigin}/apple-touch-icon.png`,
            }),
          }}
        />
        <Script
          id="ld-website"
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Spraxe Bangladesh',
              url: siteOrigin,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${siteOrigin}/products?search={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />


        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <CompareProvider>
                <div id="main-content" tabIndex={-1} className="min-h-screen outline-none">
                  {children}
                </div>
                <FloatingCartButton />
                <CompareBar />
                <Toaster />
              </CompareProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}