'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Category } from '@/lib/supabase/types';
import { sanitizeSizeChart, type SizeOption } from '@/lib/utils/size-chart';
import {
  UploadCloud,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Quote,
  List as ListIcon,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Highlighter,
  Table as TableIcon,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';

// TipTap
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

type ImageMode = 'upload' | 'hotlink';

const MAX_IMAGES = 5;
const BUCKET = 'product-images';

const isClothingCategory = (name?: string | null, slug?: string | null) => {
  const hay = `${name || ''} ${slug || ''}`.toLowerCase();
  const isGender = /\b(men|mens|man|mans|women|womens|woman|female|male)\b/i.test(hay);
  const isClothing = /\b(cloth|clothing|apparel|fashion|wear)\b/i.test(hay);
  return isGender && isClothing;
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function safeInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

/* ================= Rich Text Editor ================= */

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'h-9 w-9 rounded-md border flex items-center justify-center',
        'bg-white hover:bg-gray-50',
        active ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write a well-formatted description…',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const lastIncomingRef = useRef<string>(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // ✅ keep only options you need
        heading: { levels: [1, 2, 3] },
        // ✅ DO NOT set codeBlock: true (invalid type)
        // StarterKit already includes CodeBlock by default.
        // If you want config, use: codeBlock: { HTMLAttributes: { class: '...' } }
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
          class: 'text-blue-700 underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[220px] p-4 bg-white',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastIncomingRef.current = html;
      onChange(html);
    },
  });

  // Keep editor synced if parent value changes externally
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== lastIncomingRef.current && incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, false);
      lastIncomingRef.current = incoming;
    }
  }, [value, editor]);

  const can = {
    undo: editor?.can().chain().focus().undo().run() ?? false,
    redo: editor?.can().chain().focus().redo().run() ?? false,
  };

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

  const setTextColor = (hex: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(hex).run();
  };

  const toggleHighlight = () => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight().run();
  };

  if (!editor) {
    return <div className="rounded-xl border bg-white p-4 text-sm text-gray-500">Loading editor…</div>;
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 border-b bg-gray-50 flex flex-wrap gap-2 items-center">
        <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Inline code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
          <Code className="h-4 w-4" />
        </ToolbarButton>

        {/* ✅ Code Block (works because StarterKit includes codeBlock by default) */}
        <ToolbarButton
          title="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
          <ListIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <ToolbarButton title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <ToolbarButton title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}>
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <ToolbarButton title="Link" onClick={setLink} active={editor.isActive('link')}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Highlight" onClick={toggleHighlight} active={editor.isActive('highlight')}>
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <label className="h-9 px-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-600">Text</span>
          <input
            type="color"
            className="h-6 w-8 p-0 border-0 bg-transparent"
            onChange={(e) => setTextColor(e.target.value)}
            title="Text color"
          />
        </label>

        <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-gray-200" />

        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!can.undo}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!can.redo}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <div className="ml-auto text-xs text-gray-500">
          Saves as <b>HTML</b>
        </div>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white text-xs text-gray-500 flex items-center justify-between">
        <span>Tip: Use headings + lists to keep it organized.</span>
        <button
          type="button"
          className="text-blue-700 hover:text-blue-800"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          Clear formatting
        </button>
      </div>
    </div>
  );
}

/* ================= Page ================= */

export default function NewProductPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [imageMode, setImageMode] = useState<ImageMode>('upload');

  // Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{ path: string; url: string }>>([]);

  // Hotlink state
  const [hotlinks, setHotlinks] = useState<string[]>(['', '', '', '', '']);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '', // HTML from TipTap
    sku: '',
    category_id: '',
    price: '',
    retail_price: '',
    stock_quantity: '',
    unit: 'pieces',
    is_featured: false,
  });

  // Manual specs (key/value)
  const [manualSpecs, setManualSpecs] = useState<Array<{ label: string; value: string }>>([
    { label: '', value: '' },
  ]);

  const [sizeChart, setSizeChart] = useState<SizeOption[]>([]);

  // Color variants (create multiple products grouped by color)
  const [enableVariants, setEnableVariants] = useState(false);
  const [variants, setVariants] = useState<Array<{ color_name: string; color_hex: string; stock_quantity: string }>>([
    { color_name: '', color_hex: '', stock_quantity: '' },
  ]);

  useEffect(() => {
    if (user && profile?.role !== 'admin' && profile?.role !== 'seller') {
      router.push('/');
      return;
    }
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
    if (data) setCategories(data as any);
  };

  const mainCategories = useMemo(() => categories.filter((c) => !(c as any).parent_id), [categories]);
  const subCategories = useMemo(
    () => categories.filter((c) => (c as any).parent_id === parentCategoryId),
    [categories, parentCategoryId]
  );
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === formData.category_id) || null,
    [categories, formData.category_id]
  );
  const selectedParent = useMemo(
    () => categories.find((c) => c.id === (selectedCategory as any)?.parent_id) || null,
    [categories, selectedCategory]
  );
  const isFashionCategory = useMemo(() => {
    if (!selectedCategory) return false;
    const name = `${selectedCategory.name} ${selectedParent?.name || ''}`;
    const slug = `${selectedCategory.slug || ''} ${selectedParent?.slug || ''}`;
    return isClothingCategory(name, slug);
  }, [selectedCategory, selectedParent]);

  const handleNameChange = (name: string) => {
    setFormData((p) => ({ ...p, name, slug: slugify(name) }));
  };

  const handleParentCategoryChange = (value: string) => {
    setParentCategoryId(value);
    setFormData((p) => ({ ...p, category_id: '' }));
  };

  const isAdmin = profile?.role === 'admin';
  const remainingUploads = MAX_IMAGES - uploadedImages.length;

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

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
        toast({ title: 'File too large', description: 'Max 5MB per image.', variant: 'destructive' });
        return;
      }
    }

    if (!user) {
      toast({ title: 'Login required', description: 'Please login as admin to upload.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const slug = formData.slug || slugify(formData.name || 'product');
      const prefix = `${user.id}/${slug || 'product'}/${Date.now()}`;

      const uploaded: Array<{ path: string; url: string }> = [];

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

        if (!publicUrl) {
          throw new Error('Could not generate public URL. Make sure the bucket is public or use signed URLs.');
        }

        uploaded.push({ path, url: publicUrl });
      }

      setUploadedImages((prev) => [...prev, ...uploaded]);
      toast({ title: 'Uploaded', description: `${uploaded.length} image(s) uploaded successfully.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload images', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeUploadedImage(idx: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function setHotlinkAt(i: number, v: string) {
    setHotlinks((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  const finalImages = useMemo(() => {
    if (imageMode === 'upload') return uploadedImages.map((x) => x.url).slice(0, MAX_IMAGES);
    return hotlinks.map((x) => x.trim()).filter(Boolean).slice(0, MAX_IMAGES);
  }, [imageMode, uploadedImages, hotlinks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.category_id) {
        toast({ title: 'Validation Error', description: 'Please select a subcategory', variant: 'destructive' });
        return;
      }

      if (!user) {
        toast({ title: 'Login required', description: 'Please login', variant: 'destructive' });
        return;
      }

      if (finalImages.length === 0) {
        toast({
          title: 'Add at least one image',
          description: 'Upload images or add hotlink URLs (max 5).',
          variant: 'destructive',
        });
        return;
      }

      const basePrice = parseFloat(formData.price);
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        toast({ title: 'Invalid price', description: 'Enter a valid price.', variant: 'destructive' });
        return;
      }

      const retailPrice = formData.retail_price ? parseFloat(formData.retail_price) : basePrice;
      const stockQty = safeInt(formData.stock_quantity);

      if (!Number.isFinite(stockQty) || stockQty < 0) {
        toast({ title: 'Invalid stock', description: 'Stock quantity must be 0 or more.', variant: 'destructive' });
        return;
      }

      const cleanedSizeChart = sanitizeSizeChart(sizeChart);
      const sizeChartPayload = isFashionCategory && cleanedSizeChart.length ? cleanedSizeChart : null;

      const payload = {
        name: formData.name,
        slug: formData.slug || slugify(formData.name),
        description: formData.description, // HTML
        sku: formData.sku,
        category_id: formData.category_id,
        base_price: basePrice,
        price: retailPrice,
        retail_price: retailPrice,
        stock_quantity: stockQty,
        unit: formData.unit,
        seller_id: user.id,
        approval_status: isAdmin ? 'approved' : 'pending',
        is_featured: formData.is_featured,
        is_active: true,
        images: finalImages,
        tags: [],
        size_chart: sizeChartPayload,
      };

      // Clean specs
      const cleanedSpecs = manualSpecs
        .map((s) => ({ label: String(s.label || '').trim(), value: String(s.value || '').trim() }))
        .filter((s) => s.label && s.value);

      // Create products (+ optional color variants)
      let createdProductIds: string[] = [];

      if (enableVariants) {
        // We keep one public product page (base product) and store color options as grouped variants
        // under the same color_group_id. Only the base product (color_name = null) is shown in listings.
        const baseSlug = payload.slug;
        const baseSku = String(payload.sku || '').trim() || baseSlug.toUpperCase();

        // 1) Create the base product first (no color_name)
        const { data: baseCreated, error: baseErr } = await supabase
          .from('products')
          .insert({
            ...payload,
            slug: baseSlug,
            sku: baseSku,
            color_group_id: null,
            color_name: null,
            color_hex: null,
          })
          .select('id')
          .single();
        if (baseErr) throw baseErr;

        const baseId = (baseCreated as any)?.id as string;
        if (!baseId) throw new Error('Failed to create base product');

        // 2) Set group id = base product id (so grouping is stable)
        const { error: updErr } = await supabase.from('products').update({ color_group_id: baseId }).eq('id', baseId);
        if (updErr) throw updErr;

        createdProductIds = [baseId];

        // 3) Create additional color variants (each is its own product row for stock management)
        const cleanedVariants = (variants || [])
          .map((v) => ({
            color_name: String((v as any).color_name || '').trim(),
            color_hex: String((v as any).color_hex || '').trim(),
            stock_quantity: String((v as any).stock_quantity || '').trim(),
          }))
          .filter((v) => v.color_name);

        if (cleanedVariants.length) {
          const variantPayloads = cleanedVariants.map((v, idx) => {
            const colorSlug = slugify(v.color_name) || `color-${idx + 1}`;
            const skuSuffix = colorSlug.replace(/[^a-z0-9]+/gi, '').toUpperCase().slice(0, 10) || `C${idx + 1}`;
            const vStock = v.stock_quantity ? safeInt(v.stock_quantity) : stockQty;

            return {
              ...payload,
              slug: `${baseSlug}-${colorSlug}`,
              sku: `${baseSku}-${skuSuffix}`,
              stock_quantity: vStock,
              color_group_id: baseId,
              color_name: v.color_name,
              color_hex: v.color_hex || null,
            };
          });

          const { data: created, error } = await supabase.from('products').insert(variantPayloads).select('id');
          if (error) throw error;
          const ids = (created || []).map((x: any) => x.id).filter(Boolean);
          createdProductIds.push(...ids);
        }
      } else {
        // Single product (no color variants).
        const { data: created, error } = await supabase
          .from('products')
          .insert({ ...payload, color_group_id: null, color_name: null, color_hex: null })
          .select('id')
          .single();
        if (error) throw error;
        createdProductIds = created?.id ? [created.id] : [];
      }

      // Insert specs for all created products
      if (cleanedSpecs.length && createdProductIds.length) {
        const rows = createdProductIds.flatMap((pid) =>
          cleanedSpecs.map((s, idx) => ({ product_id: pid, label: s.label, value: s.value, sort_order: idx }))
        );
        const { error: sErr } = await supabase.from('product_specs').insert(rows);
        if (sErr) throw sErr;
      }

      toast({ title: 'Success', description: 'Product created successfully' });
      router.push(isAdmin ? '/admin' : '/seller');
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: err?.message || 'Failed to create product', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">Add New Product</h1>
              <p className="text-sm text-gray-600 mt-1">Create products with professional metadata and images.</p>
            </div>
            <Badge variant="outline" className="bg-white">
              {isAdmin ? 'Admin' : 'Seller'}
            </Badge>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="border-b bg-white">
              <CardTitle>Product Information</CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basics */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        required
                        className="bg-white"
                        placeholder="e.g. Premium Honey"
                      />
                    </div>

                    <div>
                      <Label htmlFor="slug">Slug *</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                        required
                        className="bg-white"
                        placeholder="premium-honey"
                      />
                      <div className="text-xs text-gray-500 mt-1">Auto-generated from name (editable).</div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <div className="mt-2">
                      <RichTextEditor
                        value={formData.description}
                        onChange={(html) => setFormData((p) => ({ ...p, description: html }))}
                        placeholder="Use headings, bullet points, tables, etc. to organize the product details…"
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      This editor saves HTML into <b>products.description</b>.
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Category + SKU */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Main Category *</Label>
                      <Select value={parentCategoryId} onValueChange={handleParentCategoryChange}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select Main Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {mainCategories.map((cat: any) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Subcategory *</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(value) => setFormData((p) => ({ ...p, category_id: value }))}
                        disabled={!parentCategoryId}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder={!parentCategoryId ? 'Select Main First' : 'Select Subcategory'} />
                        </SelectTrigger>
                        <SelectContent>
                          {subCategories.length > 0 ? (
                            subCategories.map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">No subcategories found</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="sku">SKU *</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                        required
                        className="bg-white"
                        placeholder="SPX-0001"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Pricing + Stock */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">Price (৳) *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                        required
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="retail_price">Retail Price (৳)</Label>
                      <Input
                        id="retail_price"
                        type="number"
                        step="0.01"
                        value={formData.retail_price}
                        onChange={(e) => setFormData((p) => ({ ...p, retail_price: e.target.value }))}
                        className="bg-white"
                        placeholder="Optional (defaults to Price)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                      <Input
                        id="stock_quantity"
                        type="number"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData((p) => ({ ...p, stock_quantity: e.target.value }))}
                        required
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="unit">Unit *</Label>
                      <Input
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                        required
                        className="bg-white"
                        placeholder="pieces / kg / box"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData((p) => ({ ...p, is_featured: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                    />
                    <Label htmlFor="featured" className="cursor-pointer">
                      Feature this product on homepage
                    </Label>
                  </div>
                </div>

                <Separator />

                {/* Color variants */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-gray-900">Color Variants</div>
                      <div className="text-sm text-gray-600">Create multiple products for different colors. Each color can have its own stock.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-700">Enable</Label>
                      <Switch checked={enableVariants} onCheckedChange={setEnableVariants} />
                    </div>
                  </div>

                  {enableVariants ? (
                    <div className="space-y-3">
                      {variants.map((v, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-xl border bg-white p-3">
                          <div className="md:col-span-4">
                            <Label className="text-xs">Color Name</Label>
                            <Input
                              value={v.color_name}
                              onChange={(e) =>
                                setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, color_name: e.target.value } : x)))
                              }
                              placeholder="Black"
                              className="bg-white"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <Label className="text-xs">Color Hex (optional)</Label>
                            <Input
                              value={v.color_hex}
                              onChange={(e) =>
                                setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, color_hex: e.target.value } : x)))
                              }
                              placeholder="#000000"
                              className="bg-white"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <Label className="text-xs">Stock (optional)</Label>
                            <Input
                              type="number"
                              value={v.stock_quantity}
                              onChange={(e) =>
                                setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, stock_quantity: e.target.value } : x)))
                              }
                              placeholder={formData.stock_quantity || '0'}
                              className="bg-white"
                            />
                          </div>
                          <div className="md:col-span-1 flex items-end justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="bg-white"
                              onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                              disabled={variants.length <= 1}
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
                        onClick={() => setVariants((prev) => [...prev, { color_name: '', color_hex: '', stock_quantity: '' }])}
                      >
                        <Plus className="h-4 w-4" /> Add another color
                      </Button>

                      <div className="text-xs text-gray-500">
                        Tip: If you leave stock empty for a color, it will use the main Stock Quantity above.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
                      Turn this on if you want customers to choose a color on the product page.
                    </div>
                  )}
                </div>

                <Separator />

                {/* Size options */}
                <div className="space-y-4">
                  <div>
                    <div className="text-base font-semibold text-gray-900">Size Options & Measurements</div>
                    <div className="text-sm text-gray-600">
                      Configure selectable sizes for mens and womens fashion products, with measurements shown on the product page.
                    </div>
                  </div>

                  {isFashionCategory ? (
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
                                      ? {
                                          ...item,
                                          measurements: [...(item.measurements || []), { label: '', value: '' }],
                                        }
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
                          setSizeChart((prev) => [
                            ...prev,
                            { size: '', measurements: [{ label: '', value: '' }] },
                          ])
                        }
                      >
                        <Plus className="h-4 w-4" /> Add size
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
                      Select a mens or womens fashion category to add size options and measurements.
                    </div>
                  )}
                </div>

                <Separator />

                {/* Manual specs */}
                <div className="space-y-4">
                  <div>
                    <div className="text-base font-semibold text-gray-900">Manual Specifications</div>
                    <div className="text-sm text-gray-600">Add key/value specs shown on the product page “Specs” tab.</div>
                  </div>

                  <div className="space-y-3">
                    {manualSpecs.map((s, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-xl border bg-white p-3">
                        <div className="md:col-span-5">
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={s.label}
                            onChange={(e) =>
                              setManualSpecs((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                            }
                            placeholder="Compatibility"
                            className="bg-white"
                          />
                        </div>
                        <div className="md:col-span-6">
                          <Label className="text-xs">Value</Label>
                          <Input
                            value={s.value}
                            onChange={(e) =>
                              setManualSpecs((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))
                            }
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
                            onClick={() => setManualSpecs((prev) => prev.filter((_, i) => i !== idx))}
                            disabled={manualSpecs.length <= 1}
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
                      onClick={() => setManualSpecs((prev) => [...prev, { label: '', value: '' }])}
                    >
                      <Plus className="h-4 w-4" /> Add spec
                    </Button>
                  </div>
                </div>

                {/* Images */}
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-gray-900">Product Images</div>
                      <div className="text-sm text-gray-600">Choose upload or hotlink (max {MAX_IMAGES}).</div>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      {finalImages.length}/{MAX_IMAGES}
                    </Badge>
                  </div>

                  <Tabs value={imageMode} onValueChange={(v) => setImageMode(v as ImageMode)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload" className="gap-2">
                        <UploadCloud className="h-4 w-4" /> Upload to Supabase
                      </TabsTrigger>
                      <TabsTrigger value="hotlink" className="gap-2">
                        <LinkIcon className="h-4 w-4" /> Hotlink URLs
                      </TabsTrigger>
                    </TabsList>

                    {/* Upload mode */}
                    <TabsContent value="upload" className="mt-4 space-y-4">
                      <Card className="border-dashed">
                        <CardContent className="p-4 md:p-5">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-blue-900" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">Upload images to bucket: {BUCKET}</div>
                                <div className="text-sm text-gray-600">
                                  Recommended: make bucket <b>public</b> for product images (fast CDN).
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Max 5 images, 5MB each.</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => void onPickFiles(e.target.files)}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="bg-white gap-2"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || uploadedImages.length >= MAX_IMAGES}
                              >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                                Upload
                              </Button>
                            </div>
                          </div>

                          {uploadedImages.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                              {uploadedImages.map((img, idx) => (
                                <div key={img.path} className="relative rounded-xl border bg-white overflow-hidden">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <div className="relative h-28 w-full">
                                  <SafeImage src={img.url} alt={`Uploaded ${idx + 1}`} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover" />
                                </div>
                                  <button
                                    type="button"
                                    onClick={() => removeUploadedImage(idx)}
                                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 border flex items-center justify-center hover:bg-white"
                                    aria-label="Remove image"
                                  >
                                    <X className="h-4 w-4 text-gray-700" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Hotlink mode */}
                    <TabsContent value="hotlink" className="mt-4 space-y-4">
                      <Card>
                        <CardContent className="p-4 md:p-5 space-y-3">
                          <div className="text-sm text-gray-600">Paste up to {MAX_IMAGES} image URLs.</div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {hotlinks.slice(0, MAX_IMAGES).map((v, i) => (
                              <div key={i} className="space-y-2">
                                <Label>Image URL {i + 1}</Label>
                                <Input
                                  value={v}
                                  onChange={(e) => setHotlinkAt(i, e.target.value)}
                                  placeholder="https://..."
                                  className="bg-white"
                                />
                              </div>
                            ))}
                          </div>

                          {finalImages.length > 0 && (
                            <div className="pt-2">
                              <div className="text-sm font-semibold text-gray-900 mb-2">Preview</div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {finalImages.map((url, idx) => (
                                  <div key={url + idx} className="rounded-xl border bg-white overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <div className="relative h-28 w-full">
                                    <SafeImage src={url} alt={`Hotlink ${idx + 1}`} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover" />
                                  </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" className="bg-blue-900 hover:bg-blue-800" disabled={loading || uploading}>
                    {loading ? 'Creating...' : 'Create Product'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push(isAdmin ? '/admin' : '/seller')} className="bg-white">
                    Cancel
                  </Button>
                </div>

                {uploading && <div className="text-xs text-gray-500">Uploading images… please keep this page open.</div>}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
