import type { Metadata } from 'next';
import WishlistPageClient from '@/components/wishlist/wishlist-page-client';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Wishlist',
  description: 'Your saved products. Add items to your cart anytime.',
  alternates: { canonical: '/wishlist' },
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh] bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <WishlistPageClient />
      </main>
      <Footer />
    </>
  );
}
