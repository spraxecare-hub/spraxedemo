'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Package, ShoppingBag, Truck, XCircle } from 'lucide-react';

function fmtShortDate(v?: string | null) {
  if (!v) return '';
  try {
    return new Date(v).toLocaleDateString('en-BD', { month: 'short', day: '2-digit' });
  } catch {
    return String(v);
  }
}

type Props = {
  status?: string | null;
  createdAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
};

export function OrderStatusTimeline({ status, createdAt, shippedAt, deliveredAt }: Props) {
  const s = String(status || 'pending').toLowerCase();

  const isCancelled = ['cancelled', 'canceled', 'refunded'].includes(s);

  if (isCancelled) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-red-50 text-red-700 border border-red-200">CANCELLED</Badge>
          <div className="text-sm text-gray-700">This order was cancelled.</div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ShoppingBag className="h-4 w-4 text-gray-500" />
            Placed <span className="text-xs font-normal text-gray-500">{fmtShortDate(createdAt)}</span>
          </div>
          <div className="h-px flex-1 bg-gray-200" />
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <XCircle className="h-4 w-4" />
            Cancelled
          </div>
        </div>
      </div>
    );
  }

  const placedDone = true;
  const processingDone = !['pending'].includes(s);
  const shippedDone = ['shipped', 'delivered'].includes(s) || !!shippedAt;
  const deliveredDone = ['delivered'].includes(s) || !!deliveredAt;

  const steps = [
    {
      key: 'placed',
      label: 'Placed',
      icon: ShoppingBag,
      done: placedDone,
      date: fmtShortDate(createdAt),
    },
    {
      key: 'processing',
      label: 'Processing',
      icon: Package,
      done: processingDone,
      date: processingDone ? fmtShortDate(createdAt) : '',
    },
    {
      key: 'shipped',
      label: 'Shipped',
      icon: Truck,
      done: shippedDone,
      date: fmtShortDate(shippedAt),
    },
    {
      key: 'delivered',
      label: 'Delivered',
      icon: CheckCircle2,
      done: deliveredDone,
      date: fmtShortDate(deliveredAt),
    },
  ];

  const activeIndex = steps.findIndex((x) => !x.done);
  const active = activeIndex === -1 ? steps.length - 1 : Math.max(0, activeIndex);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm font-extrabold text-gray-900">Order progress</div>
      <div className="text-xs text-gray-500 mt-1">Updates as soon as the courier picks up your package.</div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === active;
          const isDone = step.done;

          return (
            <div key={step.key} className="relative">
              <div
                className={[
                  'rounded-xl border px-3 py-3 flex items-start gap-2 transition-colors',
                  isDone ? 'bg-emerald-50/40 border-emerald-200' : isActive ? 'bg-blue-50 border-blue-200' : 'bg-white',
                ].join(' ')}
              >
                <div
                  className={[
                    'mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center border',
                    isDone
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isActive
                        ? 'bg-blue-900 border-blue-900 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-600',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{step.label}</div>
                  <div className="text-[11px] text-gray-500">
                    {step.date ? step.date : isDone ? 'Done' : isActive ? 'In progress' : 'Pending'}
                  </div>
                </div>

                {!isDone && isActive && (
                  <div className="ml-auto">
                    <Clock className="h-4 w-4 text-blue-900" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
