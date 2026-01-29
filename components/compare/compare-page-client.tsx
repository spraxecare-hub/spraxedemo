'use client';

import Link from 'next/link';
import { useCompare, type CompareItem } from '@/lib/compare/compare-context';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCompare, X } from 'lucide-react';

function formatBDT(n?: number | null) {
  const v = Number(n ?? 0);
  try {
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(v);
  } catch {
    return `৳${Math.round(v).toLocaleString()}`;
  }
}

function norm(s: string) {
  return s.toLowerCase().trim();
}

function inferBestFor(item: CompareItem): string[] {
  const tags = (item.tags || []).map((t) => norm(String(t)));
  const name = norm(item.name || '');

  const hits = new Set<string>();
  const has = (...words: string[]) => words.some((w) => tags.includes(norm(w)) || name.includes(norm(w)));

  if (has('mac', 'macbook', 'macbook pro', 'macbook air', 'macos')) hits.add('Mac / MacBook');
  if (has('iphone', 'ios')) hits.add('iPhone');
  if (has('ipad')) hits.add('iPad');
  if (has('airpods')) hits.add('AirPods');
  if (has('magsafe')) hits.add('MagSafe');
  if (has('thunderbolt', 'tb3', 'tb4')) hits.add('Thunderbolt');
  if (has('usb-c', 'type-c', 'usbc')) hits.add('USB‑C');
  if (has('hdmi', '4k', '8k')) hits.add('Display / HDMI');
  if (has('charger', 'charging', 'pd', 'power delivery')) hits.add('Fast Charging');
  if (!hits.size && tags.length) hits.add('General Accessories');
  return Array.from(hits);
}

function toPlainText(v: any): string {
  const s = String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

export default function ComparePageClient() {
  const { items, remove, clear } = useCompare();

  if (!items.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-2xl font-bold text-gray-900 mb-2">Compare products</div>
        <p className="text-gray-600 mb-6">Add up to 3 products to compare features, price, description, compatibility and tags.</p>
        <Link href="/products">
          <Button className="bg-blue-900 hover:bg-blue-950">Browse products</Button>
        </Link>
      </div>
    );
  }

  const rows: { label: string; render: (it: CompareItem) => React.ReactNode }[] = [
    {
      label: 'Product',
      render: (it) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden relative flex-shrink-0">
            {it.image ? <SafeImage src={it.image} alt={it.name} fill sizes="48px" className="object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <Link href={`/products/${it.slug}`} className="font-semibold text-gray-900 hover:text-blue-900 truncate block">
              {it.name}
            </Link>
            {it.sku ? <div className="text-xs text-gray-500">SKU: {it.sku}</div> : null}
          </div>
        </div>
      ),
    },
    { label: 'Price', render: (it) => <div className="font-semibold text-blue-900">{formatBDT(it.price)}</div> },
    {
      label: 'Description',
      render: (it) => {
        const plain = toPlainText(it.description);
        return plain ? <div className="text-sm text-gray-700 leading-relaxed">{plain}</div> : <span className="text-gray-400">—</span>;
      },
    },
    {
      label: 'Compatibility',
      render: (it) => {
        const best = inferBestFor(it);
        return (
          <div className="flex flex-wrap gap-2">
            {best.map((b) => (
              <Badge key={b} variant="secondary" className="bg-blue-50 text-blue-900 border border-blue-200">
                {b}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      label: 'Tags',
      render: (it) => {
        const tags = (it.tags || []).slice(0, 10);
        if (!tags.length) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border">
                {t}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-blue-900" />
            Compare products
          </h1>
          <p className="text-gray-600 mt-1">Feature, price, description, compatibility and tags — side by side.</p>
        </div>
        <Button variant="outline" className="bg-white" onClick={clear}>
          Clear all
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left text-sm font-semibold text-gray-700 p-4 w-[220px]">Feature</th>
                {items.map((it) => (
                  <th key={it.id} className="text-left p-4 align-top border-l">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/products/${it.slug}`} className="font-semibold text-gray-900 hover:text-blue-900 block truncate max-w-[240px]">
                          {it.name}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        className="rounded-full p-2 hover:bg-gray-100"
                        aria-label="Remove item"
                      >
                        <X className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b last:border-b-0">
                  <td className="p-4 text-sm font-semibold text-gray-700 bg-gray-50">{r.label}</td>
                  {items.map((it) => (
                    <td key={it.id + r.label} className="p-4 border-l align-top">
                      {r.render(it)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/products">
          <Button variant="outline" className="bg-white">
            Add more products
          </Button>
        </Link>
        <Link href="/featured">
          <Button className="bg-blue-900 hover:bg-blue-950">See featured</Button>
        </Link>
      </div>
    </div>
  );
}
