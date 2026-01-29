import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-16">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-blue-900">404</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Page not found</h1>
            <p className="mt-2 text-sm text-gray-600">
              The page you’re looking for doesn’t exist or may have moved.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button asChild className="rounded-xl">
                <Link href="/" className="inline-flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Go home
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/products" className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Browse products
                </Link>
              </Button>
            </div>

            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
