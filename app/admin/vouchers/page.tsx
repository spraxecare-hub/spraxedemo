'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';

type DiscountType = 'percentage' | 'fixed';

type DiscountCodeRow = {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase: number | null;
  max_uses: number | null;
  current_uses: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string | null;
};

const toISOorNull = (v: string): string | null => {
  if (!v) return null;
  // datetime-local gives local time without timezone; store as UTC ISO for consistency
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const toLocalDatetimeInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // yyyy-MM-ddTHH:mm for datetime-local
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

export default function AdminVouchersPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<DiscountCodeRow[]>([]);

  const [q, setQ] = useState('');

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load vouchers', variant: 'destructive' });
      setLoading(false);
      return;
    }
    setRows((data || []) as any);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => (r.code || '').toLowerCase().includes(query));
  }, [rows, q]);

  const addRow = () => {
    const nowIso = new Date().toISOString();
    setRows((prev) => [
      {
        id: `new_${Math.random().toString(16).slice(2)}`,
        code: '',
        discount_type: 'percentage',
        discount_value: 10,
        min_purchase: 0,
        max_uses: null,
        current_uses: 0,
        valid_from: nowIso,
        valid_until: null,
        is_active: true,
        created_at: nowIso,
      },
      ...prev,
    ]);
  };

  const updateRow = (id: string, patch: Partial<DiscountCodeRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = async (id: string) => {
    const isNew = id.startsWith('new_');
    if (isNew) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message || 'Failed to delete voucher', variant: 'destructive' });
      return;
    }
    toast({ title: 'Deleted', description: 'Voucher deleted' });
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      const toInsert = rows
        .filter((r) => r.id.startsWith('new_'))
        .filter((r) => r.code.trim().length > 0)
        .map((r) => ({
          code: r.code.trim().toUpperCase(),
          discount_type: r.discount_type,
          discount_value: Number(r.discount_value) || 0,
          min_purchase: Number(r.min_purchase || 0),
          max_uses: r.max_uses === null || r.max_uses === ('' as any) ? null : Number(r.max_uses),
          valid_from: r.valid_from,
          valid_until: r.valid_until,
          is_active: !!r.is_active,
        }));

      const toUpdate = rows
        .filter((r) => !r.id.startsWith('new_'))
        .map((r) => ({
          id: r.id,
          code: r.code.trim().toUpperCase(),
          discount_type: r.discount_type,
          discount_value: Number(r.discount_value) || 0,
          min_purchase: Number(r.min_purchase || 0),
          max_uses: r.max_uses === null || r.max_uses === ('' as any) ? null : Number(r.max_uses),
          valid_from: r.valid_from,
          valid_until: r.valid_until,
          is_active: !!r.is_active,
        }));

      if (toInsert.length) {
        const { error } = await supabase.from('discount_codes').insert(toInsert);
        if (error) throw error;
      }

      if (toUpdate.length) {
        // Upsert by id
        const { error } = await supabase.from('discount_codes').upsert(toUpdate, { onConflict: 'id' });
        if (error) throw error;
      }

      toast({ title: 'Saved', description: 'Vouchers updated' });
      await load();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Failed to save vouchers', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Vouchers</h1>
              <p className="text-sm text-muted-foreground">Create and manage discount codes (percentage or fixed).</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Voucher
            </Button>
            <Button onClick={saveAll} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Discount codes</CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code…" className="bg-white" />
              <div className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} codes</div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">No vouchers yet.</div>
            ) : (
              <div className="space-y-4">
                {filtered.map((r) => (
                  <div key={r.id} className="rounded-xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                        <div className="space-y-2">
                          <Label>Code</Label>
                          <Input
                            value={r.code}
                            onChange={(e) => updateRow(r.id, { code: e.target.value })}
                            placeholder="WELCOME10"
                            className="bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={r.discount_type} onValueChange={(v) => updateRow(r.id, { discount_type: v as DiscountType })}>
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Value</Label>
                          <Input
                            value={String(r.discount_value ?? '')}
                            onChange={(e) => updateRow(r.id, { discount_value: Number(e.target.value) })}
                            inputMode="decimal"
                            className="bg-white"
                          />
                          <div className="text-xs text-muted-foreground">
                            {r.discount_type === 'percentage' ? '% off subtotal' : '৳ off subtotal'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Min purchase (৳)</Label>
                          <Input
                            value={String(r.min_purchase ?? 0)}
                            onChange={(e) => updateRow(r.id, { min_purchase: Number(e.target.value) })}
                            inputMode="decimal"
                            className="bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Max uses</Label>
                          <Input
                            value={r.max_uses === null ? '' : String(r.max_uses)}
                            onChange={(e) => updateRow(r.id, { max_uses: e.target.value === '' ? null : Number(e.target.value) })}
                            inputMode="numeric"
                            placeholder="Unlimited"
                            className="bg-white"
                          />
                          <div className="text-xs text-muted-foreground">Used: {r.current_uses ?? 0}</div>
                        </div>

                        <div className="space-y-2">
                          <Label>Valid from</Label>
                          <Input
                            type="datetime-local"
                            value={toLocalDatetimeInput(r.valid_from)}
                            onChange={(e) => updateRow(r.id, { valid_from: toISOorNull(e.target.value) })}
                            className="bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Valid until</Label>
                          <Input
                            type="datetime-local"
                            value={toLocalDatetimeInput(r.valid_until)}
                            onChange={(e) => updateRow(r.id, { valid_until: toISOorNull(e.target.value) })}
                            className="bg-white"
                          />
                          <div className="text-xs text-muted-foreground">Blank = no expiry</div>
                        </div>

                        <div className="space-y-2">
                          <Label>Active</Label>
                          <div className="flex items-center gap-3">
                            <Switch checked={!!r.is_active} onCheckedChange={(v) => updateRow(r.id, { is_active: v })} />
                            <span className="text-sm text-muted-foreground">{r.is_active ? 'On' : 'Off'}</span>
                          </div>
                        </div>
                      </div>

                      <Button variant="destructive" size="sm" onClick={() => void removeRow(r.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
