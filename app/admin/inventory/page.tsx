'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Search,
  Filter,
  Package,
  Pencil,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Image as ImageIcon,
  UploadCloud,
  X,
  ArrowLeftRight,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { parseSizeChart, sanitizeSizeChart, type SizeOption } from '@/lib/utils/size-chart';

type Product = {
  id: string;
  name: string | null;
  sku: string | null;
  slug: string | null;
  images: any; // json/text depending on your schema
  stock_quantity: number | null;
  min_order_quantity: number | null;
  unit: string | null;
  base_price: number | null;
  retail_price: number | null;
  price: number | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  approval_status: string | null;
  updated_at: string | null;
  created_at: string | null;
  total_sales: number | null;
  color_group_id?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
  description?: string | null;
  size_chart?: any;
};

type VariantDraft = {
  id: string;
  isNew?: boolean;
  isDeleted?: boolean;
  stock_quantity: number;
  price: number;
  retail_price: number;
  base_price: number;
  min_order_quantity: number;
  unit: string;
  is_active: boolean;
  is_featured: boolean;
  approval_status: string;
  color_group_id: string;
  color_name: string;
  color_hex: string;
  images: string[];
  // shared across variants (kept in sync)
  description: string;
};

type SortKey = 'updated_desc' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'price_asc';

const PAGE_SIZE = 20;
const LOW_STOCK_THRESHOLD = 5;

const MAX_IMAGES = 5;
const BUCKET = 'product-images';

function safeLike(s: string) {
  // Keep compatible with older TS lib targets (avoid String.prototype.replaceAll)
  return s.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function formatBDT(n: number | null | undefined) {
  const v = Number(n || 0);
  return `৳${v.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

/** Normalize product.images to a string[] */
function normalizeImages(images: any): string[] {
  if (!images) return [];

  if (Array.isArray(images)) {
    return images.map(String).map((s) => s.trim()).filter(Boolean);
  }

  if (typeof images === 'string') {
    const s = images.trim();
    // stringified JSON
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
      } catch {
        // fallthrough
      }
    }
    // comma-separated
    if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean);
    if (s.startsWith('http')) return [s];
  }

  // json object stored weirdly
  try {
    const arr = JSON.parse(String(images));
    if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
  } catch {
    // ignore
  }

  return [];
}

function parseFirstImage(images: any): string | null {
  const arr = normalizeImages(images);
  return arr[0] || null;
}

function stockBadge(stock: number | null | undefined) {
  const s = Number(stock || 0);
  if (s <= 0) return <Badge className="bg-red-100 text-red-800 border border-red-200">Out</Badge>;
  if (s <= LOW_STOCK_THRESHOLD)
    return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">Low</Badge>;
  return <Badge className="bg-green-100 text-green-800 border border-green-200">OK</Badge>;
}

function sanitizeFileName(name: string) {
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const base = parts.join('.');
  const cleanBase = base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');

  return ext ? `${cleanBase}.${ext.toLowerCase()}` : cleanBase;
}

export default function InventoryPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimePulse, setRealtimePulse] = useState(false);

  // search + filters
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sort, setSort] = useState<SortKey>('updated_desc');
  const [showVariants, setShowVariants] = useState(false);

  // bulk select + edit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    is_active: 'keep' as 'keep' | 'true' | 'false',
    is_featured: 'keep' as 'keep' | 'true' | 'false',
    approval_status: 'keep' as 'keep' | 'pending' | 'approved' | 'rejected',
    stock_quantity: '',
    price: '',
    retail_price: '',
    base_price: '',
  });

  const selectedCount = selectedIds.size;
  const allVisibleIds = useMemo(() => items.map((x) => x.id), [items]);
  const allVisibleSelected = useMemo(() => allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id)), [allVisibleIds, selectedIds]);



  // pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE)), [totalCount]);

  // edit modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  // Grouped color-variant editor (edit all variants in one window)
  const [editingBase, setEditingBase] = useState<Product | null>(null);
  const [groupProducts, setGroupProducts] = useState<Product[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantDraft>>({});

  const visibleVariantDrafts = useMemo(() => {
    return Object.values(variantEdits).filter((d) => !d.isDeleted);
  }, [variantEdits]);

  // form state (stock/pricing)
  const [form, setForm] = useState({
    stock_quantity: 0,
    // Current selling price
    price: 0,
    // Original price (for discount badge). Optional.
    retail_price: 0,
    base_price: 0,
    min_order_quantity: 1,
    unit: 'pieces',
    is_active: true,
    is_featured: false,
    approval_status: 'approved',
    color_group_id: '',
    color_name: '',
    color_hex: '',
  });

  // Product description (stored on each variant row so every color page renders the same description)
  const [description, setDescription] = useState('');

  // manual specs
  const [specs, setSpecs] = useState<Array<{ label: string; value: string }>>([{ label: '', value: '' }]);

  const [sizeChart, setSizeChart] = useState<SizeOption[]>([]);

  // images state (edited separately)
  const [imageTab, setImageTab] = useState<'manage' | 'upload' | 'hotlink'>('manage');
  const [images, setImages] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // auth gate
  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [user, profile, router]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of allVisibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  async function applyBulkEdit() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const upd: any = {};
    if (bulkForm.is_active !== 'keep') upd.is_active = bulkForm.is_active === 'true';
    if (bulkForm.is_featured !== 'keep') upd.is_featured = bulkForm.is_featured === 'true';
    if (bulkForm.approval_status !== 'keep') upd.approval_status = bulkForm.approval_status;

    const stock = bulkForm.stock_quantity.trim();
    const price = bulkForm.price.trim();
    const retail = bulkForm.retail_price.trim();
    const base = bulkForm.base_price.trim();
    if (stock !== '') upd.stock_quantity = Number(stock);
    if (price !== '') upd.price = Number(price);
    if (retail !== '') upd.retail_price = Number(retail);
    if (base !== '') upd.base_price = Number(base);

    if (!Object.keys(upd).length) {
      toast({ title: 'Nothing to update', description: 'Pick at least one field in Bulk Edit.', variant: 'destructive' });
      return;
    }

    // validate numeric fields if present
    for (const k of ['stock_quantity','price','retail_price','base_price']) {
      if (k in upd && (!Number.isFinite(upd[k]) || upd[k] < 0)) {
        toast({ title: 'Invalid value', description: `Please enter a valid ${k.replace('_',' ')}.`, variant: 'destructive' });
        return;
      }
    }

    setBulkSaving(true);
    try {
      const { error } = await supabase.from('products').update(upd).in('id', ids);
      if (error) throw error;
      toast({ title: 'Bulk update applied', description: `Updated ${ids.length} product(s).` });
      setBulkOpen(false);
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (e: any) {
      toast({ title: 'Bulk update failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  }

  // reset to first page on query/filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, activeFilter, approvalFilter, stockFilter, sort, showVariants]);

  const buildQuery = () => {
    let query = supabase
      .from('products')
      .select(
        `
        id,
        name,
        sku,
        slug,
        images,
        stock_quantity,
        min_order_quantity,
        unit,
        base_price,
        retail_price,
        price,
        is_active,
        is_featured,
        approval_status,
        updated_at,
        created_at,
        total_sales,
        color_group_id,
        color_name,
        color_hex,
        description,
        size_chart
      `,
        { count: 'exact' }
      );

    if (debouncedQ) {
      const s = safeLike(debouncedQ);
      query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,slug.ilike.%${s}%`);
    }

    if (activeFilter === 'active') query = query.eq('is_active', true);
    if (activeFilter === 'inactive') query = query.eq('is_active', false);

    if (approvalFilter !== 'all') query = query.eq('approval_status', approvalFilter);

    if (stockFilter === 'out') query = query.lte('stock_quantity', 0);
    if (stockFilter === 'low') query = query.gt('stock_quantity', 0).lte('stock_quantity', LOW_STOCK_THRESHOLD);

    if (!showVariants) query = query.is('color_name', null);

    if (sort === 'updated_desc') query = query.order('updated_at', { ascending: false, nullsFirst: false });
    if (sort === 'stock_asc') query = query.order('stock_quantity', { ascending: true, nullsFirst: true });
    if (sort === 'stock_desc') query = query.order('stock_quantity', { ascending: false, nullsFirst: false });
    if (sort === 'price_desc') query = query.order('price', { ascending: false, nullsFirst: false });
    if (sort === 'price_asc') query = query.order('price', { ascending: true, nullsFirst: true });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    return query;
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error, count } = await buildQuery();

    if (error) {
      console.error(error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setItems((data || []) as Product[]);
    setTotalCount(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;
    void fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, debouncedQ, activeFilter, approvalFilter, stockFilter, sort, showVariants, page]);

  // realtime updates
  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;

    const ch = supabase
      .channel('inventory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        setRealtimePulse(true);
        void fetchProducts();
        setTimeout(() => setRealtimePulse(false), 600);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadSpecsForBase = async (baseId: string) => {
    const { data, error } = await supabase
      .from('product_specs')
      .select('label,value,sort_order')
      .eq('product_id', baseId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[product_specs] load failed', error.message);
      setSpecs([{ label: '', value: '' }]);
      return;
    }
    const rows = (data || []).map((r: any) => ({ label: String(r.label || ''), value: String(r.value || '') }));
    setSpecs(rows.length ? rows : [{ label: '', value: '' }]);
  };

  const switchToVariant = (id: string) => {
    const d = variantEdits[id];
    if (!d) return;

    setSelectedVariantId(id);

    const p = groupProducts.find((x) => x.id === id) || editingBase || editing;
    if (p) setEditing(p);

    setForm({
      stock_quantity: Number(d.stock_quantity || 0),
      price: Number(d.price || 0),
      retail_price: Number(d.retail_price || 0),
      base_price: Number(d.base_price || 0),
      min_order_quantity: Number(d.min_order_quantity || 1),
      unit: d.unit || 'pieces',
      is_active: Boolean(d.is_active ?? true),
      is_featured: Boolean(d.is_featured ?? false),
      approval_status: d.approval_status || 'approved',
      color_group_id: d.color_group_id || '',
      color_name: d.color_name || '',
      color_hex: d.color_hex || '',
    });
    setImages((d.images || []).slice(0, MAX_IMAGES));
    setNewUrl('');
    setImageTab('manage');
    setDescription(String(d.description || ''));
  };

  const addColorVariantDraft = () => {
    const base = editingBase || editing;
    if (!base) return;
    const baseDraft = variantEdits[base.id];
    const gid = (baseDraft?.color_group_id || (base as any).color_group_id || base.id) as string;

    const tempId = `new-${Date.now()}`;
    const draft = {
      id: tempId,
      isNew: true,
      stock_quantity: 0,
      price: Number(baseDraft?.price ?? (base.price ?? base.retail_price ?? 0)),
      retail_price: Number(baseDraft?.retail_price ?? (base.retail_price ?? base.price ?? 0)),
      base_price: Number(baseDraft?.base_price ?? (base.base_price ?? 0)),
      min_order_quantity: Number(baseDraft?.min_order_quantity ?? (base.min_order_quantity ?? 1)),
      unit: String(baseDraft?.unit ?? base.unit ?? 'pieces'),
      is_active: true,
      is_featured: false,
      approval_status: String(baseDraft?.approval_status ?? base.approval_status ?? 'approved'),
      color_group_id: gid,
      color_name: '',
      color_hex: '',
      images: (baseDraft?.images || normalizeImages((base as any).images)).slice(0, MAX_IMAGES),
      description: String(description || (baseDraft as any)?.description || (base as any).description || ''),
    };

    setVariantEdits((prev) => ({ ...prev, [tempId]: draft }));
    setGroupProducts((prev) => [
      ...prev,
      {
        ...base,
        id: tempId,
        // these placeholders keep the UI stable; real values are saved on insert
        color_group_id: gid,
        color_name: 'New color',
        color_hex: '',
        images: draft.images,
      },
    ]);

    setTimeout(() => switchToVariant(tempId), 0);
  };

  const removeColorVariantDraft = (id: string) => {
    if (!id) return;
    // Never delete the base product from this UI
    if (editingBase?.id && id === editingBase.id) return;

    setVariantEdits((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, isDeleted: true } };
    });

    // if we're deleting the currently selected variant, move selection back to base
    if (selectedVariantId === id) {
      const fallback = editingBase?.id || '';
      if (fallback) setTimeout(() => switchToVariant(fallback), 0);
    }
  };

  const openEdit = (p: Product) => {
    // Open the dialog immediately with a usable initial state.
    // The full grouped-variant payload is loaded asynchronously below.
    setOpen(true);
    setEditing(p);
    setEditingBase(null);
    setGroupProducts([]);
    setVariantEdits({});
    setSelectedVariantId('');
    setSizeChart([]);

    setNewUrl('');
    setImageTab('manage');

    void (async () => {
      const gid = ((p as any).color_group_id || p.id) as string;

      // Load ALL variants in the same color group so admin can edit them in one window.
      const { data, error } = await supabase
        .from('products')
        .select(
          `
            id,
            name,
            sku,
            slug,
            images,
            stock_quantity,
            min_order_quantity,
            unit,
            base_price,
            retail_price,
            price,
            is_active,
            is_featured,
            approval_status,
            updated_at,
            created_at,
            total_sales,
            color_group_id,
            color_name,
            color_hex,
            description,
            size_chart
          `
        )
        .eq('color_group_id', gid);

      let group = (data || []) as Product[];
      if (error || group.length === 0) {
        // fallback (single product)
        group = [p];
      }

      group = [...group].sort((a, b) => {
        const an = (a as any).color_name ?? null;
        const bn = (b as any).color_name ?? null;
        if (an == null && bn != null) return -1;
        if (an != null && bn == null) return 1;
        return String(an || '').localeCompare(String(bn || ''));
      });

      const base = group.find((x: any) => x.color_name == null) || group[0];
      const selectedId = group.some((x) => x.id === p.id) ? p.id : base.id;

      const edits: Record<string, VariantDraft> = {};
      for (const it of group) {
        const imgs = normalizeImages((it as any).images).slice(0, MAX_IMAGES);
        const desc = String((base as any).description || (it as any).description || '');
        edits[it.id] = {
          id: it.id,
          stock_quantity: Number(it.stock_quantity || 0),
          price: Number(it.price ?? it.retail_price ?? 0),
          retail_price: Number(it.retail_price ?? it.price ?? 0),
          base_price: Number(it.base_price || 0),
          min_order_quantity: Number(it.min_order_quantity || 1),
          unit: it.unit || 'pieces',
          is_active: Boolean(it.is_active ?? true),
          is_featured: Boolean(it.is_featured ?? false),
          approval_status: it.approval_status || 'approved',
          color_group_id: ((it as any).color_group_id || gid) as string,
          color_name: String((it as any).color_name || ''),
          color_hex: String((it as any).color_hex || ''),
          images: imgs,
          description: desc,
        };
      }

      // Keep description in a dedicated state and ensure all drafts match it
      setDescription(String((base as any).description || ''));
      setSizeChart(parseSizeChart((base as any).size_chart));

      setEditingBase(base);
      setGroupProducts(group);
      setVariantEdits(edits);

      // load specs from BASE product only (shared across variants on the storefront)
      await loadSpecsForBase(base.id);

      // Initialize the currently selected variant view immediately using the freshly built edits
      const d = edits[selectedId] || edits[base.id];
      const selectedProduct = group.find((x) => x.id === selectedId) || base;

      setSelectedVariantId(selectedId);
      setEditing(selectedProduct);

      if (d) {
        setForm({
          stock_quantity: Number(d.stock_quantity || 0),
          price: Number(d.price || 0),
          retail_price: Number(d.retail_price || 0),
          base_price: Number(d.base_price || 0),
          min_order_quantity: Number(d.min_order_quantity || 1),
          unit: d.unit || 'pieces',
          is_active: Boolean(d.is_active ?? true),
          is_featured: Boolean(d.is_featured ?? false),
          approval_status: d.approval_status || 'approved',
          color_group_id: d.color_group_id || '',
          color_name: d.color_name || '',
          color_hex: d.color_hex || '',
        });
        setImages((d.images || []).slice(0, MAX_IMAGES));
      }

      setNewUrl('');
      setImageTab('manage');
    })();
  };

  // Keep the currently selected variant draft in sync with form + images
  useEffect(() => {
    if (!open) return;
    if (!selectedVariantId) return;
    setVariantEdits((prev) => {
      const cur = prev[selectedVariantId];
      if (!cur) return prev;
      return {
        ...prev,
        [selectedVariantId]: {
          ...cur,
          stock_quantity: Number(form.stock_quantity || 0),
          price: Number(form.price || 0),
          retail_price: Number(form.retail_price || 0),
          base_price: Number(form.base_price || 0),
          min_order_quantity: Number(form.min_order_quantity || 1),
          unit: String(form.unit || 'pieces'),
          is_active: Boolean(form.is_active),
          is_featured: Boolean(form.is_featured),
          approval_status: String(form.approval_status || 'approved'),
          color_group_id: String(form.color_group_id || ''),
          color_name: String(form.color_name || ''),
          color_hex: String(form.color_hex || ''),
          images: images.slice(0, MAX_IMAGES),
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, images, selectedVariantId, open]);

  // Keep description synced across all variants (storefront can render any variant row)
  useEffect(() => {
    if (!open) return;
    setVariantEdits((prev) => {
      const ids = Object.keys(prev || {});
      if (ids.length === 0) return prev;
      let changed = false;
      const next: Record<string, VariantDraft> = { ...prev };
      for (const id of ids) {
        const cur = prev[id];
        if (!cur || cur.isDeleted) continue;
        const d = String(description || '');
        if (String(cur.description || '') !== d) {
          next[id] = { ...cur, description: d };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, open]);

  // Cleanup grouped-variant editor state when modal closes
  useEffect(() => {
    if (open) return;
    setEditing(null);
    setEditingBase(null);
    setGroupProducts([]);
    setVariantEdits({});
    setSelectedVariantId('');
    setDescription('');
  }, [open]);

  const validateForm = () => {
    if (form.stock_quantity < 0) return 'Stock cannot be negative.';
    if (form.price <= 0) return 'Price must be greater than 0.';
    if (form.retail_price < 0) return 'Retail price cannot be negative.';
    if (form.base_price < 0) return 'Base price cannot be negative.';
    if (form.min_order_quantity <= 0) return 'Min order quantity must be at least 1.';
    if (!form.unit?.trim()) return 'Unit is required.';
    if (images.length === 0) return 'Add at least 1 product image.';
    if (images.length > MAX_IMAGES) return `Max ${MAX_IMAGES} images allowed.`;
    if (form.color_hex?.trim()) {
      const h = form.color_hex.trim();
      const ok = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(h);
      if (!ok) return 'Color hex must be a valid hex code, e.g. #000000.';
    }
    return null;
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const removeImageAt = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const addHotlink = () => {
    const url = newUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'Invalid URL', description: 'URL must start with http:// or https://', variant: 'destructive' });
      return;
    }
    setImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev;
      if (prev.includes(url)) return prev;
      return [...prev, url];
    });
    setNewUrl('');
  };

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!user) return;
    if (editing?.id?.startsWith('new-')) {
      toast({
        title: 'Save first',
        description: 'Please save this new color variant first, then upload images for it.',
        variant: 'destructive',
      });
      return;
    }

    const list = Array.from(files);
    const remaining = MAX_IMAGES - images.length;

    if (list.length > remaining) {
      toast({
        title: 'Too many images',
        description: `Max ${MAX_IMAGES}. You can add ${remaining} more.`,
        variant: 'destructive',
      });
      return;
    }

    for (const f of list) {
      if (!f.type.startsWith('image/')) {
        toast({ title: 'Invalid file', description: 'Only image files are allowed.', variant: 'destructive' });
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Max 5MB per image.', variant: 'destructive' });
        return;
      }
    }

    setUploading(true);
    try {
      const slug = (editing?.slug || editing?.name || 'product').toString().toLowerCase().replace(/\s+/g, '-');
      const prefix = `${user.id}/${editing?.id || 'unknown'}/${slug}/${Date.now()}`;

      const newOnes: string[] = [];

      for (const f of list) {
        const fileName = sanitizeFileName(f.name) || `image-${Math.random().toString(16).slice(2)}.jpg`;
        const path = `${prefix}/${fileName}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
          cacheControl: '3600',
          upsert: false,
          contentType: f.type,
        });
        if (upErr) throw upErr;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = data?.publicUrl;
        if (!publicUrl) throw new Error('Could not create public URL (is bucket public?)');

        newOnes.push(publicUrl);
      }

      setImages((prev) => [...prev, ...newOnes].slice(0, MAX_IMAGES));
      toast({ title: 'Uploaded', description: `${newOnes.length} image(s) added.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const saveEdit = async () => {
    if (!editing) return;

    const baseId = editingBase?.id || editing.id;
    const base = editingBase || editing;
    const groupId = (variantEdits[baseId]?.color_group_id || (base as any).color_group_id || baseId) as string;

    const validateDraft = (d: VariantDraft, label: string) => {
      if (d.stock_quantity < 0) return `${label}: Stock cannot be negative.`;
      if (d.price <= 0) return `${label}: Price must be greater than 0.`;
      if (d.retail_price < 0) return `${label}: Retail price cannot be negative.`;
      if (d.base_price < 0) return `${label}: Base price cannot be negative.`;
      if (d.min_order_quantity <= 0) return `${label}: Min order quantity must be at least 1.`;
      if (!d.unit?.trim()) return `${label}: Unit is required.`;
      if ((d.images || []).length === 0) return `${label}: Add at least 1 image.`;
      if ((d.images || []).length > MAX_IMAGES) return `${label}: Max ${MAX_IMAGES} images.`;
      if (d.id !== baseId && !String(d.color_name || '').trim()) return `${label}: Color name is required.`;
      if (String(d.color_hex || '').trim()) {
        const h = String(d.color_hex || '').trim();
        const ok = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(h);
        if (!ok) return `${label}: Color hex must be valid (e.g. #000000).`;
      }
      return null;
    };

    // Validate all non-deleted drafts
    for (const d of visibleVariantDrafts) {
      const label = d.id === baseId ? 'Default' : String(d.color_name || 'Variant');
      const msg = validateDraft(d, label);
      if (msg) {
        toast({ title: 'Invalid data', description: msg, variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const cleanedSizeChart = sanitizeSizeChart(sizeChart);
      const sizeChartPayload = cleanedSizeChart.length ? cleanedSizeChart : null;

      // Update existing + insert new variants
      for (const [id, d] of Object.entries(variantEdits)) {
        if (!d) continue;
        if (d.isDeleted) continue;

        const isBase = id === baseId;
        const commonPayload: any = {
          description: String(description || ''),
          stock_quantity: Number(d.stock_quantity || 0),
          price: Number(d.price || 0),
          retail_price: Number(d.retail_price || 0),
          base_price: Number(d.base_price || 0),
          min_order_quantity: Number(d.min_order_quantity || 1),
          unit: String(d.unit || 'pieces'),
          is_active: Boolean(d.is_active),
          is_featured: Boolean(d.is_featured),
          approval_status: String(d.approval_status || 'approved'),
          images: (d.images || []).slice(0, MAX_IMAGES),
          color_group_id: groupId,
          color_name: isBase ? null : String(d.color_name || '').trim() || null,
          color_hex: isBase ? null : String(d.color_hex || '').trim() || null,
          size_chart: sizeChartPayload,
          updated_at: now,
        };

        if (d.isNew || id.startsWith('new-')) {
          // Insert a new product row for this variant
          const baseSlugRaw = String(base.slug || base.name || 'product');
          const baseSkuRaw = String(base.sku || 'SKU');
          const baseSlug = baseSlugRaw
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');

          const colorSlug = String(d.color_name || 'color')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');

          const insertPayload: any = {
            ...commonPayload,
            name: base.name,
            slug: `${baseSlug}-${colorSlug}`,
            sku: `${baseSkuRaw}-${colorSlug.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10)}`,
          };

          const { error: insErr } = await supabase.from('products').insert(insertPayload);
          if (insErr) throw insErr;
        } else {
          const { error: upErr } = await supabase.from('products').update(commonPayload).eq('id', id);
          if (upErr) throw upErr;
        }
      }

      // Deletes (existing variants only)
      const deleteIds = Object.entries(variantEdits)
        .filter(([id, d]) => d?.isDeleted && !(d?.isNew || id.startsWith('new-')))
        .map(([id]) => id);
      if (deleteIds.length) {
        const { error: delVarErr } = await supabase.from('products').delete().in('id', deleteIds);
        if (delVarErr) throw delVarErr;
      }

      // Upsert manual specs on BASE product only (shared across variants on storefront)
      const cleaned = specs
        .map((s) => ({ label: String(s.label || '').trim(), value: String(s.value || '').trim() }))
        .filter((s) => s.label && s.value);

      const { error: delSpecsErr } = await supabase.from('product_specs').delete().eq('product_id', baseId);
      if (delSpecsErr) {
        console.warn('[product_specs] delete failed', delSpecsErr.message);
      }
      if (cleaned.length) {
        const rows = cleaned.map((s, idx) => ({ product_id: baseId, label: s.label, value: s.value, sort_order: idx }));
        const { error: insSpecsErr } = await supabase.from('product_specs').insert(rows);
        if (insSpecsErr) console.warn('[product_specs] insert failed', insSpecsErr.message);
      }

      toast({ title: 'Saved', description: 'Product + variants + images + specs updated successfully.' });
      setOpen(false);
      setEditing(null);
      setEditingBase(null);
      setGroupProducts([]);
      setVariantEdits({});
      setSelectedVariantId('');
      void fetchProducts();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Save failed', description: e?.message || 'Could not save changes', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd + S to save when dialog open
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
      if (!isSave) return;
      e.preventDefault();
      void saveEdit();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form, editing, images, description]);

  const activeCount = items.filter((p) => p.is_active).length;
  const lowCount = items.filter((p) => {
    const s = Number(p.stock_quantity || 0);
    return s > 0 && s <= LOW_STOCK_THRESHOLD;
  }).length;
  const outCount = items.filter((p) => Number(p.stock_quantity || 0) <= 0).length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-900" />
                Inventory
                {realtimePulse && (
                  <span className="inline-flex items-center text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Live
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500 mt-1">Search and edit products, stock, pricing, and images.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white border text-gray-700">
              Showing: <span className="ml-1 font-semibold">{items.length}</span>
            </Badge>
            <Badge className="bg-green-50 text-green-800 border border-green-100">
              Active: <span className="ml-1 font-semibold">{activeCount}</span>
            </Badge>
            <Badge className="bg-yellow-50 text-yellow-800 border border-yellow-100">
              Low: <span className="ml-1 font-semibold">{lowCount}</span>
            </Badge>
            <Badge className="bg-red-50 text-red-800 border border-red-100">
              Out: <span className="ml-1 font-semibold">{outCount}</span>
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Search */}
              <div className="lg:col-span-4 relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search product name, SKU, slug..."
                  className="pl-9 bg-white"
                />
              </div>

              {/* Active */}
              <div className="lg:col-span-2">
                <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)}>
                  <SelectTrigger className="bg-white">
                    <Filter className="w-4 h-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="Active" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Approval */}
              <div className="lg:col-span-2">
                <Select value={approvalFilter} onValueChange={(v) => setApprovalFilter(v as any)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Approval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Stock */}
              <div className="lg:col-span-2">
                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as any)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="low">Low stock</SelectItem>
                    <SelectItem value="out">Out of stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="lg:col-span-2">
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_desc">Latest updated</SelectItem>
                    <SelectItem value="stock_asc">Stock: Low → High</SelectItem>
                    <SelectItem value="stock_desc">Stock: High → Low</SelectItem>
                    <SelectItem value="price_desc">Price: High → Low</SelectItem>
                    <SelectItem value="price_asc">Price: Low → High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-gray-500">
                Page <span className="font-semibold text-gray-700">{page}</span> of{' '}
                <span className="font-semibold text-gray-700">{totalPages}</span> · Total{' '}
                <span className="font-semibold text-gray-700">{totalCount}</span> products
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                  <input
                    type="checkbox"
                    checked={showVariants}
                    onChange={(e) => setShowVariants(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Show color variants
                </label>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void fetchProducts()} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prev
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
	            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b">
            <CardTitle className="text-base font-semibold text-gray-800">Products</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {selectedCount > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-blue-50/60">
                <div className="text-sm font-semibold text-blue-900">{selectedCount} selected</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="bg-blue-900 hover:bg-blue-800" onClick={() => setBulkOpen(true)}>
                    Bulk Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No products found with your filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 w-10">
                        <input
                          aria-label="Select all"
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </th>
                      <th className="px-6 py-3">Product</th>
                      <th className="px-6 py-3">SKU</th>
                      <th className="px-6 py-3">Stock</th>
                      <th className="px-6 py-3">Pricing</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right sticky right-0 bg-gray-50 z-10 shadow-[-6px_0_10px_-10px_rgba(0,0,0,0.25)]">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {items.map((p) => {
                      const img = parseFirstImage(p.images);
                      const stock = Number(p.stock_quantity || 0);
                      const isLow = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
                      const isOut = stock <= 0;

                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 w-10">
                            <input
                              aria-label={`Select ${p.name || "product"}`}
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={(e) => toggleSelect(p.id, e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative h-10 w-10 rounded-md border bg-gray-50 overflow-hidden flex items-center justify-center">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <SafeImage src={img} alt={p.name || ""} fill sizes="40px" className="object-cover" />
                                ) : (
                                  <Package className="w-5 h-5 text-gray-300" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{p.name || 'Untitled'}</div>
                                <div className="text-xs text-gray-500 truncate">{p.slug || p.id}</div>
                              </div>

                              {(isOut || isLow) && (
                                <div className="ml-2">
                                  <Badge
                                    className={
                                      isOut
                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                    }
                                  >
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {isOut ? 'Out' : 'Low'}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-mono text-xs text-gray-700">{p.sku || '—'}</div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-gray-900">{stock}</div>
                              <div className="text-xs text-gray-500">{p.unit || 'unit'}</div>
                              {stockBadge(p.stock_quantity)}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">Min order: {Number(p.min_order_quantity || 1)}</div>
                          </td>

                          <td className="px-6 py-4">
                            {(() => {
                              const price = Number(p.price ?? p.retail_price ?? 0);
                              const retail = Number(p.retail_price ?? 0);
                              const pct = retail > 0 && retail > price ? Math.round(((retail - price) / retail) * 100) : 0;
                              return (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-gray-900">{formatBDT(price)}</div>
                                  {pct > 0 && (
                                    <div className="text-xs text-gray-500">
                                      <span className="line-through mr-2">{formatBDT(retail)}</span>
                                      <span className="font-semibold text-green-700">{pct}% OFF</span>
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500">Base: {formatBDT(p.base_price)}</div>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={
                                    p.is_active
                                      ? 'bg-green-100 text-green-800 border border-green-200'
                                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                                  }
                                >
                                  {p.is_active ? 'Active' : 'Inactive'}
                                </Badge>

                                <Badge variant="outline" className="capitalize">
                                  {p.approval_status || 'unknown'}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-400">
                                Updated: {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right sticky right-0 bg-white z-10 shadow-[-6px_0_10px_-10px_rgba(0,0,0,0.18)]">
                            <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(p)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>



      {/* Bulk edit dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Edit ({selectedCount})</DialogTitle>
            <DialogDescription>
              Apply the same changes to all selected products. Leave a field blank or set to “Keep” to skip.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Active</Label>
                <Select value={bulkForm.is_active} onValueChange={(v) => setBulkForm((p) => ({ ...p, is_active: v as any }))}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Keep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep</SelectItem>
                    <SelectItem value="true">Set Active</SelectItem>
                    <SelectItem value="false">Set Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Featured</Label>
                <Select value={bulkForm.is_featured} onValueChange={(v) => setBulkForm((p) => ({ ...p, is_featured: v as any }))}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Keep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep</SelectItem>
                    <SelectItem value="true">Set Featured</SelectItem>
                    <SelectItem value="false">Unset Featured</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Approval</Label>
                <Select value={bulkForm.approval_status} onValueChange={(v) => setBulkForm((p) => ({ ...p, approval_status: v as any }))}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Keep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Stock quantity (set)</Label>
                <Input value={bulkForm.stock_quantity} onChange={(e) => setBulkForm((p) => ({ ...p, stock_quantity: e.target.value }))} placeholder="Leave blank to keep" className="bg-white" />
              </div>
              <div>
                <Label>Price (set)</Label>
                <Input value={bulkForm.price} onChange={(e) => setBulkForm((p) => ({ ...p, price: e.target.value }))} placeholder="Leave blank to keep" className="bg-white" />
              </div>
              <div>
                <Label>Retail price (set)</Label>
                <Input value={bulkForm.retail_price} onChange={(e) => setBulkForm((p) => ({ ...p, retail_price: e.target.value }))} placeholder="Leave blank to keep" className="bg-white" />
              </div>
              <div>
                <Label>Base price (set)</Label>
                <Input value={bulkForm.base_price} onChange={(e) => setBulkForm((p) => ({ ...p, base_price: e.target.value }))} placeholder="Leave blank to keep" className="bg-white" />
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Tip: For complex price updates (e.g., +5%), you can export/import via a custom SQL/RPC later.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Cancel</Button>
            <Button className="bg-blue-900 hover:bg-blue-800" onClick={() => void applyBulkEdit()} disabled={bulkSaving}>
              {bulkSaving ? 'Applying…' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Allow full scrolling inside the edit modal on smaller screens */}
        <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update inventory, pricing, status, and images. Shortcut: <b>Ctrl/Cmd + S</b> to save.</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-5">
              <div className="rounded-md border bg-gray-50 p-3">
                <div className="font-semibold text-gray-900">{editing.name || 'Untitled'}</div>
                <div className="text-xs text-gray-500 mt-1">
                  SKU: <span className="font-mono">{editing.sku || '—'}</span> · ID: <span className="font-mono">{editing.id}</span>
                </div>
              </div>

              {/* Grouped color variants editor */}
              {visibleVariantDrafts.length >= 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Color Variants</CardTitle>
                    <div className="text-xs text-gray-500">
                      Edit all colors inside this window. Select a color to edit its images + pricing.
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {visibleVariantDrafts.map((d) => {
                        const label = d.id === (editingBase?.id || '') ? 'Default' : String(d.color_name || 'Variant');
                        const isActive = selectedVariantId === d.id;
                        const hex = String(d.color_hex || '').trim();
                        const swatch = hex ? (hex.startsWith('#') ? hex : `#${hex}`) : null;
                        return (
                          <Button
                            key={d.id}
                            type="button"
                            variant={isActive ? 'default' : 'outline'}
                            className={isActive ? 'bg-blue-900 hover:bg-blue-800' : ''}
                            onClick={() => switchToVariant(d.id)}
                          >
                            {swatch && (
                              <span
                                className="mr-2 inline-block h-3 w-3 rounded-full border"
                                style={{ backgroundColor: swatch }}
                              />
                            )}
                            {label}
                          </Button>
                        );
                      })}

                      <Button type="button" variant="outline" className="gap-2" onClick={addColorVariantDraft}>
                        <Plus className="h-4 w-4" /> Add color
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {visibleVariantDrafts.map((d) => {
                        const isBase = d.id === (editingBase?.id || '');
                        const label = isBase ? 'Default' : String(d.color_name || 'Variant');

                        return (
                          <div key={d.id} className="rounded-xl border bg-white p-3">
                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900">{label}</div>
                                <div className="text-xs text-gray-500">Stock: {Number(d.stock_quantity || 0)} • Price: {formatBDT(Number(d.price || 0))}</div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 w-full md:w-auto">
                                <div className="md:col-span-2">
                                  <Label className="text-xs">Color name</Label>
                                  <Input
                                    value={d.color_name}
                                    disabled={isBase}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setVariantEdits((prev) => ({
                                        ...prev,
                                        [d.id]: { ...prev[d.id], color_name: val },
                                      }));
                                      if (selectedVariantId === d.id) setForm((f) => ({ ...f, color_name: val }));
                                    }}
                                    placeholder={isBase ? 'Default' : 'e.g. Black'}
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <Label className="text-xs">Hex</Label>
                                  <Input
                                    value={d.color_hex}
                                    disabled={isBase}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setVariantEdits((prev) => ({
                                        ...prev,
                                        [d.id]: { ...prev[d.id], color_hex: val },
                                      }));
                                      if (selectedVariantId === d.id) setForm((f) => ({ ...f, color_hex: val }));
                                    }}
                                    placeholder={isBase ? '—' : '#000000'}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Stock</Label>
                                  <Input
                                    type="number"
                                    value={Number(d.stock_quantity || 0)}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setVariantEdits((prev) => ({
                                        ...prev,
                                        [d.id]: { ...prev[d.id], stock_quantity: val },
                                      }));
                                      if (selectedVariantId === d.id) setForm((f) => ({ ...f, stock_quantity: val }));
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Active</Label>
                                  <div className="h-10 flex items-center">
                                    <Switch
                                      checked={Boolean(d.is_active)}
                                      onCheckedChange={(v) => {
                                        const val = Boolean(v);
                                        setVariantEdits((prev) => ({
                                          ...prev,
                                          [d.id]: { ...prev[d.id], is_active: val },
                                        }));
                                        if (selectedVariantId === d.id) setForm((f) => ({ ...f, is_active: val }));
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {!isBase && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removeColorVariantDraft(d.id)}
                                  title="Remove this color"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                              <span>Images: {(d.images || []).length}</span>
                              <Button type="button" variant="outline" size="sm" onClick={() => switchToVariant(d.id)}>
                                Edit images / price
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="manage" className="gap-2">
                    <ImageIcon className="h-4 w-4" /> Images
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="gap-2">
                    <UploadCloud className="h-4 w-4" /> Upload
                  </TabsTrigger>
                  <TabsTrigger value="hotlink" className="gap-2">
                    <LinkIcon className="h-4 w-4" /> Add URL
                  </TabsTrigger>
                </TabsList>

                {/* Manage */}
                <TabsContent value="manage" className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {images.length === 0 ? 'No images yet.' : `Total: ${images.length}/${MAX_IMAGES}`}
                    </div>
                    <Badge variant="outline" className="bg-white">Tip: reorder with arrows</Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                    {images.map((url, idx) => (
                      <div key={url + idx} className="relative rounded-xl border bg-white overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <div className="relative h-28 w-full">
                        <SafeImage src={url} alt={`Image ${idx + 1}`} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover" />
                      </div>

                        <div className="absolute top-2 left-2 flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 bg-white/90"
                            onClick={() => moveImage(idx, -1)}
                            disabled={idx === 0}
                            title="Move left"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 bg-white/90"
                            onClick={() => moveImage(idx, 1)}
                            disabled={idx === images.length - 1}
                            title="Move right"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="absolute top-2 right-2 h-7 w-7 bg-white/90"
                          onClick={() => removeImageAt(idx)}
                          title="Remove"
                        >
                          <X className="h-4 w-4 text-gray-700" />
                        </Button>

                        <div className="absolute bottom-2 left-2 text-[11px] font-semibold bg-white/90 border rounded-full px-2 py-0.5">
                          #{idx + 1}
                        </div>
                      </div>
                    ))}

                    {images.length === 0 && (
                      <div className="col-span-2 md:col-span-5 p-6 text-center text-sm text-gray-500 border rounded-xl bg-white">
                        Add images using <b>Upload</b> or <b>Add URL</b> tabs.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white gap-2"
                      onClick={() => {
                        setImages([]);
                        toast({ title: 'Cleared', description: 'All images removed (remember to Save).' });
                      }}
                      disabled={images.length === 0}
                    >
                      <Trash2 className="h-4 w-4" /> Clear images
                    </Button>

                    <Button type="button" variant="outline" className="bg-white gap-2" onClick={() => setImageTab('upload')}>
                      <UploadCloud className="h-4 w-4" /> Upload more
                    </Button>

                    <Button type="button" variant="outline" className="bg-white gap-2" onClick={() => setImageTab('hotlink')}>
                      <LinkIcon className="h-4 w-4" /> Add URL
                    </Button>
                  </div>
                </TabsContent>

                {/* Upload */}
                <TabsContent value="upload" className="mt-4">
                  <Card className="border-dashed">
                    <CardContent className="p-4 md:p-5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">Upload to Supabase bucket: {BUCKET}</div>
                          <div className="text-sm text-gray-600">Max {MAX_IMAGES} images. Remaining: {MAX_IMAGES - images.length}</div>
                          <div className="text-xs text-gray-500 mt-1">Only admins can upload (RLS).</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => void uploadFiles(e.target.files)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="bg-white gap-2"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading || images.length >= MAX_IMAGES}
                          >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                            Upload
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 text-sm text-gray-600">
                        After upload, images are added to the list. Go to <b>Images</b> tab to reorder/remove.
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Hotlink */}
                <TabsContent value="hotlink" className="mt-4">
                  <Card>
                    <CardContent className="p-4 md:p-5 space-y-3">
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" /> Add Image URL
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="md:col-span-3">
                          <Input
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="https://..."
                            className="bg-white"
                          />
                        </div>
                        <Button
                          type="button"
                          className="bg-blue-900 hover:bg-blue-800"
                          onClick={addHotlink}
                          disabled={!newUrl.trim() || images.length >= MAX_IMAGES}
                        >
                          Add
                        </Button>
                      </div>

                      {newUrl.trim() && /^https?:\/\//i.test(newUrl.trim()) && (
                        <div className="rounded-xl border bg-white overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <div className="relative h-40 w-full bg-gray-100">
                          <SafeImage src={newUrl.trim()} alt="Preview" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                        </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
                        Tip: Use CDN links. Max {MAX_IMAGES}. Current: {images.length}.
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Separator />

              {/* Inventory fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stock Quantity</Label>
                  <Input
                    type="number"
                    value={form.stock_quantity}
                    onChange={(e) => setForm((f) => ({ ...f, stock_quantity: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Price (Selling)</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                    className="bg-white"
                  />
                  <div className="text-xs text-gray-500">This is the price customers pay.</div>
                </div>

                <div className="space-y-2">
                  <Label>Retail Price (Original)</Label>
                  <Input
                    type="number"
                    value={form.retail_price}
                    onChange={(e) => setForm((f) => ({ ...f, retail_price: Number(e.target.value) }))}
                    className="bg-white"
                  />
                  <div className="text-xs text-gray-500">If higher than Price, products will show “% OFF”.</div>
                </div>

                <div className="space-y-2">
                  <Label>Base Price</Label>
                  <Input
                    type="number"
                    value={form.base_price}
                    onChange={(e) => setForm((f) => ({ ...f, base_price: Number(e.target.value) }))}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Min Order Qty</Label>
                  <Input
                    type="number"
                    value={form.min_order_quantity}
                    onChange={(e) => setForm((f) => ({ ...f, min_order_quantity: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Approval Status</Label>
                  <Select value={form.approval_status} onValueChange={(v) => setForm((f) => ({ ...f, approval_status: v }))}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium text-gray-900">Active</div>
                  <div className="text-xs text-gray-500">Hide/show this product in the store</div>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium text-gray-900">Featured</div>
                  <div className="text-xs text-gray-500">Show on homepage / featured sections</div>
                </div>
                <Switch checked={form.is_featured} onCheckedChange={(v) => setForm((f) => ({ ...f, is_featured: v }))} />
              </div>

              <div className="space-y-2">
                <Label>Product description</Label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Write a well-formatted product description…"
                  minHeightClass="min-h-[260px]"
                />
                <div className="text-xs text-gray-500">
                  This description is shared across all color variants and shown on the product details page.
                </div>
              </div>

              <Separator />

              {/* Manual specs editor */}
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-gray-900">Manual Specifications</div>
                  <div className="text-xs text-gray-500">Shown in the product “Specs” tab.</div>
                </div>

                <div className="space-y-2">
                  {specs.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-xl border bg-white p-3">
                      <div className="md:col-span-5">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={s.label}
                          onChange={(e) => setSpecs((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                          placeholder="Compatibility"
                          className="bg-white"
                        />
                      </div>
                      <div className="md:col-span-6">
                        <Label className="text-xs">Value</Label>
                        <Input
                          value={s.value}
                          onChange={(e) => setSpecs((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                          placeholder="iPhone 13 / iPhone 14"
                          className="bg-white"
                        />
                      </div>
                      <div className="md:col-span-1 flex items-end justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="bg-white"
                          onClick={() => setSpecs((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={specs.length <= 1}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white gap-2"
                    onClick={() => setSpecs((prev) => [...prev, { label: '', value: '' }])}
                  >
                    <Plus className="h-4 w-4" /> Add spec
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-gray-900">Size Options & Measurements</div>
                  <div className="text-xs text-gray-500">Used for mens/womens fashion sizing on the storefront.</div>
                </div>

                <div className="space-y-3">
                  {sizeChart.map((entry, idx) => (
                    <div key={`${entry.size}-${idx}`} className="rounded-xl border bg-white p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4">
                          <Label className="text-xs">Size label</Label>
                          <Input
                            value={entry.size}
                            onChange={(e) =>
                              setSizeChart((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, size: e.target.value } : item))
                              )
                            }
                            placeholder="S, M, L, XL..."
                            className="bg-white"
                          />
                        </div>
                        <div className="md:col-span-8 flex items-center justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-white"
                            onClick={() => setSizeChart((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove size
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-gray-700">Measurements</div>
                        {(entry.measurements || []).map((m, mIdx) => (
                          <div key={`${m.label}-${mIdx}`} className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-lg border bg-gray-50 p-3">
                            <div className="md:col-span-5">
                              <Label className="text-xs">Label</Label>
                              <Input
                                value={m.label}
                                onChange={(e) =>
                                  setSizeChart((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            measurements: item.measurements.map((row, j) =>
                                              j === mIdx ? { ...row, label: e.target.value } : row
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                                placeholder="Chest, Waist, Length..."
                                className="bg-white"
                              />
                            </div>
                            <div className="md:col-span-6">
                              <Label className="text-xs">Value</Label>
                              <Input
                                value={m.value}
                                onChange={(e) =>
                                  setSizeChart((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            measurements: item.measurements.map((row, j) =>
                                              j === mIdx ? { ...row, value: e.target.value } : row
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                                placeholder="38-40 in, 76 cm..."
                                className="bg-white"
                              />
                            </div>
                            <div className="md:col-span-1 flex items-end justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="bg-white"
                                onClick={() =>
                                  setSizeChart((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, measurements: item.measurements.filter((_, j) => j !== mIdx) }
                                        : item
                                    )
                                  )
                                }
                                title="Remove measurement"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          className="bg-white gap-2"
                          onClick={() =>
                            setSizeChart((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, measurements: [...(item.measurements || []), { label: '', value: '' }] }
                                  : item
                              )
                            )
                          }
                        >
                          <Plus className="h-4 w-4" /> Add measurement
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white gap-2"
                    onClick={() =>
                      setSizeChart((prev) => [...prev, { size: '', measurements: [{ label: '', value: '' }] }])
                    }
                  >
                    <Plus className="h-4 w-4" /> Add size
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving || uploading}>
              Cancel
            </Button>
            <Button className="bg-blue-900 hover:bg-blue-800" onClick={() => void saveEdit()} disabled={saving || uploading}>
              {saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
