import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Seller Portal',
    template: '%s | Seller Portal',
  },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
