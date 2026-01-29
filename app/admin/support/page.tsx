'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  User,
  Archive,
  Pin,
  RefreshCcw,
  SlidersHorizontal,
  Image as ImageIcon,
} from 'lucide-react';

type Ticket = any;

const BUCKET = 'support-attachments';

export default function SupportDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters + search + sort (Kommunicate-like)
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [orderFilter, setOrderFilter] = useState<'all' | 'with_order' | 'no_order'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Pinned (client-side)
  const [pinned, setPinned] = useState<string[]>([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);

  // Split inbox: active ticket
  const [activeId, setActiveId] = useState<string | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // SLA toast only once per ticket per page load (optional field)
  const [slaToasted, setSlaToasted] = useState<Record<string, boolean>>({});

  // Attachments for active ticket
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  /* ================= HELPERS ================= */

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'open':
        return <Badge variant="destructive">Open</Badge>;
      case 'in_progress':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border">
            Processing
          </Badge>
        );
      case 'resolved':
        return (
          <Badge variant="default" className="bg-green-600">
            Resolved
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="outline" className="text-gray-500">
            Closed
          </Badge>
        );
      default:
        return <Badge variant="outline">{s || '—'}</Badge>;
    }
  };

  const getPriorityBadge = (p?: string) => {
    const s = (p || '').toLowerCase();
    if (s === 'high') return <Badge className="bg-red-600 text-white">HIGH</Badge>;
    if (s === 'medium') return <Badge className="bg-orange-500 text-white">MEDIUM</Badge>;
    if (s === 'low') return <Badge className="bg-gray-200 text-gray-700">LOW</Badge>;
    return <Badge variant="outline">—</Badge>;
  };

  const getTypeBadge = (t?: string) => {
    const s = (t || '').trim();
    if (!s) return <Badge variant="outline">—</Badge>;
    return (
      <Badge variant="outline" className="capitalize">
        {s}
      </Badge>
    );
  };

  const hasSla = (t: any) => typeof t?.sla_due_at === 'string' && t.sla_due_at.length > 0;

  const isSlaBreached = (t: any) => (hasSla(t) ? new Date(t.sla_due_at) < new Date() : false);

  const isSlaRisk = (t: any) => {
    if (!hasSla(t)) return false;
    const diffMs = new Date(t.sla_due_at).getTime() - Date.now();
    return diffMs > 0 && diffMs < 4 * 60 * 60 * 1000; // next 4h
  };

  const togglePin = (id: string) => {
    setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const renderAttachments = (list: any[]) => {
    if (!list || list.length === 0) return null;

    return (
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {list.map((a) => (
          <a
            key={a.id}
            href={a.url || '#'}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg overflow-hidden border bg-white hover:shadow-sm"
          >
            <div className="relative w-full h-28 bg-gray-100">
              <SafeImage src={a.url || ''} alt={a.file_name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
            </div>
            <div className="p-2 text-[11px] text-gray-600 truncate">{a.file_name}</div>
          </a>
        ))}
      </div>
    );
  };

  const loadAttachments = async (ticketId: string) => {
    setAttachmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const withUrls = await Promise.all(
        (data || []).map(async (a: any) => {
          const { data: signed, error: signErr } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(a.file_path, 60 * 60); // 1 hour
          if (signErr) {
            // If signed URL fails for any reason, still return the row so UI can show filename.
            return { ...a, url: null };
          }
          return { ...a, url: signed?.signedUrl || null };
        })
      );

      setAttachments(withUrls);
    } catch (e: any) {
      console.error(e);
      setAttachments([]);
      toast({
        title: 'Could not load attachments',
        description: e?.message || 'Try again',
        variant: 'destructive',
      });
    } finally {
      setAttachmentsLoading(false);
    }
  };

  /* ================= DATA ================= */

  // Load pins
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pinnedTickets');
      if (stored) setPinned(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  // Save pins
  useEffect(() => {
    try {
      localStorage.setItem('pinnedTickets', JSON.stringify(pinned));
    } catch {
      // ignore
    }
  }, [pinned]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }

    runAutoClose();
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  // --- ROBUST DATA FETCHING ---
  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(
          `
          *,
          profiles:user_id ( full_name, email, phone )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets(data || []);

      // set default active ticket if none
      if (!activeId && data && data.length > 0) setActiveId(data[0].id);
    } catch (err) {
      console.error('Fetch Error:', err);
      // fallback: plain tickets
      const { data: fallback } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      setTickets(fallback || []);
      if (!activeId && fallback && fallback.length > 0) setActiveId(fallback[0].id);
    } finally {
      setLoading(false);
    }
  };

  // --- AUTO CLOSE (Fail-Safe) ---
  const runAutoClose = async () => {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: toClose } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('status', 'resolved')
        .lt('updated_at', threeDaysAgo.toISOString());

      if (toClose && toClose.length > 0) {
        const ids = toClose.map((t: any) => t.id);
        await supabase.from('support_tickets').update({ status: 'closed' }).in('id', ids);
      }
    } catch (e) {
      console.warn('Auto-close failed, ignoring.', e);
    }
  };

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('support-tickets-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SLA breach toast (optional field)
  useEffect(() => {
    const next = { ...slaToasted };

    tickets.forEach((t: any) => {
      if (!t?.id || next[t.id]) return;
      if (hasSla(t) && new Date(t.sla_due_at) < new Date()) {
        next[t.id] = true;
        toast({
          title: 'SLA Breached',
          description: `Ticket ${t.ticket_number} is overdue`,
          variant: 'destructive',
        });
      }
    });

    if (Object.keys(next).length !== Object.keys(slaToasted).length) {
      setSlaToasted(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  /* ================= DERIVED ================= */

  const stats = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === 'open').length,
      inProgress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
    }),
    [tickets]
  );

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => {
      const v = (t?.type || '').toString().trim();
      if (v) set.add(v);
    });
    // Common types first, then rest
    const common = ['inquiry', 'complaint', 'refund', 'return', 'delivery', 'payment'];
    const rest = Array.from(set).filter((x) => !common.includes(x.toLowerCase()));
    const merged = [
      ...common.filter((x) => Array.from(set).some((s) => s.toLowerCase() === x)),
      ...rest,
    ];
    return merged.length ? merged : common;
  }, [tickets]);

  const displayedTickets = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();

    let filtered = tickets.filter((t) => {
      const email = t.email || t.profiles?.email || '';
      const subject = t.subject || '';
      const ticketNum = t.ticket_number || '';
      const msg = t.message || '';

      const matchesSearch =
        subject.toLowerCase().includes(searchLower) ||
        ticketNum.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        msg.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      if (pinnedOnly && !pinned.includes(t.id)) return false;

      if (priorityFilter !== 'all') {
        const p = (t.priority || '').toLowerCase();
        if (p !== priorityFilter) return false;
      }

      if (typeFilter !== 'all') {
        const ty = (t.type || '').toLowerCase();
        if (ty !== String(typeFilter).toLowerCase()) return false;
      }

      const hasOrder = Boolean(t.order_id);
      if (orderFilter === 'with_order' && !hasOrder) return false;
      if (orderFilter === 'no_order' && hasOrder) return false;

      return true;
    });

    // pinned first
    filtered.sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)));

    // sorting
    const created = (x: any) => new Date(x.created_at).getTime();
    const updated = (x: any) => new Date(x.updated_at || x.created_at).getTime();

    filtered.sort((a, b) => {
      if (sortBy === 'newest') return created(b) - created(a);
      if (sortBy === 'oldest') return created(a) - created(b);
      if (sortBy === 'updated') return updated(b) - updated(a);
      return 0;
    });

    return filtered;
  }, [
    tickets,
    searchQuery,
    pinned,
    statusFilter,
    pinnedOnly,
    priorityFilter,
    typeFilter,
    orderFilter,
    sortBy,
  ]);

  const activeTicket = useMemo(() => {
    const t = displayedTickets.find((x) => x.id === activeId) || tickets.find((x) => x.id === activeId);
    return t || null;
  }, [activeId, displayedTickets, tickets]);

  useEffect(() => {
    // Keep active ticket valid when filters change
    if (activeId && displayedTickets.some((t) => t.id === activeId)) return;
    if (displayedTickets.length > 0) setActiveId(displayedTickets[0].id);
    else setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, typeFilter, orderFilter, pinnedOnly, searchQuery, sortBy]);

  // Load attachments when active ticket changes
  useEffect(() => {
    if (!activeId) {
      setAttachments([]);
      return;
    }
    void loadAttachments(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const allOnListSelected =
    displayedTickets.length > 0 && displayedTickets.every((t) => selected[t.id]);

  const toggleSelectAll = (checked: boolean) => {
    const next = { ...selected };
    displayedTickets.forEach((t) => {
      next[t.id] = checked;
    });
    setSelected(next);
  };

  /* ================= MUTATIONS ================= */

  const updateTicket = async (id: string, patch: Record<string, any>) => {
    try {
      const { error } = await supabase.from('support_tickets').update(patch).eq('id', id);
      if (error) throw error;

      toast({ title: 'Updated', description: 'Ticket updated successfully.' });
      fetchTickets();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Update failed',
        description: e?.message || 'Could not update ticket',
        variant: 'destructive',
      });
    }
  };

  const bulkUpdate = async (patch: Record<string, any>) => {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase.from('support_tickets').update(patch).in('id', selectedIds);
      if (error) throw error;

      toast({
        title: 'Bulk updated',
        description: `Updated ${selectedIds.length} tickets.`,
      });
      setSelected({});
      fetchTickets();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Bulk update failed',
        description: e?.message || 'Could not update tickets',
        variant: 'destructive',
      });
    }
  };

  const bulkPin = (pin: boolean) => {
    if (selectedIds.length === 0) return;
    if (pin) {
      setPinned((prev) => Array.from(new Set([...prev, ...selectedIds])));
    } else {
      setPinned((prev) => prev.filter((id) => !selectedIds.includes(id)));
    }
    setSelected({});
    toast({
      title: pin ? 'Pinned' : 'Unpinned',
      description: `${selectedIds.length} tickets`,
    });
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="w-full px-3 md:px-4 py-8 flex-1">
        {/* Top header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Support Center</h1>
              <p className="text-sm text-gray-500 mt-1">Inbox-style ticket management (Kommunicate-like)</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search subject, message, ticket #, email..."
                className="pl-9 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px] bg-white">
                <Filter className="w-4 h-4 mr-2 text-gray-500" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">Processing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Priority: All</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Type: All</SelectItem>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={orderFilter} onValueChange={(v) => setOrderFilter(v as any)}>
              <SelectTrigger className="w-[170px] bg-white">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Order: All</SelectItem>
                <SelectItem value="with_order">With Order</SelectItem>
                <SelectItem value="no_order">No Order</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={pinnedOnly ? 'default' : 'outline'}
              size="sm"
              className={pinnedOnly ? 'bg-blue-900 hover:bg-blue-800' : ''}
              onClick={() => setPinnedOnly((x) => !x)}
              title="Show pinned only"
            >
              <Pin className="w-4 h-4 mr-2" />
              Pinned
            </Button>

            <Button variant="outline" size="sm" onClick={fetchTickets} title="Refresh">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Open</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.open}</h3>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500 opacity-20" />
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Processing</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.inProgress}</h3>
              </div>
              <Clock className="h-8 w-8 text-blue-500 opacity-20" />
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Resolved</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.resolved}</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-gray-400 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Closed</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.closed}</h3>
              </div>
              <Archive className="h-8 w-8 text-gray-400 opacity-20" />
            </CardContent>
          </Card>
        </div>

        {/* Split Inbox Layout (Kommunicate-like) */}
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
          {/* LEFT: Ticket list */}
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between space-y-0 px-4 py-3">
              <CardTitle className="text-base font-semibold">Inbox</CardTitle>
              <div className="text-xs text-gray-500">
                {displayedTickets.length} shown • {tickets.length} total
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-10 text-center text-gray-500">Loading…</div>
              ) : displayedTickets.length === 0 ? (
                <div className="p-10 text-center text-gray-500">🎉 No tickets match this filter</div>
              ) : (
                <>
                  {/* Bulk bar */}
                  <div className="px-4 py-3 border-b bg-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={displayedTickets.length > 0 && displayedTickets.every((t) => selected[t.id])}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="h-4 w-4"
                        title="Select all"
                      />
                      <span className="text-sm text-gray-600">
                        {selectedIds.length > 0 ? (
                          <>
                            <b>{selectedIds.length}</b> selected
                          </>
                        ) : (
                          'Select'
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value="__none"
                        onValueChange={(v) => {
                          if (v === '__none') return;
                          if (v === 'pin') bulkPin(true);
                          if (v === 'unpin') bulkPin(false);
                          if (v === 'open') bulkUpdate({ status: 'open' });
                          if (v === 'in_progress') bulkUpdate({ status: 'in_progress' });
                          if (v === 'resolved') bulkUpdate({ status: 'resolved' });
                          if (v === 'closed') bulkUpdate({ status: 'closed' });
                          if (v === 'p_high') bulkUpdate({ priority: 'high' });
                          if (v === 'p_medium') bulkUpdate({ priority: 'medium' });
                          if (v === 'p_low') bulkUpdate({ priority: 'low' });
                        }}
                      >
                        <SelectTrigger className="w-[190px] bg-white h-9">
                          <SlidersHorizontal className="w-4 h-4 mr-2 text-gray-500" />
                          <SelectValue placeholder="Bulk actions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Bulk actions</SelectItem>
                          <SelectItem value="pin">Pin selected</SelectItem>
                          <SelectItem value="unpin">Unpin selected</SelectItem>
                          <SelectItem value="open">Mark Open</SelectItem>
                          <SelectItem value="in_progress">Mark Processing</SelectItem>
                          <SelectItem value="resolved">Mark Resolved</SelectItem>
                          <SelectItem value="closed">Mark Closed</SelectItem>
                          <SelectItem value="p_high">Set Priority: High</SelectItem>
                          <SelectItem value="p_medium">Set Priority: Medium</SelectItem>
                          <SelectItem value="p_low">Set Priority: Low</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => setSelected({})}
                        disabled={selectedIds.length === 0}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Ticket list */}
                  <div className="divide-y bg-white max-h-[70vh] overflow-auto">
                    {displayedTickets.map((t) => {
                      const pinnedRow = pinned.includes(t.id);
                      const breached = isSlaBreached(t);
                      const risk = isSlaRisk(t);
                      const isActive = t.id === activeId;

                      return (
                        <button
                          key={t.id}
                          onClick={() => setActiveId(t.id)}
                          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                            isActive ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={Boolean(selected[t.id])}
                              onChange={(e) =>
                                setSelected((prev) => ({ ...prev, [t.id]: e.target.checked }))
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 h-4 w-4"
                              title="Select"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-gray-900 truncate">{t.subject || '—'}</div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {pinnedRow && <Pin className="w-4 h-4 text-yellow-500" />}
                                  <span className="text-xs text-gray-400">
                                    {timeAgo(t.updated_at || t.created_at)}
                                  </span>
                                </div>
                              </div>

                              <div className="text-xs text-gray-500 mt-1 line-clamp-1">{t.message || '—'}</div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {getStatusBadge(t.status)}
                                {getPriorityBadge(t.priority)}
                                {getTypeBadge(t.type)}

                                {breached && (
                                  <Badge variant="destructive" className="w-fit">
                                    SLA Breached
                                  </Badge>
                                )}
                                {!breached && risk && (
                                  <Badge className="bg-orange-500 text-white w-fit">SLA Risk</Badge>
                                )}
                              </div>

                              <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="truncate">
                                  {t.profiles?.full_name || 'Guest'} • {t.profiles?.email || t.email || '—'}
                                </span>
                                {t.order_id ? (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <span className="font-mono">Order {String(t.order_id).slice(0, 8)}…</span>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(t.id);
                              }}
                              title={pinnedRow ? 'Unpin' : 'Pin'}
                              className="mt-0.5"
                            >
                              <Pin className={`w-4 h-4 ${pinnedRow ? 'text-yellow-500' : 'text-gray-400'}`} />
                            </Button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Ticket details */}
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between space-y-0 px-4 py-3">
              <CardTitle className="text-base font-semibold">Ticket Details</CardTitle>
              {activeTicket?.id ? (
                <Link href={`/admin/support/${activeTicket.id}`}>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50">
                    Open Manage Page <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              ) : null}
            </CardHeader>

            <CardContent className="p-4">
              {!activeTicket ? (
                <div className="p-10 text-center text-gray-500">Select a ticket to view details.</div>
              ) : (
                <div className="space-y-5">
                  {/* Top meta */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 font-mono">{activeTicket.ticket_number || activeTicket.id}</div>
                      <h2 className="text-xl font-bold text-gray-900 mt-1 break-words">{activeTicket.subject || '—'}</h2>
                      <div className="text-sm text-gray-500 mt-1">
                        Created {activeTicket.created_at ? timeAgo(activeTicket.created_at) : '—'} • Updated{' '}
                        {activeTicket.updated_at ? timeAgo(activeTicket.updated_at) : '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePin(activeTicket.id)}
                        title={pinned.includes(activeTicket.id) ? 'Unpin' : 'Pin'}
                      >
                        <Pin
                          className={`w-4 h-4 mr-2 ${
                            pinned.includes(activeTicket.id) ? 'text-yellow-500' : 'text-gray-500'
                          }`}
                        />
                        {pinned.includes(activeTicket.id) ? 'Pinned' : 'Pin'}
                      </Button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(activeTicket.status)}
                    {getPriorityBadge(activeTicket.priority)}
                    {getTypeBadge(activeTicket.type)}
                    {isSlaBreached(activeTicket) && (
                      <Badge variant="destructive" className="w-fit">
                        SLA Breached
                      </Badge>
                    )}
                    {!isSlaBreached(activeTicket) && isSlaRisk(activeTicket) && (
                      <Badge className="bg-orange-500 text-white w-fit">SLA Risk</Badge>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Status</div>
                      <Select
                        value={activeTicket.status || 'open'}
                        onValueChange={(v) => updateTicket(activeTicket.id, { status: v })}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">Processing</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Priority</div>
                      <Select
                        value={(activeTicket.priority || 'medium').toLowerCase()}
                        onValueChange={(v) => updateTicket(activeTicket.id, { priority: v })}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Type</div>
                      <Select
                        value={activeTicket.type || 'inquiry'}
                        onValueChange={(v) => updateTicket(activeTicket.id, { type: v })}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Customer */}
                  <Card className="border shadow-none">
                    <CardHeader className="py-3 px-4 border-b bg-white flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-semibold">Customer</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-900 font-medium flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {activeTicket.profiles?.full_name || 'Guest'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{activeTicket.profiles?.email || activeTicket.email || '—'}</div>
                      <div className="text-sm text-gray-600 mt-1">{activeTicket.profiles?.phone || '—'}</div>
                    </CardContent>
                  </Card>

                  {/* Message + Attachments */}
                  <Card className="border shadow-none">
                    <CardHeader className="py-3 px-4 border-b bg-white flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        Message
                        <span className="text-xs text-gray-400 font-normal">
                          {attachmentsLoading ? '• loading images…' : attachments.length ? `• ${attachments.length} file(s)` : ''}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{activeTicket.message || '—'}</div>

                      {/* Ticket-level attachments only (no reply_id) */}
                      {attachmentsLoading ? (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                          <ImageIcon className="w-4 h-4" /> Loading attachments…
                        </div>
                      ) : (
                        renderAttachments(attachments.filter((a) => !a.reply_id))
                      )}
                    </CardContent>
                  </Card>

                  {/* Order / meta */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card className="border shadow-none">
                      <CardHeader className="py-3 px-4 border-b bg-white flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-semibold">Order</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        {activeTicket.order_id ? (
                          <div className="text-sm text-gray-800">
                            Linked order: <span className="font-mono">{String(activeTicket.order_id)}</span>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No order linked</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border shadow-none">
                      <CardHeader className="py-3 px-4 border-b bg-white flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-semibold">SLA</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        {hasSla(activeTicket) ? (
                          <div className="space-y-2">
                            <div className="text-sm text-gray-800">
                              Due: {new Date(activeTicket.sla_due_at).toLocaleString()}
                            </div>
                            {isSlaBreached(activeTicket) ? (
                              <Badge variant="destructive" className="w-fit">
                                Breached
                              </Badge>
                            ) : isSlaRisk(activeTicket) ? (
                              <Badge className="bg-orange-500 text-white w-fit">Risk</Badge>
                            ) : (
                              <Badge variant="outline" className="w-fit">
                                On track
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No SLA configured</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Small note: full thread images are shown on Manage page */}
                  <div className="text-xs text-gray-400">
                    Note: Reply-level images are shown on the ticket manage page (thread view).
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
