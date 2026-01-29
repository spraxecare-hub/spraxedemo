import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Apple Accessories in Bangladesh | Chargers, Cables, Adapters & More',
  description:
    'Shop Apple accessories in Bangladesh — USB‑C hubs, chargers, cables, adapters and docks with fast delivery and warranty support.',
  keywords: [
    'Apple accessories Bangladesh',
    'Apple charger price in BD',
    'USB-C hub for MacBook',
    'Apple cable Bangladesh',
    'MacBook adapter Bangladesh',
  ],
  alternates: { canonical: '/apple-accessories' },
};

export default function AppleAccessoriesPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Do you sell original Apple accessories in Bangladesh?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We list genuine Apple accessories and trusted third‑party brands. Check the product page for brand, warranty and compatibility before purchase.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which USB‑C hub is best for MacBook Pro?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Choose a hub that supports Power Delivery (PD), the ports you need (HDMI, USB‑A, SD), and the right standard (USB‑C vs Thunderbolt). Use our Compare feature to review options side‑by‑side.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do you provide warranty and returns?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Warranty and return policy depend on the product and supplier. You’ll see warranty details on each product page. Keep the box and invoice for warranty claims.',
        },
      },
    ],
  };

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <Script
          id="ld-faq-apple-accessories"
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Apple Accessories in Bangladesh</h1>
        <p className="mt-3 text-gray-700 text-lg leading-relaxed">
          Find compatible accessories for MacBook, iPhone and iPad — USB‑C hubs, adapters, chargers, cables, docks and more.
          We focus on buyer‑intent search terms and clear compatibility so customers can choose quickly.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/products?search=apple"
            className="inline-flex items-center rounded-xl bg-blue-900 px-4 py-2 text-white font-semibold hover:bg-blue-950"
          >
            Shop Apple accessories
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
          >
            Compare products
          </Link>
          <Link
            href="/products?search=usb-c%20hub"
            className="inline-flex items-center rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
          >
            USB‑C hubs
          </Link>
        </div>

        <section className="mt-10 grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold text-gray-900">USB‑C Hubs & Adapters</h2>
            <p className="mt-2 text-gray-700 text-sm">
              For MacBook Pro/Air: HDMI, USB‑A, SD card, Ethernet and Power Delivery.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/usb-c-hubs-for-macbook" className="text-blue-900 hover:underline font-medium">
                Best USB‑C hubs for MacBook →
              </Link>
              <Link href="/products?search=adapter" className="text-blue-900 hover:underline font-medium">
                Browse adapters →
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold text-gray-900">Chargers & Power</h2>
            <p className="mt-2 text-gray-700 text-sm">
              Fast charging with USB‑C PD, MagSafe options, and travel‑friendly power.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/products?search=charger" className="text-blue-900 hover:underline font-medium">
                Browse chargers →
              </Link>
              <Link href="/products?search=power%20delivery" className="text-blue-900 hover:underline font-medium">
                Power Delivery products →
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold text-gray-900">Cables & Connectivity</h2>
            <p className="mt-2 text-gray-700 text-sm">
              USB‑C, Lightning, HDMI and Thunderbolt cables with reliable performance.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/products?search=cable" className="text-blue-900 hover:underline font-medium">
                Browse cables →
              </Link>
              <Link href="/thunderbolt-docks" className="text-blue-900 hover:underline font-medium">
                Thunderbolt docks & gear →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">How to pick the right accessory</h2>
          <ul className="mt-3 list-disc pl-5 text-gray-700 space-y-2">
            <li>Check your device model (MacBook year, iPhone model) and port type (USB‑C/Thunderbolt/Lightning).</li>
            <li>Prioritize compatibility + warranty. Use Compare to review ports, price and stock side‑by‑side.</li>
            <li>For hubs/docks: look for PD wattage, display support (4K/60Hz), and needed ports (Ethernet/SD).</li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">FAQs</h2>
          <div className="mt-4 space-y-3">
            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">Do you sell original Apple accessories in Bangladesh?</summary>
              <p className="mt-2 text-gray-700">
                We list genuine Apple accessories and trusted third‑party brands. Always check brand, warranty and compatibility on the product page.
              </p>
            </details>

            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">Which USB‑C hub is best for MacBook Pro?</summary>
              <p className="mt-2 text-gray-700">
                Choose a hub with the ports you need (HDMI, USB‑A, SD), Power Delivery (PD) wattage, and the right standard (USB‑C vs Thunderbolt).
                Use Compare to decide quickly.
              </p>
            </details>

            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">Do you provide warranty and returns?</summary>
              <p className="mt-2 text-gray-700">
                Warranty and return policy depend on the product and supplier. You’ll see warranty details on each product page.
              </p>
            </details>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
