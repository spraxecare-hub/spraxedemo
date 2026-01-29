'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List as ListIcon,
  ListOrdered,
  Quote,
  Save,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  UploadCloud,
  Plus,
  RotateCcw,
} from 'lucide-react';

// TipTap
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';

// Minimal blog row type
type BlogRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const BLOG_BUCKET = process.env.NEXT_PUBLIC_BLOG_BUCKET || 'blog-images';
const DRAFTS_KEY = 'spraxe_admin_blog_drafts_v1';

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

function safeReadDrafts(): Record<string, Partial<BlogRow>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as any) : {};
  } catch {
    return {};
  }
}

function safeWriteDrafts(drafts: Record<string, Partial<BlogRow>>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // ignore
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export default function AdminBlogsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [blogs, setBlogs] = useState<BlogRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Persist unsaved edits so switching tabs (or an auth refresh) doesn't wipe them.
  const [drafts, setDrafts] = useState<Record<string, Partial<BlogRow>>>(() => safeReadDrafts());
  const draftsSaveTimer = useRef<any>(null);
  const loadedForUserRef = useRef<string | null>(null);

  const coverFileRef = useRef<HTMLInputElement | null>(null);
  const inlineImageRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => blogs.find((b) => b.id === selectedId) || null, [blogs, selectedId]);

  const isDirty = useMemo(() => {
    if (!selectedId) return false;
    return Boolean(drafts[selectedId]);
  }, [drafts, selectedId]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }

    // Prevent reloading the list on incidental auth/profile refreshes.
    if (loadedForUserRef.current === user.id) return;
    loadedForUserRef.current = user.id;

    void loadBlogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role]);

  const loadBlogs = async () => {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: 'Error', description: 'Failed to load blogs', variant: 'destructive' });
      return;
    }

    const rows = (data || []) as any[];
    const mapped = rows.map((r) => ({
      id: String(r.id),
      title: String(r.title || ''),
      slug: String(r.slug || ''),
      excerpt: r.excerpt ?? null,
      content: String(r.content || ''),
      cover_image_url: r.cover_image_url ?? null,
      is_published: Boolean(r.is_published),
      published_at: r.published_at ?? null,
      created_at: String(r.created_at || ''),
      updated_at: String(r.updated_at || ''),
    })) as BlogRow[];

    // Merge any locally saved drafts.
    const merged = mapped.map((b) => (drafts[b.id] ? ({ ...b, ...drafts[b.id] } as BlogRow) : b));
    setBlogs(merged);
    if (!selectedId && mapped.length) setSelectedId(mapped[0].id);
  };

  const updateSelected = (patch: Partial<BlogRow>) => {
    if (!selectedId) return;
    setBlogs((prev) => prev.map((b) => (b.id === selectedId ? { ...b, ...patch } : b)));

    setDrafts((prev) => {
      const next = { ...prev, [selectedId]: { ...(prev[selectedId] || {}), ...patch } };
      // Debounced persist to localStorage
      if (draftsSaveTimer.current) clearTimeout(draftsSaveTimer.current);
      draftsSaveTimer.current = setTimeout(() => safeWriteDrafts(next), 250);
      return next;
    });
  };

  const discardDraft = () => {
    if (!selectedId) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      safeWriteDrafts(next);
      return next;
    });
    void loadBlogs();
    toast({ title: 'Draft discarded', description: 'Reverted to the last saved version from the database.' });
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const title = 'New Blog Post';
      const slug = `post-${Date.now()}`;
      const { data, error } = await supabase
        .from('blogs')
        .insert({
          title,
          slug,
          excerpt: 'Write a short excerpt…',
          content: 'Write your blog content here…',
          cover_image_url: null,
          is_published: false,
          published_at: null,
          updated_at: now,
        })
        .select('*')
        .single();

      if (error) throw error;
      toast({ title: 'Created', description: 'New blog post created.' });
      await loadBlogs();
      if (data?.id) setSelectedId(String(data.id));
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to create blog', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const now = new Date();
      const willPublish = !!selected.is_published;
      const published_at = willPublish ? (selected.published_at || now.toISOString()) : null;

      const { error } = await supabase
        .from('blogs')
        .update({
          title: selected.title,
          slug: selected.slug,
          excerpt: selected.excerpt,
          content: selected.content,
          cover_image_url: selected.cover_image_url,
          is_published: selected.is_published,
          published_at,
          updated_at: now.toISOString(),
        })
        .eq('id', selected.id);

      if (error) throw error;

      toast({ title: 'Saved', description: 'Blog post updated.' });

      // Clear local draft for this post once persisted.
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        safeWriteDrafts(next);
        return next;
      });

      await loadBlogs();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save blog', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = window.confirm('Delete this blog post? This cannot be undone.');
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('blogs').delete().eq('id', selected.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Blog post removed.' });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        safeWriteDrafts(next);
        return next;
      });
      setSelectedId(null);
      await loadBlogs();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to delete blog', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  async function uploadImageToBucket(file: File, prefix: string) {
    if (!user) throw new Error('Login required');
    if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Max 5MB per image.');

    const fileName = sanitizeFileName(file.name) || `image-${Math.random().toString(16).slice(2)}.jpg`;
    const path = `${user.id}/${prefix}/${Date.now()}-${fileName}`;

    const { error: upErr } = await supabase.storage.from(BLOG_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(BLOG_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      throw new Error('Could not generate public URL. Make sure the bucket is public (or use signed URLs).');
    }
    return publicUrl;
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
          class: 'text-blue-700 underline',
        },
      }),
      Placeholder.configure({ placeholder: 'Write your blog content…' }),
    ],
    content: selected?.content || '',
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[360px] p-4 bg-white',
      },
    },
    onUpdate: ({ editor }) => {
      updateSelected({ content: editor.getHTML() });
    },
  });

  // Keep editor in sync when selecting a different post.
  const lastSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editor) return;
    if (!selected) return;
    const html = selected.content || '';
    const changedPost = lastSelectedIdRef.current !== selected.id;
    const editorMismatch = editor.getHTML() !== html;

    if (changedPost || editorMismatch) {
      lastSelectedIdRef.current = selected.id;
      editor.commands.setContent(html, false);
    }
  }, [selected?.id, selected?.content, editor]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link')?.href as string | undefined;
    const url = window.prompt('Enter URL', prev || '');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const handleUploadCover = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!selected) return;
    try {
      setLoading(true);
      const url = await uploadImageToBucket(files[0], `blog/${selected.id}/cover`);
      updateSelected({ cover_image_url: url });
      toast({ title: 'Uploaded', description: 'Cover image uploaded. Click Save to persist.' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload image', variant: 'destructive' });
    } finally {
      setLoading(false);
      if (coverFileRef.current) coverFileRef.current.value = '';
    }
  };

  const handleUploadInline = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!selected) return;
    if (!editor) return;
    try {
      setLoading(true);
      const url = await uploadImageToBucket(files[0], `blog/${selected.id}/inline`);
      editor.chain().focus().setImage({ src: url }).run();
      toast({ title: 'Uploaded', description: 'Image uploaded and inserted into content.' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload image', variant: 'destructive' });
    } finally {
      setLoading(false);
      if (inlineImageRef.current) inlineImageRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="bg-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Blog Posts</h1>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} variant="outline" className="bg-white" disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Button>
            <Button onClick={handleSave} className="bg-blue-900 hover:bg-blue-800" disabled={loading || !selected}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              onClick={discardDraft}
              variant="outline"
              className="bg-white"
              disabled={loading || !selected || !isDirty}
              title={isDirty ? 'Discard local unsaved changes' : 'No local draft to discard'}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Discard Draft
            </Button>
            <Button onClick={handleDelete} variant="outline" className="bg-white" disabled={loading || !selected}>
              <Trash2 className="w-4 h-4 mr-2 text-red-600" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>All Posts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {blogs.length === 0 ? (
                <div className="text-sm text-gray-500">No blog posts yet.</div>
              ) : (
                blogs.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      selectedId === b.id ? 'border-blue-300 bg-blue-50' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900 line-clamp-1">{b.title}</div>
                      <span className={`text-[11px] px-2 py-1 rounded-full border ${b.is_published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600'}`}>
                        {b.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">/{b.slug}</div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle>Edit Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <div className="text-sm text-gray-500">Select a post to edit.</div>
              ) : (
                <>
                  {isDirty ? (
                    <div className="rounded-xl border bg-yellow-50 text-yellow-900 p-3 text-sm">
                      You have unsaved changes for this post stored locally. Click <b>Save</b> to persist to the database, or <b>Discard Draft</b> to revert.
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={selected.title}
                        onChange={(e) => {
                          const nextTitle = e.target.value;
                          updateSelected({ title: nextTitle });
                          // auto-generate slug if slug is empty or looks auto
                          if (!selected.slug || selected.slug.startsWith('post-')) {
                            updateSelected({ slug: slugify(nextTitle) || selected.slug });
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>Slug</Label>
                      <Input
                        value={selected.slug}
                        onChange={(e) => updateSelected({ slug: slugify(e.target.value) })}
                      />
                      <div className="text-xs text-gray-500 mt-1">Public URL: /blog/{selected.slug}</div>
                    </div>
                  </div>

                  <div>
                    <Label>Excerpt</Label>
                    <Input
                      value={selected.excerpt || ''}
                      onChange={(e) => updateSelected({ excerpt: e.target.value })}
                      placeholder="Short summary shown on /blog"
                    />
                  </div>

                  <div>
                    <Label>Cover Image URL (optional)</Label>
                    <Input
                      value={selected.cover_image_url || ''}
                      onChange={(e) => updateSelected({ cover_image_url: e.target.value })}
                      placeholder="https://..."
                    />

                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      <input
                        ref={coverFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleUploadCover(e.target.files)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white"
                        disabled={loading}
                        onClick={() => coverFileRef.current?.click()}
                      >
                        <UploadCloud className="w-4 h-4 mr-2" />
                        Upload Cover to Supabase
                      </Button>
                      <div className="text-xs text-gray-500">
                        Bucket: <span className="font-mono">{BLOG_BUCKET}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Content</Label>
                    <div className="rounded-xl border bg-white overflow-hidden">
                      {/* Toolbar */}
                      <div className="flex flex-wrap gap-2 p-2 border-b bg-gray-50">
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('bold') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleBold().run()}
                          disabled={!editor}
                          title="Bold"
                        >
                          <Bold className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('italic') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleItalic().run()}
                          disabled={!editor}
                          title="Italic"
                        >
                          <Italic className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('underline') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleUnderline().run()}
                          disabled={!editor}
                          title="Underline"
                        >
                          <UnderlineIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('strike') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleStrike().run()}
                          disabled={!editor}
                          title="Strike"
                        >
                          <Strikethrough className="w-4 h-4" />
                        </button>
                        <div className="w-px h-9 bg-gray-200 mx-1" />
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('heading', { level: 1 }) ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                          disabled={!editor}
                          title="Heading 1"
                        >
                          <Heading1 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('heading', { level: 2 }) ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                          disabled={!editor}
                          title="Heading 2"
                        >
                          <Heading2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('heading', { level: 3 }) ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                          disabled={!editor}
                          title="Heading 3"
                        >
                          <Heading3 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-9 bg-gray-200 mx-1" />
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('bulletList') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleBulletList().run()}
                          disabled={!editor}
                          title="Bulleted list"
                        >
                          <ListIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('orderedList') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                          disabled={!editor}
                          title="Numbered list"
                        >
                          <ListOrdered className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('blockquote') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                          disabled={!editor}
                          title="Quote"
                        >
                          <Quote className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 ${editor?.isActive('code') ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                          onClick={() => editor?.chain().focus().toggleCode().run()}
                          disabled={!editor}
                          title="Inline code"
                        >
                          <Code className="w-4 h-4" />
                        </button>
                        <div className="w-px h-9 bg-gray-200 mx-1" />
                        <button
                          type="button"
                          className="h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 border-gray-200"
                          onClick={setLink}
                          disabled={!editor}
                          title="Link"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <input
                          ref={inlineImageRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void handleUploadInline(e.target.files)}
                        />
                        <button
                          type="button"
                          className="h-9 w-9 rounded-md border flex items-center justify-center bg-white hover:bg-gray-50 border-gray-200"
                          onClick={() => inlineImageRef.current?.click()}
                          disabled={!editor || loading}
                          title="Upload & insert image"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      </div>

                      <EditorContent editor={editor} />
                    </div>

                    <div className="text-xs text-gray-500 mt-2">
                      Formatting is supported. Images uploaded here go to Supabase Storage bucket <span className="font-mono">{BLOG_BUCKET}</span>.
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={selected.is_published}
                        onCheckedChange={(checked) => updateSelected({ is_published: checked })}
                      />
                      <div>
                        <div className="text-sm font-semibold">Published</div>
                        <div className="text-xs text-gray-500">
                          {selected.is_published ? 'Visible on /blog' : 'Draft (hidden from public)'}
                        </div>
                      </div>
                    </div>
                    {selected.is_published && selected.published_at ? (
                      <div className="text-xs text-gray-500">Published: {new Date(selected.published_at).toLocaleString()}</div>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
