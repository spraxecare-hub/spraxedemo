import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import TrackOrderClient from './track-order-client';

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Check the status of your order.',
  alternates: { canonical: '/track-order' },
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function first(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

export default function TrackOrderPage({ searchParams }: PageProps) {
  const orderNumber = first(searchParams?.orderNumber) || first(searchParams?.order);
  const contact = first(searchParams?.contact);
  const success = first(searchParams?.success) === '1';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />
      <main className="flex-1">
        <TrackOrderClient initialOrderNumber={orderNumber} initialContact={contact} showSuccessToast={success} />
      </main>
      <Footer />
    </div>
  );
}
