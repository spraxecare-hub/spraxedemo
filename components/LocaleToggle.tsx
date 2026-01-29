'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

function getLocale(pathname: string) {
  const m = pathname.match(/^\/(bn|en)(\/|$)/);
  return (m?.[1] as 'bn' | 'en') || 'bn';
}

function replaceLocale(pathname: string, nextLocale: 'bn' | 'en') {
  const rest = pathname.replace(/^\/(bn|en)(?=\/|$)/, '');
  return `/${nextLocale}${rest || ''}`;
}

export default function LocaleToggle() {
  const pathname = usePathname();
  const current = getLocale(pathname);
  const next = current === 'bn' ? 'en' : 'bn';

  return (
    <Link
      href={replaceLocale(pathname, next)}
      className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-gray-50"
    >
      <span className={current === 'en' ? 'text-blue-700' : 'text-gray-500'}>EN</span>
      <span className="text-gray-300">/</span>
      <span className={current === 'bn' ? 'text-blue-700' : 'text-gray-500'}>BN</span>
    </Link>
  );
}
