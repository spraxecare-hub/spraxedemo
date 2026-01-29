import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Thunderbolt Docks in Bangladesh | Multi‑Display & Pro Setup (2025)',
  description:
    'Shop Thunderbolt docks in Bangladesh for MacBook and pro workstations. Compare bandwidth, ports, multi‑display support, price and stock.',
  keywords: [
    'Thunderbolt dock Bangladesh',
    'Thunderbolt 4 dock',
    'MacBook Thunderbolt dock',
    'multi display dock',
    'Thunderbolt hub price BD',
  ],
  alternates: { canonical: '/thunderbolt-docks' },
};

export default function ThunderboltDocksPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'When should I choose a Thunderbolt dock over a USB‑C hub?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Choose Thunderbolt when you need the highest bandwidth, multiple high‑resolution displays, faster storage, or a single‑cable workstation setup. For lighter use, a USB‑C hub is often enough.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do Thunderbolt docks work with USB‑C ports?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Many Thunderbolt docks can work with USB‑C devices in a limited mode, but full features (bandwidth / displays) require a Thunderbolt-enabled port.',
        },
      },
      {
        '@type': 'Question',
        name: 'How can I confirm compatibility with my MacBook?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Check your MacBook model/year and whether the port supports Thunderbolt 3/4. Use product tags and our Compare feature to verify ports, charging wattage and display support.',
        },
      },
    ],
  };

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <Script
          id="ld-faq-thunderbolt"
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">Thunderbolt Docks in Bangladesh</h1>
        <p className="mt-3 text-gray-700 text-lg leading-relaxed">
          Build a one‑cable workstation: connect displays, Ethernet, storage and charging through a single Thunderbolt cable.
          Ideal for MacBook Pro users, creators and office setups.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/products?search=thunderbolt%20dock"
            className="inline-flex items-center rounded-xl bg-blue-900 px-4 py-2 text-white font-semibold hover:bg-blue-950"
          >
            Browse Thunderbolt docks
          </Link>
          <Link href="/compare" className="inline-flex items-center rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50">
            Compare docks
          </Link>
          <Link
            href="/usb-c-hubs-for-macbook"
            className="inline-flex items-center rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50"
          >
            USB‑C hubs guide
          </Link>
        </div>

        <section className="mt-10 grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-bold text-gray-900">Best for</h2>
            <ul className="mt-3 list-disc pl-5 text-gray-700 space-y-2">
              <li>Dual/quad display setups</li>
              <li>Creators: fast SSDs + card readers</li>
              <li>Office: Ethernet + peripherals + charging</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-bold text-gray-900">Key specs to compare</h2>
            <ul className="mt-3 list-disc pl-5 text-gray-700 space-y-2">
              <li>Thunderbolt 3 vs Thunderbolt 4</li>
              <li>Display support (4K/60Hz, number of monitors)</li>
              <li>Charging wattage (PD)</li>
              <li>Ports: USB‑A, USB‑C, Ethernet, SD, audio</li>
            </ul>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">FAQs</h2>
          <div className="mt-4 space-y-3">
            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">When should I choose a Thunderbolt dock over a USB‑C hub?</summary>
              <p className="mt-2 text-gray-700">
                Choose Thunderbolt for the highest bandwidth, multiple high‑resolution displays, and a true one‑cable workstation. USB‑C hubs are great for everyday peripherals.
              </p>
            </details>

            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">Do Thunderbolt docks work with USB‑C ports?</summary>
              <p className="mt-2 text-gray-700">
                Many can work with USB‑C devices in a limited mode. Full features usually require a Thunderbolt‑enabled port.
              </p>
            </details>

            <details className="rounded-xl border bg-white p-4">
              <summary className="font-semibold cursor-pointer">How can I confirm compatibility with my MacBook?</summary>
              <p className="mt-2 text-gray-700">
                Check your MacBook model/year and Thunderbolt support. On product pages, review tags and use Compare to verify ports, charging wattage and display support.
              </p>
            </details>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
