import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroBanner } from '@/components/home/HeroBanner';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { AdSection } from '@/components/home/AdSection';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

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

const Index = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredAds, setFeaturedAds] = useState<Ad[]>([]);
  const [recentAds, setRecentAds] = useState<Ad[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [categoriesRes, featuredRes, recentRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase
          .from('ads')
          .select('*, ad_images(image_url), categories(name, slug)')
          .eq('status', 'approved')
          .eq('is_featured', true)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('ads')
          .select('*, ad_images(image_url), categories(name, slug)')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (featuredRes.data) setFeaturedAds(featuredRes.data as Ad[]);
      if (recentRes.data) setRecentAds(recentRes.data as Ad[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroBanner />
        
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="py-8">
              <Skeleton className="h-8 w-48 mb-6" />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <CategoryGrid categories={categories} />
          )}

          {isLoading ? (
            <div className="py-8">
              <Skeleton className="h-8 w-48 mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <AdSection 
                title="Featured Ads" 
                ads={featuredAds} 
                favorites={favorites}
              />
              <AdSection 
                title="Recent Ads" 
                ads={recentAds} 
                viewAllLink="/search"
                favorites={favorites}
              />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
