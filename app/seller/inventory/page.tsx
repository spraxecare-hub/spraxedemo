'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { SafeImage } from '@/components/ui/safe-image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/hooks/use-toast';

import {
  ArrowLeft,
  RefreshCw,
  Search,
  Package,
  Pencil,
  UploadCloud,
  Link as LinkIcon,
  X,
  Loader2,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';

type ProductRow = {
  id: string;
  name: string | null;
  slug: string | null;
  sku: string | null;
  images: any;
  stock_quantity: number | null;
  unit: string | null;
  base_price: number | null;
  price: number | null;
  retail_price: number | null;
  is_active: boolean | null;
  approval_status: string | null;
  updated_at: string | null;
};

const PAGE_SIZE = 20;
const LOW_STOCK_THRESHOLD = 5;
const MAX_IMAGES = 5;
const BUCKET = 'product-images';

function safeLike(s: string) {
  return s.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function formatBDT(n: number | null | undefined) {
  const v = Number(n || 0);
  return `৳${v.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

function normalizeImages(images: any): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof images === 'string') {
    const s = images.trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }
    if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean);
    if (s.startsWith('http')) return [s];
  }
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

function stockBadge(stock: number | null | undefined) {
  const s = Number(stock || 0);
  if (s <= 0) return <Badge className="bg-red-100 text-red-800 border border-red-200">Out</Badge>;
  if (s <= LOW_STOCK_THRESHOLD) return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">Low</Badge>;
  return <Badge className="bg-green-100 text-green-800 border border-green-200">OK</Badge>;
}

export default function SellerInventoryPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);

  const [imageTab, setImageTab] = useState<'manage' | 'upload' | 'hotlink'>('manage');
  const [images, setImages] = useState<string[]>([]);
  const [hotlink, setHotlink] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    stock_quantity: 0,
    base_price: 0,
    price: 0,
    retail_price: 0,
    unit: 'pieces',
    is_active: true,
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE)), [totalCount]);

  useEffect(() => {
    if (!user) return;
    if (profile?.role !== 'seller') {
      router.push(profile?.role === 'admin' ? '/admin' : '/sell');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!user || profile?.role !== 'seller') return;
    void fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role, page, debouncedQ, approvalFilter, stockFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id,name,slug,sku,images,stock_quantity,unit,base_price,price,retail_price,is_active,approval_status,updated_at', { count: 'exact' })
        .eq('seller_id', user!.id)
        .order('updated_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const term = debouncedQ.trim();
      if (term) {
        const like = `%${safeLike(term)}%`;
        query = query.or(`name.ilike.${like},sku.ilike.${like},slug.ilike.${like}`);
      }

      if (approvalFilter !== 'all') query = query.eq('approval_status', approvalFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      let list = (data || []) as ProductRow[];
      if (stockFilter !== 'all') {
        list = list.filter((p) => {
          const stock = Number(p.stock_quantity || 0);
          if (stockFilter === 'out') return stock <= 0;
          return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
        });
      }

      setItems(list);
      setTotalCount(count || 0);
    } catch (e: any) {
      toast({ title: 'Failed to load inventory', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setForm({
      stock_quantity: Number(p.stock_quantity || 0),
      base_price: Number(p.base_price || 0),
      price: Number(p.price ?? p.retail_price ?? 0),
      retail_price: Number(p.retail_price || 0),
      unit: p.unit || 'pieces',
      is_active: Boolean(p.is_active),
    });
    setImages(normalizeImages(p.images));
    setImageTab('manage');
    setHotlink('');
    setOpen(true);
  };

  const remainingUploads = MAX_IMAGES - images.length;

  async function onPickFiles(files: FileList | null) {
    if (!editing || !files || files.length === 0) return;
    const list = Array.from(files);

    if (list.length > remainingUploads) {
      toast({
        title: 'Too many images',
        description: `You can upload up to ${MAX_IMAGES} images. You can add ${remainingUploads} more.`,
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
        toast({ title: 'Image too large', description: 'Max 5MB per image.', variant: 'destructive' });
        return;
      }
    }

    try {
      const uploaded: string[] = [];
      for (const f of list) {
        const path = `${user!.id}/${editing.id}/${Date.now()}-${sanitizeFileName(f.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
          cacheControl: '3600',
          upsert: false,
          contentType: f.type,
        });
        if (upErr) throw upErr;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (!data?.publicUrl) throw new Error('Could not generate image URL');
        uploaded.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
      toast({ title: 'Uploaded', description: 'Images uploaded successfully.' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const addHotlink = () => {
    const url = hotlink.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'Invalid URL', description: 'Hotlink must start with http(s)://', variant: 'destructive' });
      return;
    }
    setImages((prev) => [...prev, url].slice(0, MAX_IMAGES));
    setHotlink('');
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= next.length) return next;
      const tmp = next[idx];
      next[idx] = next[to];
      next[to] = tmp;
      return next;
    });
  };

  const save = async () => {
    if (!editing) return;

    setSaving(true);
    try {
      const payload: any = {
        stock_quantity: Number(form.stock_quantity || 0),
        base_price: Number(form.base_price || 0),
        price: Number(form.price || 0),
        retail_price: Number(form.retail_price || 0),
        unit: String(form.unit || 'pieces').trim() || 'pieces',
        is_active: Boolean(form.is_active),
        images,
      };

      const { error } = await supabase.from('products').update(payload).eq('id', editing.id).eq('seller_id', user!.id);
      if (error) throw error;

      toast({ title: 'Saved', description: 'Product updated successfully.' });
      setOpen(false);
      setEditing(null);
      await fetchProducts();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sellerStatus = (profile as any)?.seller_status;
  const approvalBlocked = sellerStatus && String(sellerStatus).toLowerCase() !== 'approved';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/seller">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Seller Inventory</h1>
              <p className="text-sm text-gray-500 mt-1">Manage stock, pricing, and images for your products.</p>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, slug..." className="pl-9 bg-white" />
            </div>
            <Button variant="outline" onClick={() => void fetchProducts()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {approvalBlocked && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Your seller account is not approved yet</AlertTitle>
            <AlertDescription>
              You can prepare products and inventory, but approvals may remain pending until your seller account is approved. Update your application in{' '}
              <Link href="/sell" className="underline">Sell on Spraxe</Link>.
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-sm mb-6">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Approval and stock filters to find issues quickly.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Approval</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={approvalFilter === v ? 'default' : 'outline'}
                      className={approvalFilter === v ? 'bg-blue-900 hover:bg-blue-800' : ''}
                      onClick={() => {
                        setApprovalFilter(v);
                        setPage(1);
                      }}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Stock</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['all', 'low', 'out'] as const).map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={stockFilter === v ? 'default' : 'outline'}
                      className={stockFilter === v ? 'bg-blue-900 hover:bg-blue-800' : ''}
                      onClick={() => {
                        setStockFilter(v);
                        setPage(1);
                      }}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex md:justify-end items-end">
                <Link href="/seller/products/new" className="w-full md:w-auto">
                  <Button className="w-full md:w-auto bg-blue-900 hover:bg-blue-800">
                    <Package className="w-4 h-4 mr-2" />
                    Add product
                  </Button>
                </Link>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between text-sm text-gray-500">
              <div>
                Showing <b>{items.length}</b> of <b>{totalCount}</b> products
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <div className="text-xs">Page {page} / {totalPages}</div>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b">
            <CardTitle className="text-base font-semibold text-gray-800">Products</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : items.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No products found with your filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3">Product</th>
                      <th className="px-6 py-3">Stock</th>
                      <th className="px-6 py-3">Pricing</th>
                      <th className="px-6 py-3">Approval</th>
                      <th className="px-6 py-3 text-right">Action</th>
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
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative h-10 w-10 rounded-md border bg-gray-50 overflow-hidden flex items-center justify-center">
                                {img ? (
                                  <SafeImage src={img} alt={p.name || ''} fill sizes="40px" className="object-cover" />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-gray-300" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{p.name || 'Untitled'}</div>
                                <div className="text-xs text-gray-500 truncate">{p.sku || p.slug || p.id}</div>
                              </div>
                              {(isOut || isLow) && (
                                <Badge className={isOut ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'}>
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {isOut ? 'Out' : 'Low'}
                                </Badge>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-gray-900">{stock}</div>
                              <div className="text-xs text-gray-500">{p.unit || 'unit'}</div>
                              {stockBadge(p.stock_quantity)}
                            </div>
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
                                </div>
                              );
                            })()}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize bg-white">{p.approval_status || 'unknown'}</Badge>
                              <Badge className={p.is_active ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}>
                                {p.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">Updated: {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</div>
                          </td>

                          <td className="px-6 py-4 text-right">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>Update stock, pricing, and images.</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-5">
              <div className="rounded-md border bg-gray-50 p-3">
                <div className="font-semibold text-gray-900">{editing.name || 'Untitled'}</div>
                <div className="text-xs text-gray-500 mt-1">
                  SKU: <span className="font-mono">{editing.sku || '—'}</span> · ID: <span className="font-mono">{editing.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Stock quantity</Label>
                  <Input type="number" value={form.stock_quantity} onChange={(e) => setForm((p) => ({ ...p, stock_quantity: Number(e.target.value) }))} className="bg-white" />
                </div>

                <div>
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} className="bg-white" />
                </div>

                <div>
                  <Label>Price</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} className="bg-white" />
                </div>

                <div>
                  <Label>Retail price</Label>
                  <Input type="number" value={form.retail_price} onChange={(e) => setForm((p) => ({ ...p, retail_price: Number(e.target.value) }))} className="bg-white" />
                </div>

                <div>
                  <Label>Base price</Label>
                  <Input type="number" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: Number(e.target.value) }))} className="bg-white" />
                </div>

                <div className="flex items-end">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: Boolean(v) }))} />
                    <div>
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-gray-500">Toggle product visibility</div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as any)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="manage">Manage</TabsTrigger>
                  <TabsTrigger value="upload">Upload</TabsTrigger>
                  <TabsTrigger value="hotlink">Hotlink</TabsTrigger>
                </TabsList>

                <TabsContent value="manage" className="space-y-3">
                  {images.length === 0 ? (
                    <div className="text-sm text-gray-500">No images. Add images from Upload or Hotlink.</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {images.map((src, idx) => (
                        <div key={`${src}-${idx}`} className="relative rounded-xl border bg-white overflow-hidden">
                          <div className="relative aspect-square">
                            <SafeImage src={src} alt="" fill className="object-cover" />
                          </div>
                          <div className="p-2 flex items-center justify-between">
                            <div className="flex gap-1">
                              <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={idx === 0} onClick={() => moveImage(idx, -1)}>
                                ←
                              </Button>
                              <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={idx === images.length - 1} onClick={() => moveImage(idx, 1)}>
                                →
                              </Button>
                            </div>
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-red-600" onClick={() => removeImage(idx)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="upload" className="space-y-3">
                  <div className="text-xs text-gray-500">Max {MAX_IMAGES} images. Remaining: {Math.max(0, MAX_IMAGES - images.length)}</div>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => void onPickFiles(e.target.files)} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES}>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    Choose images
                  </Button>
                </TabsContent>

                <TabsContent value="hotlink" className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Image URL</Label>
                      <Input value={hotlink} onChange={(e) => setHotlink(e.target.value)} placeholder="https://..." className="bg-white" />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={addHotlink} disabled={images.length >= MAX_IMAGES}>
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving} className="bg-blue-900 hover:bg-blue-800">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
