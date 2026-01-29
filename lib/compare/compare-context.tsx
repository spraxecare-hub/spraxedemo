'use client';

import * as React from 'react';

export type CompareItem = {
  id: string;
  slug: string;
  name: string;
  image?: string | null;
  description?: string | null;
  price?: number | null;
  retail_price?: number | null;
  stock_quantity?: number | null;
  supplier_name?: string | null;
  sku?: string | null;
  tags?: string[] | null;
};

type CompareContextValue = {
  items: CompareItem[];
  add: (item: CompareItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  toggle: (item: CompareItem) => void;
  isInCompare: (id: string) => boolean;
  maxItems: number;
  canAddMore: boolean;
};

const CompareContext = React.createContext<CompareContextValue | null>(null);

const STORAGE_KEY = 'spraxe_compare_v1';
const MAX_ITEMS = 3;

function safeParse(json: string): CompareItem[] {
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v
      .filter(Boolean)
      .map((x: any) => ({
        id: String(x.id),
        slug: String(x.slug),
        name: String(x.name),
        image: x.image ?? null,
        description: x.description ?? null,
        price: x.price ?? null,
        retail_price: x.retail_price ?? null,
        stock_quantity: x.stock_quantity ?? null,
        supplier_name: x.supplier_name ?? null,
        sku: x.sku ?? null,
        tags: Array.isArray(x.tags) ? x.tags.map(String) : null,
      }))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CompareItem[]>([]);

  // Load once
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(safeParse(raw));
    } catch {}
  }, []);

  // Persist
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const value = React.useMemo<CompareContextValue>(() => {
    const isInCompare = (id: string) => items.some((x) => x.id === id);

    const add = (item: CompareItem) => {
      setItems((prev) => {
        if (prev.some((x) => x.id === item.id)) return prev;
        if (prev.length >= MAX_ITEMS) return prev; // keep simple; UI can hint
        return [...prev, item];
      });
    };

    const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

    const clear = () => setItems([]);

    const toggle = (item: CompareItem) => {
      setItems((prev) => {
        if (prev.some((x) => x.id === item.id)) return prev.filter((x) => x.id !== item.id);
        if (prev.length >= MAX_ITEMS) return prev;
        return [...prev, item];
      });
    };

    return {
      items,
      add,
      remove,
      clear,
      toggle,
      isInCompare,
      maxItems: MAX_ITEMS,
      canAddMore: items.length < MAX_ITEMS,
    };
  }, [items]);

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = React.useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within CompareProvider');
  return ctx;
}
