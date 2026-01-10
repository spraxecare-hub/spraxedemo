import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AdCard } from '@/components/ads/AdCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  categories: { name: string; slug: string } | null;
}

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { user } = useAuth();
  
  const [ads, setAds] = useState<Ad[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 12;

  useEffect(() => {
    fetchAds();
  }, [query, page]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchAds = async () => {
    setIsLoading(true);
    
    let dbQuery = supabase
      .from('ads')
      .select('*, ad_images(image_url), categories(name, slug)', { count: 'exact' })
      .eq('status', 'approved');

    if (query) {
      dbQuery = dbQuery.ilike('title', `%${query}%`);
    }

    dbQuery = dbQuery
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    const { data, count } = await dbQuery;
    
    setAds(data as Ad[] || []);
    setTotalCount(count || 0);
    setIsLoading(false);
  };

  const fetchFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('favorites')
      .select('ad_id')
      .eq('user_id', user.id);
    if (data) {
      setFavorites(data.map(f => f.ad_id));
    }
  };

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {query ? `Search results for "${query}"` : 'All Ads'}
          </h1>
          <p className="text-muted-foreground">{totalCount} ads found</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No ads found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ads.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  isFavorite={favorites.includes(ad.id)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
