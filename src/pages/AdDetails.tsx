import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Clock, User, Phone, Heart, Flag, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Ad {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number | null;
  price_type: string;
  condition: string;
  division: string;
  district: string;
  area: string | null;
  is_featured: boolean;
  created_at: string;
  user_id: string;
  ad_images: { id: string; image_url: string; sort_order: number }[];
  categories: { name: string; slug: string } | null;
  subcategories: { name: string; slug: string } | null;
}

interface Profile {
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

export default function AdDetails() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [ad, setAd] = useState<Ad | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  // Extract ID from slug (format: title-slug-uuid)
  const adId = slug?.split('-').pop() || '';

  useEffect(() => {
    fetchAd();
  }, [adId]);

  useEffect(() => {
    if (user && ad) {
      checkFavorite();
    }
  }, [user, ad]);

  const fetchAd = async () => {
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*, ad_images(*), categories(name, slug), subcategories(name, slug)')
        .eq('id', adId)
        .single();

      if (error) throw error;
      
      setAd(data as Ad);
      
      // Fetch seller profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number, avatar_url')
        .eq('user_id', data.user_id)
        .single();
      
      setSeller(profile);

      // Increment view count
      await supabase
        .from('ads')
        .update({ views_count: (data.views_count || 0) + 1 })
        .eq('id', adId);
    } catch (error) {
      console.error('Error fetching ad:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkFavorite = async () => {
    if (!user || !ad) return;
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('ad_id', ad.id)
      .maybeSingle();
    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast.error('Please login to save favorites');
      return;
    }
    if (!ad) return;

    if (isFavorite) {
      await supabase.from('favorites').delete().eq('ad_id', ad.id).eq('user_id', user.id);
      setIsFavorite(false);
      toast.success('Removed from favorites');
    } else {
      await supabase.from('favorites').insert({ ad_id: ad.id, user_id: user.id });
      setIsFavorite(true);
      toast.success('Added to favorites');
    }
  };

  const handleReport = async () => {
    if (!user) {
      toast.error('Please login to report an ad');
      return;
    }
    if (!reportReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    if (!ad) return;

    setIsReporting(true);
    try {
      await supabase.from('reports').insert({
        user_id: user.id,
        ad_id: ad.id,
        reason: reportReason,
      });
      toast.success('Report submitted. Thank you for helping keep BazarBD safe.');
      setReportReason('');
    } catch (error) {
      toast.error('Failed to submit report');
    } finally {
      setIsReporting(false);
    }
  };

  const images = ad?.ad_images?.sort((a, b) => a.sort_order - b.sort_order) || [];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Ad not found</h1>
          <p className="text-muted-foreground mt-2">This ad may have been removed or doesn't exist.</p>
          <Link to="/">
            <Button className="mt-4">Go Home</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-4 flex gap-2">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          {ad.categories && (
            <>
              <Link to={`/category/${ad.categories.slug}`} className="hover:text-primary">
                {ad.categories.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="truncate">{ad.title}</span>
        </nav>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Images */}
          <div className="lg:col-span-2 space-y-4">
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImageIndex].image_url}
                    alt={ad.title}
                    className="w-full h-full object-contain"
                  />
                  {images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-card/80"
                        onClick={prevImage}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-card/80"
                        onClick={nextImage}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    </>
                  )}
                  {ad.is_featured && (
                    <Badge className="absolute top-4 left-4 bg-primary gap-1">
                      <Star className="h-3 w-3" />
                      Featured
                    </Badge>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-muted-foreground">No images</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold text-lg mb-4">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {ad.description || 'No description provided.'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold">{ad.title}</h1>
                  <Badge variant="secondary" className="capitalize shrink-0">
                    {ad.condition}
                  </Badge>
                </div>

                <p className="text-3xl font-bold text-primary">
                  {formatPrice(ad.price, ad.price_type)}
                </p>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{ad.area ? `${ad.area}, ` : ''}{ad.district}, {ad.division}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Posted {formatDistanceToNow(new Date(ad.created_at), { addSuffix: true })}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={toggleFavorite}
                  >
                    <Heart className={`h-4 w-4 ${isFavorite ? 'fill-destructive text-destructive' : ''}`} />
                    {isFavorite ? 'Saved' : 'Save'}
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Flag className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Report this ad</DialogTitle>
                        <DialogDescription>
                          Please tell us why you're reporting this ad
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        placeholder="Describe the issue..."
                        rows={4}
                      />
                      <Button onClick={handleReport} disabled={isReporting}>
                        Submit Report
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Seller Info */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Seller Information</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {seller?.avatar_url ? (
                      <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{seller?.full_name || 'Anonymous'}</p>
                    {seller?.phone_number && (
                      <p className="text-sm text-muted-foreground">{seller.phone_number}</p>
                    )}
                  </div>
                </div>
                {seller?.phone_number && (
                  <Button className="w-full gap-2" asChild>
                    <a href={`tel:${seller.phone_number}`}>
                      <Phone className="h-4 w-4" />
                      Call Seller
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Safety Tips */}
            <Card className="bg-primary/5">
              <CardContent className="p-4 text-sm">
                <h4 className="font-semibold mb-2">Safety Tips</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Meet in a public place</li>
                  <li>• Check the item before paying</li>
                  <li>• Don't pay in advance</li>
                  <li>• Beware of unrealistic offers</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
