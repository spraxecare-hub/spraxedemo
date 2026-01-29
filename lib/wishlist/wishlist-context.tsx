'use client';

import * as React from 'react';

type WishlistContextValue = {
  ids: string[];
  count: number;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  toggle: (id: string) => void;
  isInWishlist: (id: string) => boolean;
};

const WishlistContext = React.createContext<WishlistContextValue | null>(null);

// Keep compatibility with existing localStorage key used in product detail
const STORAGE_KEY = 'wishlist_product_ids';
const MAX_ITEMS = 200;

function safeParseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const ids = v
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    // De-dupe while preserving order
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = React.useState<string[]>([]);

  // Load once
  React.useEffect(() => {
    try {
      setIds(safeParseIds(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      setIds([]);
    }
  }, []);

  // Persist
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
  }, [ids]);

  // Cross-tab sync (and also picks up any legacy writes)
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setIds(safeParseIds(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = React.useMemo<WishlistContextValue>(() => {
    const isInWishlist = (id: string) => ids.includes(id);
    const add = (id: string) => {
      const clean = String(id || '').trim();
      if (!clean) return;
      setIds((prev) => (prev.includes(clean) ? prev : [clean, ...prev]).slice(0, MAX_ITEMS));
    };
    const remove = (id: string) => {
      const clean = String(id || '').trim();
      if (!clean) return;
      setIds((prev) => prev.filter((x) => x !== clean));
    };
    const clear = () => setIds([]);
    const toggle = (id: string) => {
      const clean = String(id || '').trim();
      if (!clean) return;
      setIds((prev) => {
        if (prev.includes(clean)) return prev.filter((x) => x !== clean);
        return [clean, ...prev].slice(0, MAX_ITEMS);
      });
    };

    return {
      ids,
      count: ids.length,
      add,
      remove,
      clear,
      toggle,
      isInWishlist,
    };
  }, [ids]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = React.useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
