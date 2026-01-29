'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SafeImage } from '@/components/ui/safe-image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Phone,
  Clock,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  MessageSquare,
  ChevronRight,
  RefreshCcw,
  Image as ImageIcon,
  X,
  PlusCircle,
} from 'lucide-react';

type TicketType = 'inquiry' | 'complaint' | 'refund' | 'issue';

const SUPPORT_PHONE = '09638-371951';
const SUPPORT_WHATSAPP = '01606087761';
const SUPPORT_MESSENGER = 'https://m.me/spraxe';

const BUCKET = 'support-attachments';

const statusBadge = (s: string) => {
  switch (s) {
    case 'open':
      return <Badge variant="destructive">Open</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-800 border">Processing</Badge>;
    case 'resolved':
      return <Badge className="bg-green-600 text-white">Resolved</Badge>;
    case 'closed':
      return (
        <Badge variant="outline" className="text-gray-500">
          Closed
        </Badge>
      );
    default:
      return <Badge variant="outline">{String(s || '—')}</Badge>;
  }
};

const sanitizeName = (name: string) =>
  name.replace(/[^\w.\-]+/g, '_').slice(0, 80);

export default function SupportPage() {
  const { user, profile } = useAuth() as any;
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const userEmail = useMemo(
    () => profile?.email || user?.email || '',
    [profile?.email, user?.email]
  );

  const [formData, setFormData] = useState({
    type: 'inquiry' as TicketType,
    subject: '',
    message: '',
  });

  // refs for reliable “New Ticket” action
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);

  // Tickets + thread (customer-only)
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const selectedTicket = useMemo(
    () => myTickets.find((t) => t.id === selectedTicketId) || null,
    [myTickets, selectedTicketId]
  );

  const [replies, setReplies] = useState<any[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Attachments
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);

  // Load tickets after login
  useEffect(() => {
    if (!user) {
      setMyTickets([]);
      setSelectedTicketId(null);
      setReplies([]);
      setAttachments([]);
      return;
    }
    fetchMyTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load thread when ticket selected
  useEffect(() => {
    if (!user || !selectedTicketId) {
      setReplies([]);
      setAttachments([]);
      return;
    }
    fetchThread(selectedTicketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId, user?.id]);

  // Realtime updates for selected ticket only
  useEffect(() => {
    if (!user || !selectedTicketId) return;

    const channel = supabase
      .channel(`customer-ticket-${selectedTicketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_replies',
          filter: `ticket_id=eq.${selectedTicketId}`,
        },
        () => fetchThread(selectedTicketId)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_attachments',
          filter: `ticket_id=eq.${selectedTicketId}`,
        },
        () => loadAttachments(selectedTicketId)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `id=eq.${selectedTicketId}`,
        },
        () => fetchMyTickets()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId, user?.id]);

  const scrollToNewTicket = () => {
    setTicketNumber(null);
    setFormData({ type: 'inquiry', subject: '', message: '' });
    setNewTicketFiles([]);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => subjectRef.current?.focus(), 350);
  };

  const fetchMyTickets = async () => {
    if (!user) return;
    setTicketsLoading(true);

    try {
      // ✅ Customer-only filter: user can only see own tickets
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, user_id, ticket_number, subject, message, type, status, priority, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMyTickets(data || []);

      // auto-select newest ticket if none selected
      if ((!selectedTicketId || !(data || []).some((t: any) => t.id === selectedTicketId)) && data && data.length > 0) {
        setSelectedTicketId(data[0].id);
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Could not load tickets',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadAttachments = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const withUrls = await Promise.all(
      (data || []).map(async (a: any) => {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(a.file_path, 60 * 60);
        return { ...a, url: signed?.signedUrl || null };
      })
    );

    setAttachments(withUrls);
  };

  const fetchThread = async (ticketId: string) => {
    if (!user) return;
    setThreadLoading(true);

    try {
      // UI guard: if ticket isn't in myTickets, don't load thread
      const exists = myTickets.some((t) => t.id === ticketId);
      if (!exists) {
        setReplies([]);
        setAttachments([]);
        return;
      }

      const { data, error } = await supabase
        .from('ticket_replies')
        .select('id, ticket_id, user_id, message, created_at, profiles:user_id(full_name, role)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setReplies(data || []);
      await loadAttachments(ticketId);
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Could not load conversation',
        description: e?.message || 'Try again',
        variant: 'destructive',
      });
    } finally {
      setThreadLoading(false);
    }
  };

  const uploadAttachments = async ({
    ticketId,
    replyId,
    files,
  }: {
    ticketId: string;
    replyId?: string | null;
    files: File[];
  }) => {
    if (!user || files.length === 0) return;

    const safeFiles = files.slice(0, 5);

    for (const file of safeFiles) {
      if (!file.type.startsWith('image/')) continue;

      const path = `${user.id}/${ticketId}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;

      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (up.error) throw up.error;

      const ins = await supabase.from('support_attachments').insert({
        ticket_id: ticketId,
        reply_id: replyId || null,
        uploader_id: user.id,
        file_path: path,
        file_name: file.name,
        content_type: file.type,
        size: file.size,
      });

      if (ins.error) throw ins.error;
    }
  };

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
            className="block rounded-xl overflow-hidden border bg-white hover:shadow-sm transition"
            title={a.file_name}
          >
            <div className="relative w-full h-28 bg-gray-100">
              <SafeImage
                src={a.url || ''}
                alt={a.file_name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="p-2 text-[11px] text-slate-600 truncate">{a.file_name}</div>
          </a>
        ))}
      </div>
    );
  };

  const removeFile = (kind: 'new' | 'reply', idx: number) => {
    if (kind === 'new') setNewTicketFiles((prev) => prev.filter((_, i) => i !== idx));
    else setReplyFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please log in to submit a support ticket.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.subject.trim() || !formData.message.trim()) {
      toast({
        title: 'Missing details',
        description: 'Please add a subject and message.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const generatedTicket = `TICKET-${Date.now()}`;

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          ticket_number: generatedTicket,
          email: userEmail,
          type: formData.type,
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          status: 'open',
          priority: 'medium',
        })
        .select('id, ticket_number')
        .single();

      if (error) throw error;

      await uploadAttachments({ ticketId: data.id, files: newTicketFiles });
      setNewTicketFiles([]);

      setTicketNumber(generatedTicket);
      setFormData({ type: 'inquiry', subject: '', message: '' });

      toast({
        title: 'Ticket submitted',
        description: `Ticket number: ${generatedTicket}`,
      });

      await fetchMyTickets();
      setSelectedTicketId(data.id);
      await fetchThread(data.id);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Submission failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!user || !selectedTicket) return;

    const msg = replyMessage.trim();
    if (!msg) return;

    if (selectedTicket.status === 'closed') {
      toast({
        title: 'Ticket closed',
        description: 'You can’t reply to a closed ticket.',
        variant: 'destructive',
      });
      return;
    }

    setSendingReply(true);

    try {
      const { data: rep, error } = await supabase
        .from('ticket_replies')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: msg,
        })
        .select('id')
        .single();

      if (error) throw error;

      await uploadAttachments({
        ticketId: selectedTicket.id,
        replyId: rep.id,
        files: replyFiles,
      });

      setReplyFiles([]);
      setReplyMessage('');

      // customer reply re-opens ticket
      await supabase
        .from('support_tickets')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      await fetchThread(selectedTicket.id);
      await fetchMyTickets();

      toast({ title: 'Sent', description: 'Your reply has been added.' });
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Reply failed',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <Header />

      <main className="flex-1">
        {/* HERO (email removed) */}
        <section className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1 text-xs text-slate-700">
                  <ShieldCheck className="w-4 h-4" />
                  Secure support portal • {user ? 'Signed in' : 'Login required to submit'}
                </div>

                <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                  Support Center
                </h1>
                <p className="mt-3 text-slate-600 leading-relaxed">
                  Create a ticket, upload screenshots, and track replies in one place.
                  For urgent issues, contact us via WhatsApp or Messenger.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm">
                  <InfoPill icon={<Phone className="w-4 h-4" />} title="Phone" value={SUPPORT_PHONE} />
                  <InfoPill icon={<Clock className="w-4 h-4" />} title="Hours" value="8 AM – 11 PM" />
                  <InfoPill icon={<ShieldCheck className="w-4 h-4" />} title="Secure" value="Tickets are private" />
                </div>
              </div>

              <div className="w-full md:w-[360px]">
                <Card className="shadow-sm border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base">Need urgent help?</CardTitle>
                    <CardDescription>Fastest channels for quick assistance</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <a href={SUPPORT_MESSENGER} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full">
                        Open Messenger
                      </Button>
                    </a>
                    <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full bg-blue-900 hover:bg-blue-800">
                        Chat on WhatsApp
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN */}
        <section className="max-w-6xl mx-auto px-4 py-10 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT */}
            <div className="lg:col-span-2 space-y-6">
              {/* FORM */}
              <div ref={formTopRef} />
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Submit a Support Ticket</CardTitle>
                    <CardDescription>
                      Add order info, product name, and screenshots for faster support.
                    </CardDescription>
                  </div>

                  {/* Always visible “New Ticket” */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={scrollToNewTicket}
                    className="sm:w-auto w-full"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    New Ticket
                  </Button>
                </CardHeader>

                <CardContent>
                  {!user ? (
                    <div className="text-center p-8 border rounded-xl bg-slate-50">
                      <LogIn className="w-10 h-10 mx-auto text-blue-900" />
                      <h3 className="mt-3 font-semibold text-slate-900">Login required</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        You must be logged in to submit and track your tickets.
                      </p>
                      <div className="mt-5 flex justify-center gap-3">
                        <Link href="/login">
                          <Button>Login</Button>
                        </Link>
                        <Link href="/register">
                          <Button variant="outline">Create account</Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Request Type</Label>
                          <Select
                            value={formData.type}
                            onValueChange={(v) =>
                              setFormData({ ...formData, type: v as TicketType })
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inquiry">General Inquiry</SelectItem>
                              <SelectItem value="complaint">Complaint</SelectItem>
                              <SelectItem value="refund">Refund Request</SelectItem>
                              <SelectItem value="issue">Technical Issue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Your Account Email</Label>
                          <Input value={userEmail} disabled className="bg-slate-50" />
                        </div>
                      </div>

                      <div>
                        <Label>Subject</Label>
                        <Input
                          ref={subjectRef}
                          required
                          value={formData.subject}
                          onChange={(e) =>
                            setFormData({ ...formData, subject: e.target.value })
                          }
                          placeholder="Example: Order not delivered / App login issue"
                        />
                      </div>

                      <div>
                        <Label>Message</Label>
                        <Textarea
                          rows={7}
                          required
                          value={formData.message}
                          onChange={(e) =>
                            setFormData({ ...formData, message: e.target.value })
                          }
                          placeholder="Explain the problem clearly. Add order number, product name, and any steps you tried."
                        />
                      </div>

                      <div>
                        <Label>Images (optional)</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) =>
                            setNewTicketFiles(Array.from(e.target.files || []))
                          }
                        />
                        <p className="text-xs text-slate-500 mt-1">Up to 5 images.</p>

                        {newTicketFiles.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {newTicketFiles.map((f, idx) => (
                              <div
                                key={`${f.name}-${idx}`}
                                className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2 bg-slate-50"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <ImageIcon className="w-4 h-4 text-slate-500" />
                                  <span className="truncate">{f.name}</span>
                                </div>
                                <button
                                  type="button"
                                  className="text-slate-500 hover:text-red-600"
                                  onClick={() => removeFile('new', idx)}
                                  aria-label="remove file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button className="w-full bg-blue-900 hover:bg-blue-800" disabled={loading}>
                        {loading ? 'Submitting…' : 'Submit Ticket'}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              {/* MY TICKETS */}
              {user && (
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-900" />
                        My Tickets
                        <Badge variant="outline" className="ml-2 text-slate-600">
                          {myTickets.length}
                        </Badge>
                      </CardTitle>
                      <CardDescription>View your tickets and continue the conversation.</CardDescription>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scrollToNewTicket}
                        className="w-full sm:w-auto"
                      >
                        <PlusCircle className="w-4 h-4 mr-2" />
                        New Ticket
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchMyTickets}
                        disabled={ticketsLoading}
                        className="w-full sm:w-auto"
                      >
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        {ticketsLoading ? 'Refreshing…' : 'Refresh'}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {ticketsLoading ? (
                      <div className="p-8 text-center text-slate-500">Loading your tickets…</div>
                    ) : myTickets.length === 0 ? (
                      <div className="p-8 text-center border rounded-xl bg-slate-50">
                        <div className="text-slate-900 font-semibold">No tickets yet</div>
                        <div className="text-sm text-slate-600 mt-1">
                          Submit your first ticket above. Your tickets will appear here.
                        </div>
                        <Button className="mt-4 bg-blue-900 hover:bg-blue-800" onClick={scrollToNewTicket}>
                          Create your first ticket
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Ticket selector */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Select Ticket</Label>
                            <Select
                              value={selectedTicketId || myTickets[0]?.id}
                              onValueChange={(v) => setSelectedTicketId(v)}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {myTickets.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.ticket_number} — {t.subject?.slice(0, 28) || 'No subject'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedTicket && (
                            <div className="flex items-end">
                              <div className="w-full rounded-xl border bg-white p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs text-slate-500">
                                    Status
                                    <div className="mt-1">{statusBadge(selectedTicket.status)}</div>
                                  </div>
                                  <div className="text-xs text-slate-500 text-right">
                                    Updated
                                    <div className="mt-1 text-slate-700">
                                      {selectedTicket.updated_at
                                        ? new Date(selectedTicket.updated_at).toLocaleString()
                                        : new Date(selectedTicket.created_at).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Thread */}
                        {selectedTicket && (
                          <div className="rounded-xl border overflow-hidden bg-white">
                            <div className="p-4 border-b bg-slate-50">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs text-slate-500 font-mono">
                                    {selectedTicket.ticket_number}
                                  </div>
                                  <div className="font-semibold text-slate-900 truncate">
                                    {selectedTicket.subject}
                                  </div>
                                </div>
                                {statusBadge(selectedTicket.status)}
                              </div>
                            </div>

                            <div className="p-4 space-y-3 max-h-[460px] overflow-auto bg-slate-50">
                              {/* Original message */}
                              <div className="rounded-xl border bg-white p-4">
                                <div className="text-xs text-slate-500 mb-2">
                                  You • {new Date(selectedTicket.created_at).toLocaleString()}
                                </div>
                                <div className="text-sm text-slate-800 whitespace-pre-wrap">
                                  {selectedTicket.message}
                                </div>
                                {renderAttachments(attachments.filter((a) => !a.reply_id))}
                              </div>

                              {/* Replies */}
                              {threadLoading ? (
                                <div className="text-center text-slate-500 py-10">Loading conversation…</div>
                              ) : replies.length === 0 ? (
                                <div className="text-center text-slate-500 py-10">
                                  No replies yet. Send a message below.
                                </div>
                              ) : (
                                replies.map((r) => {
                                  const isAgent = r?.profiles?.role === 'admin';
                                  return (
                                    <div
                                      key={r.id}
                                      className={`rounded-xl border p-4 ${
                                        isAgent ? 'bg-blue-50/50 border-blue-100' : 'bg-white'
                                      }`}
                                    >
                                      <div className="text-xs text-slate-500 mb-2 flex items-center justify-between gap-2">
                                        <span className="font-medium">{isAgent ? 'Support Team' : 'You'}</span>
                                        <span>{new Date(r.created_at).toLocaleString()}</span>
                                      </div>
                                      <div className="text-sm text-slate-800 whitespace-pre-wrap">{r.message}</div>
                                      {renderAttachments(attachments.filter((a) => a.reply_id === r.id))}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Reply box */}
                            <div className="p-4 border-t bg-white space-y-3">
                              <Label>Reply</Label>
                              <Textarea
                                rows={4}
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                placeholder={selectedTicket.status === 'closed' ? 'This ticket is closed.' : 'Write your reply…'}
                                disabled={selectedTicket.status === 'closed'}
                              />

                              <div>
                                <Label>Images (optional)</Label>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => setReplyFiles(Array.from(e.target.files || []))}
                                  disabled={selectedTicket.status === 'closed'}
                                />
                                <p className="text-xs text-slate-500 mt-1">Up to 5 images.</p>

                                {replyFiles.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {replyFiles.map((f, idx) => (
                                      <div
                                        key={`${f.name}-${idx}`}
                                        className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2 bg-slate-50"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <ImageIcon className="w-4 h-4 text-slate-500" />
                                          <span className="truncate">{f.name}</span>
                                        </div>
                                        <button
                                          type="button"
                                          className="text-slate-500 hover:text-red-600"
                                          onClick={() => removeFile('reply', idx)}
                                          aria-label="remove file"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <Button
                                className="w-full bg-blue-900 hover:bg-blue-800"
                                onClick={handleSendReply}
                                disabled={sendingReply || selectedTicket.status === 'closed'}
                              >
                                {sendingReply ? 'Sending…' : 'Send Reply'}
                              </Button>

                              <div className="text-xs text-slate-500 flex items-center justify-between">
                                <span>Replies + images appear here.</span>
                                <Link href="/support" className="text-blue-700 hover:underline inline-flex items-center gap-1">
                                  Help <ChevronRight className="w-4 h-4" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* RIGHT */}
            <div className="space-y-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle>Before you submit</CardTitle>
                  <CardDescription>These details help resolve your issue faster.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Bullet>Order number (if applicable)</Bullet>
                  <Bullet>Product name & quantity</Bullet>
                  <Bullet>Clear issue description</Bullet>
                  <Bullet>Screenshots or photos</Bullet>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle>Need urgent help?</CardTitle>
                  <CardDescription>Use WhatsApp or Messenger for quickest response.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <a href={SUPPORT_MESSENGER} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full">
                      Open Messenger
                    </Button>
                  </a>
                  <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full bg-blue-900 hover:bg-blue-800">
                      Chat on WhatsApp
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* SUCCESS MODAL */}
        {ticketNumber && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900">Ticket Received</h2>
              <p className="text-slate-600 mt-2">Your ticket number:</p>
              <p className="font-mono bg-slate-50 p-2 rounded mt-2 border">{ticketNumber}</p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setTicketNumber(null)}>
                  Close
                </Button>
                <Button className="bg-blue-900 hover:bg-blue-800" onClick={scrollToNewTicket}>
                  New Ticket
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ---------- SMALL COMPONENTS ---------- */

function InfoPill({ icon, title, value }: any) {
  return (
    <div className="flex items-center gap-2 border rounded-full px-4 py-2 bg-white shadow-sm">
      {icon}
      <span className="font-medium text-slate-800">{title}:</span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

function Bullet({ children }: any) {
  return (
    <div className="flex gap-2">
      <span className="w-2 h-2 bg-blue-900 rounded-full mt-2" />
      <span className="text-slate-700">{children}</span>
    </div>
  );
}
