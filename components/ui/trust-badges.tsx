import * as React from 'react';
import { Truck, ShieldCheck, Headphones, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'grid' | 'compact';

type TrustBadgesProps = {
  variant?: Variant;
  className?: string;
};

/**
 * Lightweight, reusable trust badges (homepage + cart).
 * Keep copy factual (no promises about return windows, etc.)
 */
export function TrustBadges({ variant = 'grid', className }: TrustBadgesProps) {
  const items = [
    {
      title: 'Secure checkout',
      desc: 'Safe payments & privacy',
      Icon: ShieldCheck,
    },
    {
      title: 'Cash on Delivery',
      desc: 'Pay at your doorstep',
      Icon: Banknote,
    },
    {
      title: 'Fast delivery',
      desc: 'Dhaka & nationwide',
      Icon: Truck,
    },
    {
      title: 'Customer support',
      desc: 'We’re here to help',
      Icon: Headphones,
    },
  ] as const;

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'grid grid-cols-2 gap-2 rounded-xl border bg-white p-3',
          className
        )}
      >
        {items.slice(0, 4).map(({ title, desc, Icon }) => (
          <div
            key={title}
            className="flex items-center gap-2 rounded-lg border bg-gray-50/60 px-2.5 py-2"
          >
            <div className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center text-blue-900">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-gray-900 leading-tight truncate">
                {title}
              </div>
              <div className="text-[11px] text-gray-500 leading-tight truncate">
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 md:grid-cols-4 gap-3',
        className
      )}
    >
      {items.map(({ title, desc, Icon }) => (
        <div
          key={title}
          className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-blue-900">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-gray-900 leading-tight truncate">
              {title}
            </div>
            <div className="text-xs text-gray-500 leading-tight truncate">
              {desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
