import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Check, X, Eye, Star, MapPin, Calendar } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface Ad {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_type: string;
  condition: string;
  division: string;
  district: string;
  description: string | null;
  status: string;
  is_featured: boolean;
  created_at: string;
  ad_images: { image_url: string }[];
  categories: { name: string } | null;
  profiles: { full_name: string | null; phone_number: string | null } | null;
}

export default function AdModeration() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (isAdmin === false) {
      navigate('/');
      return;
    }
    if (isAdmin) {
      fetchAds();
    }
  }, [user, isAdmin, activeTab]);

  const fetchAds = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('ads')
      .select(`
        *,
        ad_images(image_url),
        categories(name)
      `)
      .eq('status', activeTab as 'pending' | 'approved' | 'rejected' | 'sold')
      .order('created_at', { ascending: false });

    // Fetch profiles separately for each ad
    if (data) {
      const adsWithProfiles = await Promise.all(
        data.map(async (ad) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone_number')
            .eq('user_id', ad.user_id)
            .single();
          return { ...ad, profiles: profile };
        })
      );
      setAds(adsWithProfiles as Ad[]);
    } else {
      setAds([]);
    }
    setIsLoading(false);
  };

  const handleApprove = async (adId: string) => {
    const { error } = await supabase
      .from('ads')
      .update({ status: 'approved' })
      .eq('id', adId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to approve ad', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Ad approved successfully' });
      fetchAds();
      setSelectedAd(null);
    }
  };

  const handleReject = async () => {
    if (!selectedAd || !rejectionMessage.trim()) return;

    const { error } = await supabase
      .from('ads')
      .update({ 
        status: 'rejected',
        rejection_message: rejectionMessage 
      })
      .eq('id', selectedAd.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to reject ad', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Ad rejected with message' });
      setShowRejectDialog(false);
      setRejectionMessage('');
      fetchAds();
      setSelectedAd(null);
    }
  };

  const handleToggleFeatured = async (ad: Ad) => {
    const { error } = await supabase
      .from('ads')
      .update({ is_featured: !ad.is_featured })
      .eq('id', ad.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update featured status', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: ad.is_featured ? 'Removed from featured' : 'Added to featured' });
      fetchAds();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-64 w-64" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Ad Moderation</h1>
        <p className="text-muted-foreground">Review and manage all ads</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="sold">Sold</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : ads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No {activeTab} ads found.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {ads.map((ad) => (
                <Card key={ad.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {ad.ad_images?.[0] && (
                        <img
                          src={ad.ad_images[0].image_url}
                          alt={ad.title}
                          className="w-32 h-24 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{ad.title}</h3>
                            <p className="text-lg font-bold text-primary">
                              {formatPrice(ad.price, ad.price_type)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(ad.status)}>
                              {ad.status}
                            </Badge>
                            {ad.is_featured && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="h-3 w-3" />
                                Featured
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {ad.district}, {ad.division}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(ad.created_at).toLocaleDateString()}
                          </span>
                          <span>{ad.categories?.name}</span>
                        </div>
                        <div className="mt-2 text-sm">
                          Seller: {ad.profiles?.full_name || 'Unknown'} 
                          {ad.profiles?.phone_number && ` • ${ad.profiles.phone_number}`}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAd(ad)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {activeTab === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(ad.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedAd(ad);
                                setShowRejectDialog(true);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {activeTab === 'approved' && (
                          <Button
                            size="sm"
                            variant={ad.is_featured ? "secondary" : "outline"}
                            onClick={() => handleToggleFeatured(ad)}
                          >
                            <Star className={`h-4 w-4 mr-1 ${ad.is_featured ? 'fill-current' : ''}`} />
                            {ad.is_featured ? 'Unfeature' : 'Feature'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Ad Detail Dialog */}
      <Dialog open={!!selectedAd && !showRejectDialog} onOpenChange={() => setSelectedAd(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAd?.title}</DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="space-y-4">
              {selectedAd.ad_images?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedAd.ad_images.map((img, i) => (
                    <img
                      key={i}
                      src={img.image_url}
                      alt={`Image ${i + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Price:</span>
                  <span className="ml-2 font-medium">{formatPrice(selectedAd.price, selectedAd.price_type)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Condition:</span>
                  <span className="ml-2 font-medium capitalize">{selectedAd.condition}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <span className="ml-2 font-medium">{selectedAd.categories?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>
                  <span className="ml-2 font-medium">{selectedAd.district}, {selectedAd.division}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Seller:</span>
                  <span className="ml-2 font-medium">{selectedAd.profiles?.full_name || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="ml-2 font-medium">{selectedAd.profiles?.phone_number || 'N/A'}</span>
                </div>
              </div>
              {selectedAd.description && (
                <div>
                  <span className="text-muted-foreground text-sm">Description:</span>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{selectedAd.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedAd?.status === 'pending' && (
              <>
                <Button onClick={() => handleApprove(selectedAd.id)}>
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Ad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this ad. This message will be sent to the seller.
            </p>
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionMessage}
              onChange={(e) => setRejectionMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectionMessage.trim()}
            >
              Reject Ad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
