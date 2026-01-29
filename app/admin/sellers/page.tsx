'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';

import { ArrowLeft, Store, ShieldCheck, XCircle, Clock3, Search, Loader2 } from 'lucide-react';

type SellerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  seller_status: string | null;
  shop_name: string | null;
  shop_description: string | null;
  company_name: string | null;
  business_type: string | null;
  created_at: string | null;
};

function statusMeta(status: any) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'approved') return { label: 'Approved', Icon: ShieldCheck, cls: 'bg-green-50 text-green-800 border-green-200' };
  if (s === 'rejected') return { label: 'Rejected', Icon: XCircle, cls: 'bg-red-50 text-red-800 border-red-200' };
  return { label: 'Pending', Icon: Clock3, cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
}

export default function AdminSellersPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<SellerRow | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    void fetchSellers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role]);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      // show any profile that has seller_status, or role=seller
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('role.eq.seller,seller_status.not.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as any);
    } catch (e: any) {
      toast({ title: 'Failed to load sellers', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter !== 'all') {
        const st = String(s.seller_status || 'pending').toLowerCase();
        if (st !== statusFilter) return false;
      }
      if (!needle) return true;
      return (
        String(s.full_name || '').toLowerCase().includes(needle) ||
        String(s.email || '').toLowerCase().includes(needle) ||
        String(s.phone || '').toLowerCase().includes(needle) ||
        String(s.shop_name || '').toLowerCase().includes(needle)
      );
    });
  }, [items, q, statusFilter]);

  const approve = async (sellerId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'seller', seller_status: 'approved' })
        .eq('id', sellerId);
      if (error) throw error;
      toast({ title: 'Seller approved', description: 'This user can now access the seller dashboard.' });
      void fetchSellers();
    } catch (e: any) {
      toast({ title: 'Approval failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const openReject = (row: SellerRow) => {
    setRejectTarget(row);
    setRejectReason('');
    setRejectOpen(true);
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      // We don't have a dedicated rejection_reason field on profiles in this repo.
      // If your schema includes one, you can store rejectReason there.
      const { error } = await supabase
        .from('profiles')
        .update({ seller_status: 'rejected' })
        .eq('id', rejectTarget.id);
      if (error) throw error;

      toast({
        title: 'Seller rejected',
        description: rejectReason ? 'Status updated. (Reason saved locally only in this demo.)' : 'Status updated.',
      });

      setRejectOpen(false);
      setRejectTarget(null);
      void fetchSellers();
    } catch (e: any) {
      toast({ title: 'Rejection failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((x) => String(x.seller_status || 'pending').toLowerCase() === 'pending').length;
    const approved = items.filter((x) => String(x.seller_status || '').toLowerCase() === 'approved').length;
    const rejected = items.filter((x) => String(x.seller_status || '').toLowerCase() === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [items]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sellers</h1>
              <p className="text-sm text-gray-500 mt-1">Approve or reject seller applications.</p>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, shop..." className="pl-9 bg-white" />
            </div>
            <div className="flex gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'bg-blue-900 hover:bg-blue-800' : ''}>
                  {s[0].toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-sm border-l-4 border-l-blue-600"><CardContent className="p-4"><div className="text-sm text-gray-500">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card className="shadow-sm border-l-4 border-l-yellow-500"><CardContent className="p-4"><div className="text-sm text-gray-500">Pending</div><div className="text-2xl font-bold">{stats.pending}</div></CardContent></Card>
          <Card className="shadow-sm border-l-4 border-l-green-600"><CardContent className="p-4"><div className="text-sm text-gray-500">Approved</div><div className="text-2xl font-bold">{stats.approved}</div></CardContent></Card>
          <Card className="shadow-sm border-l-4 border-l-red-600"><CardContent className="p-4"><div className="text-sm text-gray-500">Rejected</div><div className="text-2xl font-bold">{stats.rejected}</div></CardContent></Card>
        </div>

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-white">
            <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-blue-900" /> Applications</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 text-center text-gray-500">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No sellers found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3">Seller</th>
                      <th className="px-6 py-3">Shop</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filtered.map((s) => {
                      const meta = statusMeta(s.seller_status);
                      const st = String(s.seller_status || 'pending').toLowerCase();
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900">{s.full_name || '—'}</div>
                            <div className="text-xs text-gray-500">{s.email || '—'}{s.phone ? ` • ${s.phone}` : ''}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900">{s.shop_name || '—'}</div>
                            <div className="text-xs text-gray-500">{s.company_name || ''}{s.business_type ? ` • ${s.business_type}` : ''}</div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={`border ${meta.cls}`}>
                              <meta.Icon className="h-3.5 w-3.5 mr-1" />
                              {meta.label}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" disabled={st === 'approved'} onClick={() => approve(s.id)} className="bg-blue-900 hover:bg-blue-800">
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" disabled={st === 'rejected'} onClick={() => openReject(s)}>
                                Reject
                              </Button>
                            </div>
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

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject seller</DialogTitle>
            <DialogDescription>
              This will mark the seller as rejected. (Optional) add a reason to show in your internal process.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. missing business documents" className="bg-white" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>Cancel</Button>
            <Button onClick={submitReject} disabled={rejecting} className="bg-blue-900 hover:bg-blue-800">
              {rejecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
