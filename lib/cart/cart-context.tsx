'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';

interface ProductLite {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  stock_quantity: number;
  category_id?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
}

interface CartItem {
  id: string; // DB row id when logged in, else product_id for guests
  product_id: string;
  quantity: number;
  size?: string | null;
  product: ProductLite;
}

type GuestCartRow = { product_id: string; quantity: number; size?: string | null };

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  loading: boolean;
  addToCart: (productId: string, quantity?: number, options?: { size?: string | null }) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateItemSize: (itemId: string, size: string | null) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType>({
  items: [],
  itemCount: 0,
  subtotal: 0,
  loading: true,
  addToCart: async () => {},
  updateQuantity: async () => {},
  updateItemSize: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  refreshCart: async () => {},
});

const LS_KEY = 'cart';

const safeInt = (v: any, fallback = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const readLocalCart = (): GuestCartRow[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // sanitize
    const cleaned: GuestCartRow[] = parsed
      .map((x: any) => ({
        product_id: String(x?.product_id || ''),
        quantity: safeInt(x?.quantity, 0),
        size: x?.size ? String(x.size) : null,
      }))
      .filter((x) => x.product_id && x.quantity > 0);

    // merge duplicates (same product_id)
    const map = new Map<string, GuestCartRow>();
    for (const row of cleaned) {
      const existing = map.get(row.product_id);
      if (!existing) {
        map.set(row.product_id, { ...row });
      } else {
        map.set(row.product_id, {
          product_id: row.product_id,
          quantity: (existing.quantity || 0) + row.quantity,
          size: row.size ?? existing.size ?? null,
        });
      }
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
};

const writeLocalCart = (rows: GuestCartRow[]) => {
  const cleaned = rows
    .map((x) => ({
      product_id: String(x.product_id),
      quantity: safeInt(x.quantity, 0),
      size: x.size ? String(x.size) : null,
    }))
    .filter((x) => x.product_id && x.quantity > 0);
  localStorage.setItem(LS_KEY, JSON.stringify(cleaned));
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Prevent state updates from stale async calls when user changes quickly
  const seqRef = useRef(0);

  /** 1) Merge guest cart → DB when user logs in (batched + robust) */
  const mergeLocalCartToDB = async (userId: string) => {
    const localRows = readLocalCart();
    if (!localRows.length) return;

    const productIds = localRows.map((r) => r.product_id);

    // Fetch existing cart items for those products (single query)
    const { data: existingRows, error: existingErr } = await supabase
      .from('cart_items')
      .select('id, product_id, quantity, size')
      .eq('user_id', userId)
      .in('product_id', productIds);

    if (existingErr) {
      // If we can’t read existing, fallback to sequential inserts/updates
      for (const row of localRows) {
        const { data: ex } = await supabase
          .from('cart_items')
          .select('id, quantity, size')
          .eq('user_id', userId)
          .eq('product_id', row.product_id)
          .maybeSingle();

        if (ex?.id) {
          await supabase
            .from('cart_items')
            .update({
              quantity: safeInt(ex.quantity) + row.quantity,
              size: row.size ?? ex.size ?? null,
            })
            .eq('id', ex.id);
        } else {
          await supabase
            .from('cart_items')
            .insert({ user_id: userId, product_id: row.product_id, quantity: row.quantity, size: row.size ?? null });
        }
      }
      localStorage.removeItem(LS_KEY);
      return;
    }

    const existingMap = new Map<string, { quantity: number; size: string | null }>();
    (existingRows || []).forEach((r: any) =>
      existingMap.set(String(r.product_id), { quantity: safeInt(r.quantity), size: r.size ?? null })
    );

    // Build upsert rows with final quantities (existing + local)
    const upsertRows = localRows.map((r) => ({
      user_id: userId,
      product_id: r.product_id,
      quantity: safeInt(existingMap.get(r.product_id)?.quantity || 0) + r.quantity,
      size: r.size ?? existingMap.get(r.product_id)?.size ?? null,
    }));

    // Prefer upsert (requires unique constraint on (user_id, product_id))
    const { error: upsertErr } = await supabase
      .from('cart_items')
      .upsert(upsertRows as any, { onConflict: 'user_id,product_id' });

    if (upsertErr) {
      // If upsert fails (no constraint), fallback to updates/inserts
      for (const row of localRows) {
        const existing = existingMap.get(row.product_id);
        if (existing?.quantity != null) {
          await supabase
            .from('cart_items')
            .update({
              quantity: existing.quantity + row.quantity,
              size: row.size ?? existing.size ?? null,
            })
            .eq('user_id', userId)
            .eq('product_id', row.product_id);
        } else {
          await supabase
            .from('cart_items')
            .insert({ user_id: userId, product_id: row.product_id, quantity: row.quantity, size: row.size ?? null });
        }
      }
    }

    // Clear guest cart after merge
    localStorage.removeItem(LS_KEY);
  };

  /** 2) Fetch cart for guest or user */
  const fetchCart = async () => {
    const seq = ++seqRef.current;
    setLoading(true);

    try {
      // Guest cart from localStorage
      if (!user) {
        const localRows = readLocalCart();
        if (!localRows.length) {
          if (seq === seqRef.current) setItems([]);
          return;
        }

        const productIds = localRows.map((r) => r.product_id);

        const { data: products, error } = await supabase
          .from('products')
          .select('id, name, slug, price, images, stock_quantity, category_id, color_name, color_hex, category:categories(name,slug)')
          .in('id', productIds);

        if (error || !products) {
          if (seq === seqRef.current) setItems([]);
          return;
        }

        const productMap = new Map<string, ProductLite>();
        products.forEach((p: any) =>
          productMap.set(String(p.id), {
            ...(p as ProductLite),
            category_name: p?.category?.name ?? null,
            category_slug: p?.category?.slug ?? null,
            color_name: p?.color_name ?? null,
            color_hex: p?.color_hex ?? null,
          } as ProductLite)
        );

        const cartItems: CartItem[] = localRows
          .map((row) => {
            const product = productMap.get(row.product_id);
            if (!product) return null;

            // Clamp quantity to stock (if stock is tracked)
            const stock = safeInt(product.stock_quantity, 0);
            const qty = stock > 0 ? Math.min(row.quantity, stock) : row.quantity;

            return {
              id: row.product_id, // guests use product_id as stable id
              product_id: row.product_id,
              quantity: qty,
              size: row.size ?? null,
              product,
            } as CartItem;
          })
          .filter(Boolean) as CartItem[];

        // If we clamped any qty, persist it to local storage
        const maybeClamped = cartItems.map((ci) => ({
          product_id: ci.product_id,
          quantity: ci.quantity,
          size: ci.size ?? null,
        }));
        writeLocalCart(maybeClamped);

        if (seq === seqRef.current) setItems(cartItems);
        return;
      }

      // Logged-in cart from DB
      const { data, error } = await supabase
        .from('cart_items')
        .select(
          `
          id,
          product_id,
          quantity,
          size,
          product:products!inner (
            id,
            name,
            slug,
            price,
            images,
            stock_quantity,
            category_id,
            color_name,
            color_hex,
            category:categories(name,slug)
          )
        `
        )
        .eq('user_id', user.id);

      if (error) {
        if (seq === seqRef.current) setItems([]);
        return;
      }

      const cartItems: CartItem[] =
        (data || []).map((row: any) => {
          const product = Array.isArray(row.product) ? row.product[0] : row.product;
          const stock = safeInt(product?.stock_quantity, 0);
          const qty = stock > 0 ? Math.min(safeInt(row.quantity, 0), stock) : safeInt(row.quantity, 0);

          return {
            id: String(row.id),
            product_id: String(row.product_id),
            quantity: qty,
            size: row.size ?? null,
            product: {
              ...(product as ProductLite),
              category_name: product?.category?.name ?? null,
              category_slug: product?.category?.slug ?? null,
              color_name: product?.color_name ?? null,
              color_hex: product?.color_hex ?? null,
            },
          };
        }) || [];

      // Optional: if we clamped quantities due to stock, update DB in background (best effort)
      const toFix = cartItems.filter((ci) => {
        const original = (data || []).find((r: any) => String(r.id) === ci.id);
        return original && safeInt(original.quantity, 0) !== ci.quantity;
      });

      if (toFix.length) {
        // best effort (no await needed)
        Promise.all(
          toFix.map((ci) => supabase.from('cart_items').update({ quantity: ci.quantity }).eq('id', ci.id))
        ).catch(() => {});
      }

      if (seq === seqRef.current) setItems(cartItems);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  };

  // Init / refresh when user changes
  useEffect(() => {
    const run = async () => {
      if (user) {
        await mergeLocalCartToDB(user.id);
      }
      await fetchCart();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** 3) Mutations */
  const addToCart = async (productId: string, quantity: number = 1, options?: { size?: string | null }) => {
    const qtyToAdd = Math.max(1, safeInt(quantity, 1));
    const pid = String(productId);
    const size = options?.size ?? null;

    // Guest: localStorage
    if (!user) {
      const rows = readLocalCart();
      const map = new Map(rows.map((r) => [r.product_id, r]));
      const existing = map.get(pid);
      const nextRow: GuestCartRow = {
        product_id: pid,
        quantity: (existing?.quantity || 0) + qtyToAdd,
        size: size ?? existing?.size ?? null,
      };
      map.set(pid, nextRow);
      writeLocalCart(Array.from(map.values()));
      await fetchCart();
      return;
    }

    // Logged-in: minimize DB calls by using UI state first
    const existing = items.find((i) => i.product_id === pid);
    if (existing) {
      await updateQuantity(existing.id, existing.quantity + qtyToAdd);
      if (size && size !== (existing.size ?? null)) {
        await updateItemSize(existing.id, size);
      }
      return;
    }

    // Insert; if your DB has unique(user_id,product_id), upsert is safest
    const { error } = await supabase
      .from('cart_items')
      .upsert([{ user_id: user.id, product_id: pid, quantity: qtyToAdd, size }] as any, {
        onConflict: 'user_id,product_id',
      });

    if (!error) await fetchCart();
    else {
      // fallback insert
      const { error: insErr } = await supabase
        .from('cart_items')
        .insert({ user_id: user.id, product_id: pid, quantity: qtyToAdd, size });

      if (!insErr) await fetchCart();
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    const q = safeInt(quantity, 0);

    if (q <= 0) {
      await removeItem(itemId);
      return;
    }

    // Guest: itemId is product_id
    if (!user) {
      const pid = String(itemId);
      const rows = readLocalCart();
      const updated = rows.map((r) => (r.product_id === pid ? { ...r, quantity: q } : r));
      writeLocalCart(updated);
      await fetchCart();
      return;
    }

    // Logged-in: itemId is cart_items.id
    const { error } = await supabase.from('cart_items').update({ quantity: q }).eq('id', String(itemId));
    if (!error) await fetchCart();
  };

  const updateItemSize = async (itemId: string, size: string | null) => {
    const nextSize = size ? String(size) : null;
    if (!user) {
      const pid = String(itemId);
      const rows = readLocalCart();
      const updated = rows.map((r) => (r.product_id === pid ? { ...r, size: nextSize } : r));
      writeLocalCart(updated);
      await fetchCart();
      return;
    }

    const { error } = await supabase.from('cart_items').update({ size: nextSize }).eq('id', String(itemId));
    if (!error) await fetchCart();
  };

  const removeItem = async (itemId: string) => {
    // Guest: itemId is product_id
    if (!user) {
      const pid = String(itemId);
      const rows = readLocalCart();
      writeLocalCart(rows.filter((r) => r.product_id !== pid));
      await fetchCart();
      return;
    }

    // Logged-in: itemId is cart_items.id
    const { error } = await supabase.from('cart_items').delete().eq('id', String(itemId));
    if (!error) await fetchCart();
  };

  const clearCart = async () => {
    if (!user) {
      localStorage.removeItem(LS_KEY);
      setItems([]);
      return;
    }

    const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);
    if (!error) setItems([]);
  };

  const refreshCart = async () => {
    await fetchCart();
  };

  /** 4) Derived values */
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + safeInt(item.quantity, 0), 0), [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + safeNum(item.product?.price) * safeInt(item.quantity, 0), 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        loading,
        addToCart,
        updateQuantity,
        updateItemSize,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

const safeNum = (value: any): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const useCart = () => useContext(CartContext);
