import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Clock, Plus, Edit, Trash2, Eye, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Ad {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_type: string;
  status: string;
  rejection_message: string | null;
  division: string;
  district: string;
  created_at: string;
  ad_images: { image_url: string }[];
}

export default function MyAds() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchAds();
    }
  }, [user]);

  const fetchAds = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('ads')
      .select('*, ad_images(image_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    setAds(data as Ad[] || []);
    setIsLoading(false);
  };

  const deleteAd = async (adId: string) => {
    const { error } = await supabase.from('ads').delete().eq('id', adId);
    
    if (error) {
      toast.error('Failed to delete ad');
    } else {
      toast.success('Ad deleted successfully');
      fetchAds();
    }
  };

  const markAsSold = async (adId: string) => {
    const { error } = await supabase
      .from('ads')
      .update({ status: 'sold' })
      .eq('id', adId);
    
    if (error) {
      toast.error('Failed to update ad');
    } else {
      toast.success('Ad marked as sold');
      fetchAds();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      sold: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'} className="capitalize">{status}</Badge>;
  };

  const filterAdsByStatus = (status: string | null) => {
    if (!status) return ads;
    return ads.filter(ad => ad.status === status);
  };

  const AdList = ({ status }: { status: string | null }) => {
    const filteredAds = filterAdsByStatus(status);
    
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      );
    }

    if (filteredAds.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No ads found.</p>
          <Link to="/post-ad">
            <Button className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Post an Ad
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredAds.map((ad) => (
          <Card key={ad.id}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={ad.ad_images?.[0]?.image_url || '/placeholder.svg'}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{ad.title}</h3>
                    {getStatusBadge(ad.status)}
                  </div>
                  <p className="text-lg font-bold text-primary mt-1">
                    {formatPrice(ad.price, ad.price_type)}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ad.district}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(ad.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {ad.status === 'rejected' && ad.rejection_message && (
                    <div className="mt-2 flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{ad.rejection_message}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Link to={`/ad/${ad.slug}-${ad.id}`}>
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </Link>
                  {ad.status === 'approved' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsSold(ad.id)}
                    >
                      Mark Sold
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-1">
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this ad?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your ad.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAd(ad.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Ads</h1>
          <Link to="/post-ad">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Post New Ad
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({ads.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({filterAdsByStatus('pending').length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({filterAdsByStatus('approved').length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({filterAdsByStatus('rejected').length})</TabsTrigger>
            <TabsTrigger value="sold">Sold ({filterAdsByStatus('sold').length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            <AdList status={null} />
          </TabsContent>
          <TabsContent value="pending" className="mt-6">
            <AdList status="pending" />
          </TabsContent>
          <TabsContent value="approved" className="mt-6">
            <AdList status="approved" />
          </TabsContent>
          <TabsContent value="rejected" className="mt-6">
            <AdList status="rejected" />
          </TabsContent>
          <TabsContent value="sold" className="mt-6">
            <AdList status="sold" />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
