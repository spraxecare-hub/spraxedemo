import { AdCard } from '@/components/ads/AdCard';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Ad {
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
}

interface AdSectionProps {
  title: string;
  ads: Ad[];
  viewAllLink?: string;
  favorites?: string[];
}

export function AdSection({ title, ads, viewAllLink, favorites = [] }: AdSectionProps) {
  if (ads.length === 0) return null;

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink}>
            <Button variant="ghost" className="gap-1">
              View All
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {ads.map((ad) => (
          <AdCard 
            key={ad.id} 
            ad={ad} 
            isFavorite={favorites.includes(ad.id)}
          />
        ))}
      </div>
    </section>
  );
}
