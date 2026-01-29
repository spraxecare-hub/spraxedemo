import type { Metadata } from 'next';
import ComparePageClient from '@/components/compare/compare-page-client';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Compare Products',
  description: 'Compare up to 3 products side-by-side by price, stock, specs and compatibility.',
  alternates: { canonical: '/compare' },
};

export default function ComparePage() {
  return (
    <>
      <Header />
      <ComparePageClient />
      <Footer />
    </>
  );
}
