import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MapPin, Clock, Star } from 'lucide-react';
import { formatPrice } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';

interface AdCardProps {
  ad: {
    id: string;
    title: string;
    slug: string;
    price: number | null;
    price_type: string;
    condition: string;
    division: string;
    district: string;
    is_featured: boolean;
    created_at: string;
    ad_images: { image_url: string }[];
    categories?: { name: string; slug: string } | null;
  };
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
}

export function AdCard({ ad, isFavorite = false, onFavoriteToggle }: AdCardProps) {
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(isFavorite);
  const [isLoading, setIsLoading] = useState(false);

  const imageUrl = ad.ad_images?.[0]?.image_url || '/placeholder.svg';

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('Please login to save favorites');
      return;
    }

    setIsLoading(true);
    try {
      if (isFav) {
        await supabase.from('favorites').delete().eq('ad_id', ad.id).eq('user_id', user.id);
        setIsFav(false);
        toast.success('Removed from favorites');
      } else {
        await supabase.from('favorites').insert({ ad_id: ad.id, user_id: user.id });
        setIsFav(true);
        toast.success('Added to favorites');
      }
      onFavoriteToggle?.();
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Link to={`/ad/${ad.slug}-${ad.id}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={ad.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {ad.is_featured && (
            <Badge className="absolute top-2 left-2 bg-primary gap-1">
              <Star className="h-3 w-3" />
              Featured
            </Badge>
          )}
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 capitalize"
          >
            {ad.condition}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className={`absolute bottom-2 right-2 bg-card/80 hover:bg-card ${
              isFav ? 'text-destructive' : 'text-muted-foreground'
            }`}
            onClick={handleFavorite}
            disabled={isLoading}
          >
            <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
          </Button>
        </div>
        <CardContent className="p-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {ad.title}
            </h3>
            <p className="text-lg font-bold text-primary">
              {formatPrice(ad.price, ad.price_type)}
            </p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{ad.district}, {ad.division}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(ad.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
