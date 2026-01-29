'use client';

import Link from 'next/link';
import { useCompare } from '@/lib/compare/compare-context';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/button';
import { X, GitCompare } from 'lucide-react';

export function CompareBar() {
  const { items, remove, clear, maxItems } = useCompare();

  if (!items.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">
          Compare ({items.length}/{maxItems})
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 rounded-full border bg-white px-2 py-1">
                <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-100 relative">
                  {it.image ? (
                    <SafeImage src={it.image} alt={it.name} fill sizes="28px" className="object-cover" />
                  ) : null}
                </div>
                <div className="text-xs max-w-[140px] truncate">{it.name}</div>
                <button
                  type="button"
                  aria-label="Remove from compare"
                  onClick={() => remove(it.id)}
                  className="rounded-full p-1 hover:bg-gray-100"
                >
                  <X className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-white" onClick={clear}>
            Clear
          </Button>
          <Link href="/compare">
            <Button size="sm" className="bg-blue-900 hover:bg-blue-950">
              <GitCompare className="mr-2 h-4 w-4" />
              Compare
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
