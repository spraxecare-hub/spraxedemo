'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function GAEvents() {
  const pathname = usePathname();

  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_GA_ID;
    if (!id) return;

    const search = window.location.search || '';
    const url = `${pathname}${search}`;

    window.gtag?.('config', id, { page_path: url });
  }, [pathname]);

  return null;
}
