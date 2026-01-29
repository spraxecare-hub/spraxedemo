'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/hooks/use-toast';

import {
  LayoutDashboard,
  Store,
  Package,
  PlusCircle,
  Clock3,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

type SellerProductRow = {
  id: string;
  name: string | null;
  slug: string | null;
  stock_quantity: number | null;
  unit: string | null;
  price: number | null;
  retail_price: number | null;
  approval_status: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

const fmtBDT = (n: number) => `৳${(n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;

function sellerStatusMeta(status: any) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'approved') return { label: 'Approved', Icon: ShieldCheck, cls: 'bg-green-50 text-green-800 border-green-200' };
  if (s === 'rejected') return { label: 'Rejected', Icon: XCircle, cls: 'bg-red-50 text-red-800 border-red-200' };
  return { label: 'Pending', Icon: Clock3, cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
}

function approvalBadge(status: any) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'approved') return <Badge className="bg-green-50 text-green-800 border border-green-200">Approved</Badge>;
  if (s === 'rejected') return <Badge className="bg-red-50 text-red-800 border border-red-200">Rejected</Badge>;
  return <Badge className="bg-yellow-50 text-yellow-800 border border-yellow-200">Pending</Badge>;
}

export default function SellerDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SellerProductRow[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    // allow pending sellers to view dashboard, but not customers
    if (profile?.role !== 'seller') {
      setLoading(false);
      return;
    }
    void fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role, authLoading]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, stock_quantity, unit, price, retail_price, approval_status, is_active, updated_at')
        .eq('seller_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setProducts((data as any) || []);
    } catch (e: any) {
      toast({
        title: 'Could not load seller dashboard',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sellerStatus = (profile as any)?.seller_status;
  const meta = sellerStatusMeta(sellerStatus);

  const stats = useMemo(() => {
    const total = products.length;
    const pending = products.filter((p) => String(p.approval_status || '').toLowerCase() !== 'approved').length;
    const active = products.filter((p) => Boolean(p.is_active)).length;
    const lowStock = products.filter((p) => {
      const s = Number(p.stock_quantity || 0);
      return s > 0 && s <= 5;
    }).length;
    const outOfStock = products.filter((p) => Number(p.stock_quantity || 0) <= 0).length;
    return { total, pending, active, lowStock, outOfStock };
  }, [products]);

  // Not a seller
  if (!authLoading && user && profile?.role !== 'seller') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-10 flex-1">
          <div className="max-w-2xl mx-auto">
            <Alert className="mb-6">
              <AlertTitle>Seller access</AlertTitle>
              <AlertDescription>
                This area is for sellers. If you want to sell on Spraxe, apply below.
              </AlertDescription>
            </Alert>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Become a seller</CardTitle>
                <CardDescription>Submit your seller application and start building your catalog.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                <Link href="/sell" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-blue-900 hover:bg-blue-800">
                    <Store className="h-4 w-4 mr-2" />
                    Apply to sell
                  </Button>
                </Link>
                {profile?.role === 'admin' && (
                  <Link href="/admin" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Admin dashboard <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}
                <Link href="/" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">Back to shop</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Seller Dashboard</h1>
              <Badge className={`border ${meta.cls}`}>
                <meta.Icon className="h-4 w-4 mr-2" />
                {meta.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mt-1">Manage products, track approvals, and keep inventory healthy.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => void fetchProducts()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/seller/products/new">
              <Button className="bg-blue-900 hover:bg-blue-800">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add product
              </Button>
            </Link>
            <Link href="/seller/inventory">
              <Button variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Inventory
              </Button>
            </Link>
          </div>
        </div>

        {sellerStatus !== 'approved' && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {sellerStatus === 'rejected' ? 'Application rejected' : 'Application pending'}
            </AlertTitle>
            <AlertDescription>
              {sellerStatus === 'rejected'
                ? 'You can update your details and resubmit your application from the Sell page.'
                : 'While pending, you can prepare products, but they will stay in Pending approval until your account is approved.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="shadow-sm border-l-4 border-l-blue-600">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-gray-500">Total products</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-gray-500">Pending / not approved</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-green-600">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-gray-500">Active listings</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.active}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-gray-500">Low stock</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.lowStock}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-gray-500">Out of stock</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.outOfStock}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-base">Recent products</CardTitle>
            <CardDescription>Latest updates on your catalog</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 text-center text-gray-500">Loading…</div>
            ) : products.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                You haven’t added any products yet.
                <div className="mt-3">
                  <Link href="/seller/products/new">
                    <Button className="bg-blue-900 hover:bg-blue-800">
                      <PlusCircle className="h-4 w-4 mr-2" /> Add your first product
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {products.slice(0, 8).map((p) => {
                  const stock = Number(p.stock_quantity || 0);
                  const price = Number(p.price ?? p.retail_price ?? 0);
                  return (
                    <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{p.name || 'Untitled product'}</div>
                        <div className="text-xs text-gray-500 truncate">/{p.slug || p.id}</div>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          {approvalBadge(p.approval_status)}
                          <Badge className={p.is_active ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">Stock: {stock} {p.unit || ''}</Badge>
                        </div>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2">
                        <div className="text-sm font-semibold text-gray-900">{fmtBDT(price)}</div>
                        <div className="flex gap-2">
                          <Link href="/seller/inventory">
                            <Button variant="outline" size="sm">
                              Manage
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-blue-900" />
                Next steps
              </CardTitle>
              <CardDescription>Recommended actions to grow faster</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>✅ Add products with strong titles & images</span>
                <Link href="/seller/products/new" className="text-blue-900 font-semibold hover:underline">Add</Link>
              </div>
              <div className="flex items-center justify-between">
                <span>✅ Keep stock accurate to avoid cancellations</span>
                <Link href="/seller/inventory" className="text-blue-900 font-semibold hover:underline">Inventory</Link>
              </div>
              <div className="flex items-center justify-between">
                <span>✅ Check approvals and activate products</span>
                <Link href="/seller/inventory" className="text-blue-900 font-semibold hover:underline">Review</Link>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Seller help</CardTitle>
              <CardDescription>Need updates to your seller profile?</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link href="/sell">
                <Button variant="outline" className="justify-start">
                  <Store className="h-4 w-4 mr-2" />
                  Update seller application
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="outline" className="justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  Contact support
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
