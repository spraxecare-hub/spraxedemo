'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Send,
  User,
  Mail,
  Phone,
  Pin,
  Copy,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Tag,
  FileText,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TicketPageProps {
  params: { ticketId: string };
}

type Ticket = any;

const BUCKET = 'support-attachments';

const statusBadge = (s: string) => {
  switch (s) {
    case 'open':
      return <Badge variant="destructive">OPEN</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-800 border">PROCESSING</Badge>;
    case 'resolved':
      return <Badge className="bg-green-600 text-white">RESOLVED</Badge>;
    case 'closed':
      return (
        <Badge variant="outline" className="text-gray-500">
          CLOSED
        </Badge>
      );
    default:
      return <Badge variant="outline">{String(s || '—').toUpperCase()}</Badge>;
  }
};

const priorityBadge = (p?: string) => {
  const s = (p || '').toLowerCase();
  if (s === 'high') return <Badge className="bg-red-600 text-white">HIGH</Badge>;
  if (s === 'medium') return <Badge className="bg-orange-500 text-white">MEDIUM</Badge>;
  if (s === 'low') return <Badge className="bg-gray-200 text-gray-700">LOW</Badge>;
  return <Badge variant="outline">—</Badge>;
};

const typeBadge = (t?: string) => {
  const s = (t || '').trim();
  if (!s) return <Badge variant="outline">—</Badge>;
  return (
    <Badge variant="outline" className="capitalize">
      {s}
    </Badge>
  );
};

export default function TicketDetailPage({ params }: TicketPageProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [relatedOrder, setRelatedOrder] = useState<any>(null);
  const [relatedTickets, setRelatedTickets] = useState<any[]>([]);

  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // SLA
  const [slaRemaining, setSlaRemaining] = useState<number | null>(null);

  // Pinned (localStorage like inbox)
  const [pinned, setPinned] = useState<string[]>([]);

  // “Kommunicate-like” extras
  const [markResolvedOnSend, setMarkResolvedOnSend] = useState(true);
  const [sendEmailOnSend, setSendEmailOnSend] = useState(true);

  // tags (optional column)
  const [tagsInput, setTagsInput] = useState('');

  // internal notes (safe fallback: localStorage per ticket)
  const [internalNote, setInternalNote] = useState('');
  const [notes, setNotes] = useState<{ at: string; text: string; by: string }[]>([]);

  // ✅ Attachments (ticket + replies)
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // templates
  const templates = useMemo(
    () => [
      {
        label: 'Shipping delay apology',
        body:
          "Hi! Thanks for reaching out.\n\nWe're sorry for the delay. We’re checking your order status and will update you shortly.\n\n— Support Team",
      },
      {
        label: 'Need more info',
        body:
          "Hi! To help you faster, could you please share:\n- Order number\n- Phone number\n- Any screenshots (if applicable)\n\nThanks!\n— Support Team",
      },
      {
        label: 'Resolved confirmation',
        body:
          "Hi! We’ve resolved this issue on our end.\n\nPlease confirm if everything looks good now.\n\n— Support Team",
      },
    ],
    []
  );

  /* ================= Attachments helpers ================= */

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
              <Image
                src={a.url || '/placeholder.png'}
                alt={a.file_name}
                fill
                unoptimized
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
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
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(a.file_path, 60 * 60); // 1 hour

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

  /* ================= LocalStorage: pins + notes ================= */

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pinnedTickets');
      if (stored) setPinned(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pinnedTickets', JSON.stringify(pinned));
    } catch {
      // ignore
    }
  }, [pinned]);

  const notesKey = useMemo(() => `ticketNotes:${params.ticketId}`, [params.ticketId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notesKey);
      if (raw) setNotes(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [notesKey]);

  useEffect(() => {
    try {
      localStorage.setItem(notesKey, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes, notesKey]);

  const isPinned = useMemo(() => pinned.includes(params.ticketId), [pinned, params.ticketId]);

  const togglePin = () => {
    setPinned((prev) =>
      prev.includes(params.ticketId) ? prev.filter((x) => x !== params.ticketId) : [...prev, params.ticketId]
    );
  };

  /* ================= Fetch ================= */

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role, params.ticketId]);

  const fetchData = async () => {
    setLoading(true);

    try {
      // 1) Ticket (try join)
      let { data: ticketData } = await supabase
        .from('support_tickets')
        .select(`*, profiles:user_id (*)`)
        .eq('id', params.ticketId)
        .single();

      // fallback if join fails
      if (!ticketData) {
        const { data: raw } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('id', params.ticketId)
          .single();
        if (raw) ticketData = { ...raw, profiles: null };
      }

      setTicket(ticketData || null);

      // tags input (supports text[] or comma string)
      const maybeTags = (ticketData as any)?.tags;
      if (Array.isArray(maybeTags)) setTagsInput(maybeTags.join(', '));
      else if (typeof maybeTags === 'string') setTagsInput(maybeTags);
      else setTagsInput('');

      // 2) Replies
      const { data: repliesData } = await supabase
        .from('ticket_replies')
        .select(`*, profiles:user_id (full_name, role)`)
        .eq('ticket_id', params.ticketId)
        .order('created_at', { ascending: true });

      setReplies(repliesData || []);

      // ✅ 2.5) Attachments (ticket + reply)
      await loadAttachments(params.ticketId);

      // 3) Related order
      if (ticketData?.order_id) {
        const { data: order } = await supabase.from('orders').select('*').eq('id', ticketData.order_id).single();
        setRelatedOrder(order || null);
      } else {
        setRelatedOrder(null);
      }

      // 4) Related tickets (same customer by user_id or email)
      const sameUserId = ticketData?.user_id;
      const sameEmail = ticketData?.profiles?.email || ticketData?.email;

      let rel: any[] = [];
      if (sameUserId) {
        const { data: relByUser } = await supabase
          .from('support_tickets')
          .select('id, ticket_number, subject, status, created_at, updated_at')
          .eq('user_id', sameUserId)
          .neq('id', params.ticketId)
          .order('created_at', { ascending: false })
          .limit(5);
        rel = relByUser || [];
      } else if (sameEmail) {
        const { data: relByEmail } = await supabase
          .from('support_tickets')
          .select('id, ticket_number, subject, status, created_at, updated_at')
          .eq('email', sameEmail)
          .neq('id', params.ticketId)
          .order('created_at', { ascending: false })
          .limit(5);
        rel = relByEmail || [];
      }
      setRelatedTickets(rel);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load ticket.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /* ================= Realtime replies ================= */

  useEffect(() => {
    if (!ticket?.id) return;

    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_replies', filter: `ticket_id=eq.${ticket.id}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticket.id}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_attachments', filter: `ticket_id=eq.${ticket.id}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  /* ================= SLA countdown ================= */

  useEffect(() => {
    if (!ticket?.sla_due_at) {
      setSlaRemaining(null);
      return;
    }

    const due = new Date(ticket.sla_due_at).getTime();

    const tick = () => {
      const diffSec = Math.floor((due - Date.now()) / 1000);
      setSlaRemaining(diffSec);
    };

    tick();
    const interval = setInterval(tick, 1000);

    if (due < Date.now()) {
      toast({
        title: 'SLA Breached',
        description: 'This ticket has exceeded SLA.',
        variant: 'destructive',
      });
    }

    return () => clearInterval(interval);
  }, [ticket?.sla_due_at, toast]);

  /* ================= Keyboard shortcuts ================= */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') handleSendReply();
      if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        fetchData();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyMessage, ticket?.id, sendEmailOnSend, markResolvedOnSend]);

  /* ================= Mutations ================= */

  const handleUpdateStatus = async (newStatus: string) => {
    if (!ticket?.id) return;

    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticket.id);

    if (!error) {
      setTicket({ ...ticket, status: newStatus });
      toast({ title: 'Status Updated', description: `Ticket marked as ${newStatus}` });
    } else {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

  const updateTicketFields = async (patch: Record<string, any>) => {
    if (!ticket?.id) return;
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);

      if (error) throw error;
      toast({ title: 'Updated', description: 'Ticket updated.' });
      fetchData();
    } catch (e: any) {
      toast({
        title: 'Update failed',
        description: e?.message || 'Could not update ticket',
        variant: 'destructive',
      });
    }
  };

  const saveTags = async () => {
    const raw = tagsInput.trim();
    const arr = raw ? raw.split(',').map((x) => x.trim()).filter(Boolean) : [];
    await updateTicketFields({ tags: arr });
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim()) return;

    if (ticket?.status === 'closed') {
      toast({
        title: 'Ticket Closed',
        description: 'Closed tickets cannot be replied to.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    const targetEmail = ticket?.profiles?.email || ticket?.email;

    try {
      const { error: dbError } = await supabase.from('ticket_replies').insert({
        ticket_id: ticket.id,
        user_id: user?.id,
        message: replyMessage,
      });
      if (dbError) throw dbError;

      if (sendEmailOnSend && targetEmail) {
        await fetch('/api/support/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: ticket.id,
            customerEmail: targetEmail,
            subject: ticket.subject,
            message: replyMessage,
            agentName: profile?.full_name || 'Admin',
          }),
        });
      }

      if (markResolvedOnSend) {
        await supabase
          .from('support_tickets')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('id', ticket.id);
      }

      setReplyMessage('');
      fetchData();
      toast({
        title: 'Sent',
        description: sendEmailOnSend ? 'Reply saved and email sent.' : 'Reply saved.',
      });
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to send reply.', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const addInternalNote = () => {
    const txt = internalNote.trim();
    if (!txt) return;
    setNotes((prev) => [
      { at: new Date().toISOString(), text: txt, by: profile?.full_name || 'Admin' },
      ...prev,
    ]);
    setInternalNote('');
    toast({ title: 'Saved', description: 'Internal note saved (local).' });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: 'Copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy.', variant: 'destructive' });
    }
  };

  if (loading && !ticket) return <div className="p-10 text-center">Loading...</div>;
  if (!ticket) return <div className="p-10 text-center">Ticket not found.</div>;

  const displayName = ticket.profiles?.full_name || 'Guest';
  const displayEmail = ticket.profiles?.email || ticket.email || 'N/A';
  const displayPhone = ticket.profiles?.phone || 'N/A';
  const isClosed = ticket.status === 'closed';

  const slaLabel = (() => {
    if (slaRemaining === null) return null;
    if (slaRemaining <= 0) return 'SLA Breached';
    const h = Math.floor(slaRemaining / 3600);
    const m = Math.floor((slaRemaining % 3600) / 60);
    return `SLA in ${h}h ${m}m`;
  })();

  const slaState = (() => {
    if (slaRemaining === null) return 'none';
    if (slaRemaining <= 0) return 'breached';
    if (slaRemaining < 4 * 60 * 60) return 'risk';
    return 'ok';
  })();

  const ticketAttachments = attachments.filter((a) => !a.reply_id);
  const replyAttachmentsById = (replyId: string) => attachments.filter((a) => a.reply_id === replyId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <div className="w-full px-3 md:px-4 py-6 flex-1">
        {/* Top Bar */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-5 gap-4">
          <div className="flex items-start gap-3">
            <Link href="/admin/support">
              <Button variant="ghost" size="icon" title="Back to inbox">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 font-mono text-sm">
                  #{ticket.ticket_number || ticket.id}
                </span>

                {statusBadge(ticket.status)}
                {priorityBadge(ticket.priority)}
                {typeBadge(ticket.type)}

                {slaLabel && (
                  <Badge
                    variant={slaState === 'breached' ? 'destructive' : 'outline'}
                    className={slaState === 'risk' ? 'border-orange-400 text-orange-600' : ''}
                  >
                    {slaLabel}
                  </Badge>
                )}

                {isPinned && (
                  <Badge className="bg-yellow-100 text-yellow-800 border">
                    <Pin className="w-3.5 h-3.5 mr-1" /> Pinned
                  </Badge>
                )}

                {/* ✅ attachments count */}
                <Badge variant="outline" className="text-gray-600">
                  <ImageIcon className="w-3.5 h-3.5 mr-1" />
                  {attachmentsLoading ? 'Images…' : `${attachments.length} file(s)`}
                </Badge>
              </div>

              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mt-1 break-words">
                {ticket.subject}
              </h1>

              <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-3">
                <span>Created: {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'}</span>
                <span>Updated: {ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : '—'}</span>
                <button
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  onClick={() => copyToClipboard(ticket.id)}
                  title="Copy ticket UUID"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy ID
                </button>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={togglePin}>
              <Pin className={`w-4 h-4 mr-2 ${isPinned ? 'text-yellow-500' : 'text-gray-500'}`} />
              {isPinned ? 'Unpin' : 'Pin'}
            </Button>

            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Select value={ticket.status} onValueChange={handleUpdateStatus} disabled={isClosed}>
              <SelectTrigger className="w-[170px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">Processing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={(ticket.priority || 'medium').toLowerCase()}
              onValueChange={(v) => updateTicketFields({ priority: v })}
              disabled={isClosed}
            >
              <SelectTrigger className="w-[170px] bg-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={ticket.type || 'inquiry'}
              onValueChange={(v) => updateTicketFields({ type: v })}
              disabled={isClosed}
            >
              <SelectTrigger className="w-[170px] bg-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inquiry">inquiry</SelectItem>
                <SelectItem value="complaint">complaint</SelectItem>
                <SelectItem value="refund">refund</SelectItem>
                <SelectItem value="return">return</SelectItem>
                <SelectItem value="delivery">delivery</SelectItem>
                <SelectItem value="payment">payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT: Conversation */}
          <div className="lg:col-span-2 space-y-4">
            {/* Original Message */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm bg-blue-50/30">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                      {displayName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{displayName}</div>
                      <div className="text-xs text-gray-500">Original Message</div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
                {ticket.message}

                {/* ✅ Ticket-level images */}
                {attachmentsLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                    <ImageIcon className="w-4 h-4" /> Loading attachments…
                  </div>
                ) : (
                  renderAttachments(ticketAttachments)
                )}
              </CardContent>
            </Card>

            {/* Replies */}
            {replies.map((reply) => {
              const isAdmin = reply.profiles?.role === 'admin';
              const rFiles = replyAttachmentsById(reply.id);

              return (
                <div key={reply.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <Card className={`max-w-[85%] shadow-sm ${isAdmin ? 'bg-white border-blue-100' : 'bg-gray-50'}`}>
                    <CardHeader className="pb-2 p-4">
                      <div className="flex justify-between items-center gap-4">
                        <span className={`text-xs font-bold ${isAdmin ? 'text-blue-700' : 'text-gray-700'}`}>
                          {isAdmin ? 'Support Team' : displayName}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {reply.created_at ? new Date(reply.created_at).toLocaleString() : '—'}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-0 text-sm text-gray-700 whitespace-pre-wrap">
                      {reply.message}

                      {/* ✅ Reply-level images */}
                      {attachmentsLoading ? null : renderAttachments(rFiles)}
                    </CardContent>
                  </Card>
                </div>
              );
            })}

            {/* Reply Box */}
            <Card className="shadow-md border-gray-200">
              <CardHeader className="pb-2 bg-gray-50 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-600" /> Reply
                  </span>
                  <span className="text-xs text-gray-400">Ctrl + Enter to send • Ctrl + R refresh</span>
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-gray-500">
                  <div>
                    To: <span className="font-medium text-gray-700">{displayEmail}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value="__none"
                      onValueChange={(v) => {
                        if (v === '__none') return;
                        const t = templates.find((x) => x.label === v);
                        if (t) setReplyMessage(t.body);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[220px] bg-white">
                        <SelectValue placeholder="Reply templates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Reply templates</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t.label} value={t.label}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant={sendEmailOnSend ? 'default' : 'outline'}
                      size="sm"
                      className={sendEmailOnSend ? 'bg-blue-900 hover:bg-blue-800 h-8' : 'h-8'}
                      onClick={() => setSendEmailOnSend((x) => !x)}
                      title="Toggle sending email"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email: {sendEmailOnSend ? 'On' : 'Off'}
                    </Button>

                    <Button
                      variant={markResolvedOnSend ? 'default' : 'outline'}
                      size="sm"
                      className={markResolvedOnSend ? 'bg-green-600 hover:bg-green-700 h-8' : 'h-8'}
                      onClick={() => setMarkResolvedOnSend((x) => !x)}
                      title="Toggle marking resolved on send"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Resolve: {markResolvedOnSend ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>

                <Textarea
                  placeholder={isClosed ? 'Ticket is closed.' : 'Type your reply...'}
                  className="min-h-[140px]"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  disabled={isClosed}
                />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    {ticket.status === 'open' ? (
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Ticket is open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Status: {String(ticket.status).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <Button
                    className="bg-blue-900 hover:bg-blue-800"
                    onClick={handleSendReply}
                    disabled={isSending || isClosed}
                  >
                    {isSending ? 'Sending...' : 'Send Reply'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Internal notes (safe, local) */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  Internal Notes (local)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <Textarea
                  placeholder="Write an internal note (not sent to customer)..."
                  className="min-h-[90px]"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={addInternalNote}>
                    Save note
                  </Button>
                </div>

                {notes.length > 0 && (
                  <div className="space-y-2">
                    {notes.map((n, idx) => (
                      <div key={idx} className="rounded-md border bg-white p-3">
                        <div className="text-xs text-gray-500 flex justify-between gap-2">
                          <span className="font-medium text-gray-700">{n.by}</span>
                          <span>{new Date(n.at).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{n.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-4">
            {/* Customer */}
            <Card>
              <CardHeader className="bg-gray-50 pb-3">
                <CardTitle className="text-sm">Customer</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-sm space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" /> {displayName}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" /> {displayEmail}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" /> {displayPhone}
                </div>

                <div className="pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => copyToClipboard(displayEmail)}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy email
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader className="bg-gray-50 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-500" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. delivery, refund, vip"
                  className="bg-white"
                />
                <div className="text-xs text-gray-500">
                  Comma-separated. Saves to DB if your `tags` column exists.
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={saveTags} disabled={isClosed}>
                  Save tags
                </Button>
              </CardContent>
            </Card>

            {/* SLA */}
            <Card>
              <CardHeader className="bg-gray-50 pb-3">
                <CardTitle className="text-sm">SLA</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-sm space-y-2">
                {!ticket.sla_due_at ? (
                  <div className="text-gray-500">No SLA configured</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Due</span>
                      <span className="font-medium text-gray-900">
                        {new Date(ticket.sla_due_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">State</span>
                      {slaState === 'breached' ? (
                        <Badge variant="destructive">Breached</Badge>
                      ) : slaState === 'risk' ? (
                        <Badge className="bg-orange-500 text-white">Risk</Badge>
                      ) : (
                        <Badge variant="outline">On track</Badge>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">{slaLabel}</div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Order Context */}
            {relatedOrder && (
              <Card>
                <CardHeader className="bg-gray-50 pb-3">
                  <CardTitle className="text-sm">Order Context</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-sm space-y-3">
                  <div className="flex justify-between">
                    <span>Order #</span>
                    <span className="font-mono">{relatedOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-bold">৳{relatedOrder.total}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span>Status</span>
                    <Badge variant="secondary">{relatedOrder.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Link href={`/invoice/${relatedOrder.id}`} className="block">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        View Order
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => copyToClipboard(String(relatedOrder.id))}
                      title="Copy order id"
                    >
                      Copy ID
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related tickets */}
            {relatedTickets.length > 0 && (
              <Card>
                <CardHeader className="bg-gray-50 pb-3">
                  <CardTitle className="text-sm">Other tickets from customer</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {relatedTickets.map((t) => (
                    <Link
                      key={t.id}
                      href={`/admin/support/${t.id}`}
                      className="block rounded-md border bg-white p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-gray-500 font-mono">#{t.ticket_number || t.id.slice(0, 8)}</div>
                        <div>{statusBadge(t.status)}</div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mt-1 line-clamp-1">{t.subject || '—'}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t.updated_at
                          ? new Date(t.updated_at).toLocaleString()
                          : new Date(t.created_at).toLocaleString()}
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick links */}
            <Card>
              <CardHeader className="bg-gray-50 pb-3">
                <CardTitle className="text-sm">Quick</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => copyToClipboard(String(ticket.ticket_number || ticket.id))}
                >
                  Copy ticket #
                  <Copy className="w-4 h-4" />
                </Button>

                <a
                  className="block"
                  href={`mailto:${encodeURIComponent(displayEmail)}?subject=${encodeURIComponent(
                    `Re: Ticket #${ticket.ticket_number || ''} - ${ticket.subject || ''}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    Open mail client
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
