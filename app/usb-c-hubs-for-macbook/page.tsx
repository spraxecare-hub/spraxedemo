import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'USB‑C Hubs for MacBook Pro & Air (Bangladesh) | 2025 Compatibility Guide',
  description:
    'Find the best USB‑C hubs for MacBook Pro/Air in Bangladesh. Compare ports, PD charging, 4K HDMI support, price and stock.',
  keywords: [
    'USB-C hub for MacBook Pro',
    'USB-C hub for MacBook Air',
    'USB-C adapter Bangladesh',
    'MacBook hub price in BD',
    '4K HDMI USB-C hub',
  ],
  alternates: { canonical: '/usb-c-hubs-for-macbook' },
};

export default function UsbCHubsForMacbookPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'USB‑C vs Thunderbolt: which one do I need?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'USB‑C is the connector; Thunderbolt is a faster standard that also uses USB‑C. If you need multiple displays or maximum performance, pick Thunderbolt. Otherwise a quality USB‑C hub is enough for most users.',
        },
      },
      {
        '@type': 'Question',
        name: 'What PD (Power Delivery) wattage should I choose?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'For MacBook Air, 45–65W is usually enough. For MacBook Pro, aim for 65–100W depending on your model. Check your laptop charger wattage and choose a hub that supports it.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I compare hubs quickly?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Use our Compare feature to add up to 3 hubs and review ports, price, stock and compatibility side‑by‑side.',
        },
      },
    ],
  };

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <Script
          id="ld-faq-usb-c-hubs"
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">USB‑C Hubs for MacBook Pro & Air</h1>
        <p className="mt-3 text-gray-700 text-lg leading-relaxed">
          Pick the right hub based on ports, charging (PD), display output and your MacBook model. This page is built for buyer‑intent SEO
          like “USB‑C hub for MacBook Pro” in Bangladesh.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/products?search=usb-c%20hub"
            className="inline-flex items-center rounded-xl bg-blue-900 px-4 py-2 text-white font-semibold hover:bg-blue-950"
          >
            Browse USB‑C hubs
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
          >
            Compare hubs
          </Link>
          <Link
            href="/thunderbolt-docks"
            className="inline-flex items-center rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
          >
            Need Thunderbolt?
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">What to look for</h2>
          <div className="mt-3 grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border bg-white p-5">
              <h3 className="font-bold text-gray-900">Ports & displays</h3>
              <p className="mt-2 text-gray-700 text-sm">
                Common needs: HDMI 4K, USB‑A for mouse/keyboard, SD card for photos, and Ethernet for stable internet.
              </p>
            </div>
            <div className="rounded-2xl border bg-white p-5">
              <h3 className="font-bold text-gray-900">Charging (Power Delivery)</h3>
              <p className="mt-2 text-gray-700 text-sm">
                Choose PD wattage close to your charger. A hub should support pass‑through charging so you can use one port for everything.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">Quick picks</h2>
          <p className="mt-2 text-gray-700">
            Start with these searches and then compare similar products side‑by‑side:
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/products?search=4k%20hdmi%20usb-c%20hub" className="text-blue-900 hover:underline font-medium">
              4K HDMI USB‑C hubs →
            </Link>
            <Link href="/products?search=usb-c%20hub%20ethernet" className="text-blue-900 hover:underline font-medium">
              USB‑C hubs with Ethernet →
            </Link>
            <Link href="/products?search=usb-c%20hub%20sd%20card" className="text-blue-900 hover:underline font-medium">
              USB‑C hubs with SD card →
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">FAQs</h2>
          <div className="mt-4 space-y-3">
            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">USB‑C vs Thunderbolt: which one do I need?</summary>
              <p className="mt-2 text-gray-700">
                USB‑C is the connector; Thunderbolt is a faster standard that also uses USB‑C. For multiple displays and maximum performance, pick Thunderbolt.
                Otherwise a quality USB‑C hub is enough for most users.
              </p>
            </details>

            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">What PD (Power Delivery) wattage should I choose?</summary>
              <p className="mt-2 text-gray-700">
                MacBook Air: 45–65W. MacBook Pro: 65–100W depending on model. Check your charger wattage and choose a hub that supports it.
              </p>
            </details>

            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">How do I compare hubs quickly?</summary>
              <p className="mt-2 text-gray-700">
                Add up to 3 hubs using the Compare button on product cards or product pages, then open the Compare page from the bottom bar.
              </p>
            </details>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
