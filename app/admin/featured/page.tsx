'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, Trash2, Upload } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const FEATURE_BUCKET = process.env.NEXT_PUBLIC_FEATURE_IMAGE_BUCKET || 'feature-image';

interface FeaturedImage {
  id: number;
  title: string;
  description: string;
  image_url: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  placement?: string | null;
  storage_path?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  mobile_storage_path?: string | null;
  mobile_image_width?: number | null;
  mobile_image_height?: number | null;
  sort_order: number;
  is_active: boolean;
}

type SiteBanner = {
  title?: string;
  image_url?: string;
  mobile_image_url?: string;
  link_url?: string | null;
  is_active?: boolean;
  storage_path?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  mobile_storage_path?: string | null;
  mobile_image_width?: number | null;
  mobile_image_height?: number | null;
};

const SIZE_HINTS: Record<
  'hero' | 'info_carousel' | 'banner',
  { desktop: string; mobile: string; notes?: string }
> = {
  hero: {
    desktop: '1600×600px',
    mobile: '900×500px',
    notes: 'Hero slider (background image).',
  },
  info_carousel: {
    desktop: '800×600px (4:3)',
    mobile: '800×600px (4:3)',
    notes: 'Carousel between paragraph cards.',
  },
  banner: {
    desktop: '1600×320px',
    mobile: '900×450px',
    notes: 'Mid-page banner (home + product page).',
  },
};

async function getImageDimensionsFromFile(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to read image size'));
      img.src = url;
    });
    return dims;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FeaturedImagesManagement() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<FeaturedImage[]>([]);
  const [activeSection, setActiveSection] = useState<'hero' | 'info_carousel'>('hero');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const desktopFileInputRef = useRef<Record<number, HTMLInputElement | null>>({});
  const mobileFileInputRef = useRef<Record<number, HTMLInputElement | null>>({});

  const [banner, setBanner] = useState<SiteBanner>({
    title: 'Banner',
    image_url: '',
    mobile_image_url: '',
    link_url: null,
    is_active: false,
    storage_path: null,
    image_width: null,
    image_height: null,
    mobile_storage_path: null,
    mobile_image_width: null,
    mobile_image_height: null,
  });
  const [bannerUploadingDesktop, setBannerUploadingDesktop] = useState(false);
  const [bannerUploadingMobile, setBannerUploadingMobile] = useState(false);
  const bannerDesktopFileRef = useRef<HTMLInputElement | null>(null);
  const bannerMobileFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    void loadImages();
    void loadBanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const loadBanner = async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key,value')
      .eq('key', 'home_mid_banner')
      .maybeSingle();

    if (error) return;
    const value = (data as any)?.value ?? null;
    if (value && typeof value === 'object') setBanner(value as SiteBanner);
  };

  const loadImages = async () => {
    const { data, error } = await supabase
      .from('featured_images')
      .select('*')
      .order('sort_order');

    if (error) {
      toast({ title: 'Error', description: 'Failed to load featured images', variant: 'destructive' });
      return;
    }

    // Keep strong typing to avoid implicit-any issues during build/typecheck.
    setImages((data || []) as FeaturedImage[]);
  };

  const handleImageChange = (
    id: number,
    field: keyof FeaturedImage,
    value: string | number | boolean | null
  ) => {
    setImages((prev) =>
      prev.map((img: FeaturedImage) => (img.id === id ? { ...img, [field]: value } : img))
    );
  };

  const uploadToStorage = async (file: File) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `featured/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

    const { error } = await supabase.storage
      .from(FEATURE_BUCKET)
      .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type || undefined });

    if (error) throw error;

    const { data } = supabase.storage.from(FEATURE_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  };

  const handlePickFile = (id: number, variant: 'desktop' | 'mobile') => {
    if (variant === 'desktop') desktopFileInputRef.current[id]?.click();
    else mobileFileInputRef.current[id]?.click();
  };

  const handleFileSelected = async (id: number, variant: 'desktop' | 'mobile', file: File | null) => {
    if (!file) return;

    try {
      setUploadingKey(`${id}:${variant}`);
      const dims = await getImageDimensionsFromFile(file);
      const uploaded = await uploadToStorage(file);

      if (variant === 'desktop') {
        handleImageChange(id, 'image_url', uploaded.publicUrl);
        handleImageChange(id, 'storage_path', uploaded.path);
        handleImageChange(id, 'image_width', dims.width);
        handleImageChange(id, 'image_height', dims.height);
      } else {
        handleImageChange(id, 'mobile_image_url', uploaded.publicUrl);
        handleImageChange(id, 'mobile_storage_path', uploaded.path);
        handleImageChange(id, 'mobile_image_width', dims.width);
        handleImageChange(id, 'mobile_image_height', dims.height);
      }

      toast({
        title: 'Uploaded',
        description: `Uploaded ${dims.width}×${dims.height}px to bucket “${FEATURE_BUCKET}”.`,
      });
    } catch (e: any) {
      toast({
        title: 'Upload failed',
        description: e?.message || 'Could not upload image to storage.',
        variant: 'destructive',
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const handlePickBannerFile = (variant: 'desktop' | 'mobile') => {
    if (variant === 'desktop') bannerDesktopFileRef.current?.click();
    else bannerMobileFileRef.current?.click();
  };

  const handleBannerFileSelected = async (variant: 'desktop' | 'mobile', file: File | null) => {
    if (!file) return;
    try {
      if (variant === 'desktop') setBannerUploadingDesktop(true);
      else setBannerUploadingMobile(true);
      const dims = await getImageDimensionsFromFile(file);
      const uploaded = await uploadToStorage(file);
      setBanner((b) =>
        variant === 'desktop'
          ? {
              ...b,
              image_url: uploaded.publicUrl,
              storage_path: uploaded.path,
              image_width: dims.width,
              image_height: dims.height,
            }
          : {
              ...b,
              mobile_image_url: uploaded.publicUrl,
              mobile_storage_path: uploaded.path,
              mobile_image_width: dims.width,
              mobile_image_height: dims.height,
            }
      );
      toast({
        title: 'Uploaded',
        description: `Uploaded ${dims.width}×${dims.height}px to bucket “${FEATURE_BUCKET}”.`,
      });
    } catch (e: any) {
      toast({
        title: 'Upload failed',
        description: e?.message || 'Could not upload image to storage.',
        variant: 'destructive',
      });
    } finally {
      if (variant === 'desktop') setBannerUploadingDesktop(false);
      else setBannerUploadingMobile(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    const updates = images.map((img: FeaturedImage) =>
      supabase
        .from('featured_images')
        .update({
          title: img.title,
          description: img.description,
          image_url: img.image_url,
          mobile_image_url: img.mobile_image_url ?? null,
          link_url: img.link_url ?? null,
          storage_path: img.storage_path ?? null,
          image_width: img.image_width ?? null,
          image_height: img.image_height ?? null,
          mobile_storage_path: img.mobile_storage_path ?? null,
          mobile_image_width: img.mobile_image_width ?? null,
          mobile_image_height: img.mobile_image_height ?? null,
          sort_order: img.sort_order,
          is_active: img.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', img.id)
    );

    const [results, bannerRes] = await Promise.all([
      Promise.all(updates),
      supabase
        .from('site_settings')
        .upsert({ key: 'home_mid_banner', value: banner as any }, { onConflict: 'key' }),
    ]);

    const hasError = results.some((r) => r.error) || !!bannerRes.error;

    if (hasError) {
      toast({ title: 'Error', description: 'Failed to update some settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Updated successfully' });
      await Promise.all([loadImages(), loadBanner()]);
    }

    setSaving(false);
  };


  const handleAddNew = async () => {
    const pool = activeSection === 'hero' ? heroImages : infoCarouselImages;
    const maxOrder = Math.max(
      ...(pool || []).map((img: FeaturedImage) => img.sort_order || 0),
      0
    );

    const isInfo = activeSection === 'info_carousel';

    const payload: any = {
      title: isInfo ? 'New Carousel Image' : 'New Featured Slide',
      description: isInfo ? '' : 'Add description',
      image_url:
        'https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=600',
      mobile_image_url: null,
      sort_order: maxOrder + 1,
      is_active: true,
      link_url: null,
      storage_path: null,
      image_width: null,
      image_height: null,
      mobile_storage_path: null,
      mobile_image_width: null,
      mobile_image_height: null,
      placement: activeSection,
    };

    const { error } = await supabase.from('featured_images').insert(payload);

    if (error) {
      toast({ title: 'Error', description: 'Failed to add new image', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'New featured image added' });
      await loadImages();
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('featured_images').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete image', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Featured image deleted' });
      await loadImages();
    }
  };

  const heroImages = useMemo(
    () =>
      (images || [])
        .filter((img: FeaturedImage) => !img.placement || img.placement === 'hero')
        .sort((a: FeaturedImage, b: FeaturedImage) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [images]
  );

  const infoCarouselImages = useMemo(
    () =>
      (images || [])
        .filter((img: FeaturedImage) => img.placement === 'info_carousel')
        .sort((a: FeaturedImage, b: FeaturedImage) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [images]
  );

  const visibleImages = activeSection === 'hero' ? heroImages : infoCarouselImages;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Manage Featured Images</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddNew} variant="outline" className="bg-white">
              <Plus className="w-4 h-4 mr-2" />
              Add New {activeSection === 'hero' ? 'Slide' : 'Carousel Image'}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-900 hover:bg-blue-800">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Site Banner (Homepage + Product Page)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">Recommended image sizes</div>
                <div className="mt-1">
                  <span className="font-medium">Desktop:</span> {SIZE_HINTS.banner.desktop} &nbsp;•&nbsp;{' '}
                  <span className="font-medium">Mobile:</span> {SIZE_HINTS.banner.mobile}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-gray-900">Enable banner</div>
                  <div className="text-sm text-gray-600">
                    This banner appears after Featured Products on the homepage and before Related Products on the product page.
                  </div>
                </div>
                <Switch checked={!!banner.is_active} onCheckedChange={(v) => setBanner((b) => ({ ...b, is_active: v }))} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Title (optional)</Label>
                  <Input
                    value={banner.title || ''}
                    onChange={(e) => setBanner((b) => ({ ...b, title: e.target.value }))}
                    placeholder="Banner"
                  />
                </div>
                <div>
                  <Label>Click-through Link (optional)</Label>
                  <Input
                    value={banner.link_url || ''}
                    onChange={(e) => setBanner((b) => ({ ...b, link_url: e.target.value }))}
                    placeholder="https://spraxe.com/products/... or /products/..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Desktop banner */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Desktop Image URL (hotlink)</Label>
                    <span className="text-xs text-gray-500">Recommended: {SIZE_HINTS.banner.desktop}</span>
                  </div>
                  <Input
                    value={banner.image_url || ''}
                    onChange={(e) => setBanner((b) => ({ ...b, image_url: e.target.value }))}
                    placeholder="https://..."
                  />

                  <div className="flex items-center gap-2">
                    <input
                      ref={bannerDesktopFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleBannerFileSelected('desktop', e.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white"
                      onClick={() => handlePickBannerFile('desktop')}
                      disabled={bannerUploadingDesktop}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {bannerUploadingDesktop ? 'Uploading...' : 'Upload desktop'}
                    </Button>
                    <div className="text-xs text-gray-600">
                      {banner.image_width && banner.image_height ? (
                        <span>
                          Uploaded: {banner.image_width}×{banner.image_height}px
                        </span>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-gray-50 overflow-hidden">
                    <div className="relative w-full h-[160px]">
                      {banner.image_url ? (
                        <SafeImage src={banner.image_url} alt={banner.title || 'Banner (Desktop)'} fill className="object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">No desktop image</div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Bucket: <span className="font-semibold">{FEATURE_BUCKET}</span>
                  </div>
                </div>

                {/* Mobile banner */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Mobile Image URL (hotlink)</Label>
                    <span className="text-xs text-gray-500">Recommended: {SIZE_HINTS.banner.mobile}</span>
                  </div>
                  <Input
                    value={banner.mobile_image_url || ''}
                    onChange={(e) => setBanner((b) => ({ ...b, mobile_image_url: e.target.value }))}
                    placeholder="https://..."
                  />

                  <div className="flex items-center gap-2">
                    <input
                      ref={bannerMobileFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleBannerFileSelected('mobile', e.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white"
                      onClick={() => handlePickBannerFile('mobile')}
                      disabled={bannerUploadingMobile}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {bannerUploadingMobile ? 'Uploading...' : 'Upload mobile'}
                    </Button>
                    <div className="text-xs text-gray-600">
                      {banner.mobile_image_width && banner.mobile_image_height ? (
                        <span>
                          Uploaded: {banner.mobile_image_width}×{banner.mobile_image_height}px
                        </span>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-gray-50 overflow-hidden">
                    <div className="relative w-full h-[160px]">
                      {banner.mobile_image_url ? (
                        <SafeImage src={banner.mobile_image_url} alt={banner.title || 'Banner (Mobile)'} fill className="object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">No mobile image</div>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Bucket: <span className="font-semibold">{FEATURE_BUCKET}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Homepage Featured Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">Recommended image sizes</div>
                <div className="mt-1">
                  <div>
                    <span className="font-medium">Featured Slider:</span> Desktop {SIZE_HINTS.hero.desktop} • Mobile{' '}
                    {SIZE_HINTS.hero.mobile}
                  </div>
                  <div>
                    <span className="font-medium">Info Carousel:</span> Desktop {SIZE_HINTS.info_carousel.desktop} • Mobile{' '}
                    {SIZE_HINTS.info_carousel.mobile}
                  </div>
                </div>
              </div>
              <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="hero">Featured Slider</TabsTrigger>
                  <TabsTrigger value="info_carousel">Info Carousel</TabsTrigger>
                </TabsList>
                <TabsContent value="hero">
                  <p className="text-sm text-gray-600 mt-2">
                    These images appear in the homepage hero slider.
                  </p>
                </TabsContent>
                <TabsContent value="info_carousel">
                  <p className="text-sm text-gray-600 mt-2">
                    These images appear between the first two homepage paragraphs as a carousel.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {visibleImages.map((image) => (
            <Card key={image.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {activeSection === 'hero' ? 'Hero Slide' : 'Info Carousel Image'} #{image.sort_order}
                </CardTitle>
                {visibleImages.length > 1 ? (
                  <Button variant="outline" size="sm" onClick={() => handleDelete(image.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`title-${image.id}`}>Title</Label>
                    <Input
                      id={`title-${image.id}`}
                      value={image.title}
                      onChange={(e) => handleImageChange(image.id, 'title', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`sort-${image.id}`}>Sort Order</Label>
                    <Input
                      id={`sort-${image.id}`}
                      type="number"
                      value={image.sort_order}
                      onChange={(e) => handleImageChange(image.id, 'sort_order', parseInt(e.target.value || '0', 10))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`description-${image.id}`}>Description</Label>
                  <Input
                    id={`description-${image.id}`}
                    value={image.description}
                    onChange={(e) => handleImageChange(image.id, 'description', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor={`link-${image.id}`}>Click-through Link (optional)</Label>
                  <Input
                    id={`link-${image.id}`}
                    value={image.link_url || ''}
                    onChange={(e) => handleImageChange(image.id, 'link_url', e.target.value)}
                    placeholder="https://spraxe.com/products/... or /products/..."
                  />
                  <p className="text-xs text-gray-500 mt-1">If set, clicking the featured slide/banner will go to this link.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Desktop image */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Desktop Image</Label>
                      <span className="text-xs text-gray-500">
                        Recommended:{' '}
                        {activeSection === 'hero' ? SIZE_HINTS.hero.desktop : SIZE_HINTS.info_carousel.desktop}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white"
                        onClick={() => handlePickFile(image.id, 'desktop')}
                        disabled={uploadingKey === `${image.id}:desktop`}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingKey === `${image.id}:desktop` ? 'Uploading…' : 'Upload desktop'}
                      </Button>
                      <div className="text-xs text-gray-500">
                        Bucket: <span className="font-semibold">{FEATURE_BUCKET}</span>
                        {image.image_width && image.image_height ? (
                          <span className="ml-2">• {image.image_width}×{image.image_height}px</span>
                        ) : null}
                      </div>
                    </div>
                    <input
                      ref={(el) => {
                        desktopFileInputRef.current[image.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelected(image.id, 'desktop', e.target.files?.[0] || null)}
                    />

                    <Label htmlFor={`image-${image.id}`}>Desktop Image URL (hotlink)</Label>
                    <Input
                      id={`image-${image.id}`}
                      value={image.image_url}
                      onChange={(e) => handleImageChange(image.id, 'image_url', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  {/* Mobile image */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Mobile Image</Label>
                      <span className="text-xs text-gray-500">
                        Recommended:{' '}
                        {activeSection === 'hero' ? SIZE_HINTS.hero.mobile : SIZE_HINTS.info_carousel.mobile}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white"
                        onClick={() => handlePickFile(image.id, 'mobile')}
                        disabled={uploadingKey === `${image.id}:mobile`}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingKey === `${image.id}:mobile` ? 'Uploading…' : 'Upload mobile'}
                      </Button>
                      <div className="text-xs text-gray-500">
                        Bucket: <span className="font-semibold">{FEATURE_BUCKET}</span>
                        {image.mobile_image_width && image.mobile_image_height ? (
                          <span className="ml-2">• {image.mobile_image_width}×{image.mobile_image_height}px</span>
                        ) : null}
                      </div>
                    </div>
                    <input
                      ref={(el) => {
                        mobileFileInputRef.current[image.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelected(image.id, 'mobile', e.target.files?.[0] || null)}
                    />

                    <Label htmlFor={`mimage-${image.id}`}>Mobile Image URL (hotlink)</Label>
                    <Input
                      id={`mimage-${image.id}`}
                      value={image.mobile_image_url || ''}
                      onChange={(e) => handleImageChange(image.id, 'mobile_image_url', e.target.value)}
                      placeholder="https://..."
                    />
                    <p className="text-xs text-gray-500">If mobile URL is empty, desktop image will be used on mobile.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id={`active-${image.id}`}
                    checked={image.is_active}
                    onCheckedChange={(checked) => handleImageChange(image.id, 'is_active', checked)}
                  />
                  <Label htmlFor={`active-${image.id}`}>Active</Label>
                </div>

                {(image.image_url || image.mobile_image_url) ? (
                  <div>
                    <Label>Preview (Desktop / Mobile)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <div className="rounded-lg overflow-hidden border bg-gray-50">
                        <div className="px-3 py-2 text-xs font-medium text-gray-700 border-b bg-white">Desktop</div>
                        <div className="relative w-full h-40">
                          {image.image_url ? (
                            <SafeImage
                              src={image.image_url}
                              alt={image.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 50vw"
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">No desktop image</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg overflow-hidden border bg-gray-50">
                        <div className="px-3 py-2 text-xs font-medium text-gray-700 border-b bg-white">Mobile</div>
                        <div className="relative w-full h-40">
                          {image.mobile_image_url ? (
                            <SafeImage
                              src={image.mobile_image_url}
                              alt={image.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 50vw"
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">Uses desktop image</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {image.storage_path ? (
                      <div className="text-xs text-gray-500 mt-2">Desktop storage path: {image.storage_path}</div>
                    ) : null}
                    {image.mobile_storage_path ? (
                      <div className="text-xs text-gray-500">Mobile storage path: {image.mobile_storage_path}</div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
