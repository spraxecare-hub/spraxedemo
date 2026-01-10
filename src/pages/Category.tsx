import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AdCard } from '@/components/ads/AdCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DIVISIONS, DISTRICTS } from '@/lib/constants';
import { Filter, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

export default function CategoryPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 12;

  // Filters
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [condition, setCondition] = useState(searchParams.get('condition') || '');
  const [division, setDivision] = useState(searchParams.get('division') || '');
  const [district, setDistrict] = useState(searchParams.get('district') || '');
  const [subcategoryId, setSubcategoryId] = useState(searchParams.get('subcategory') || '');

  useEffect(() => {
    fetchCategory();
  }, [slug]);

  useEffect(() => {
    if (category) {
      fetchAds();
    }
  }, [category, page, minPrice, maxPrice, condition, division, district, subcategoryId]);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchCategory = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (data) {
      setCategory(data);
      
      const { data: subs } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', data.id);
      
      setSubcategories(subs || []);
    }
  };

  const fetchAds = async () => {
    if (!category) return;
    
    setIsLoading(true);
    
    let query = supabase
      .from('ads')
      .select('*, ad_images(image_url), categories(name, slug)', { count: 'exact' })
      .eq('status', 'approved')
      .eq('category_id', category.id);

    if (subcategoryId) query = query.eq('subcategory_id', subcategoryId);
    if (condition === 'new' || condition === 'used') query = query.eq('condition', condition);
    if (division) query = query.eq('division', division);
    if (district) query = query.eq('district', district);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));

    query = query
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    const { data, count } = await query;
    
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

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (condition) params.set('condition', condition);
    if (division) params.set('division', division);
    if (district) params.set('district', district);
    if (subcategoryId) params.set('subcategory', subcategoryId);
    setSearchParams(params);
    setPage(1);
  };

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setDivision('');
    setDistrict('');
    setSubcategoryId('');
    setSearchParams({});
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / perPage);

  const FilterPanel = () => (
    <div className="space-y-4">
      {subcategories.length > 0 && (
        <div className="space-y-2">
          <Label>Subcategory</Label>
          <Select value={subcategoryId} onValueChange={setSubcategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="All subcategories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {subcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Condition</Label>
        <Select value={condition || "all"} onValueChange={(v) => setCondition(v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Any condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="used">Used</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Price Range (৳)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Division</Label>
        <Select value={division} onValueChange={(v) => { setDivision(v); setDistrict(''); }}>
          <SelectTrigger>
            <SelectValue placeholder="Any division" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any</SelectItem>
            {DIVISIONS.map((div) => (
              <SelectItem key={div} value={div}>{div}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {division && (
        <div className="space-y-2">
          <Label>District</Label>
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger>
              <SelectValue placeholder="Any district" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any</SelectItem>
              {(DISTRICTS[division] || []).map((dist) => (
                <SelectItem key={dist} value={dist}>{dist}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={applyFilters} className="flex-1">Apply</Button>
        <Button onClick={clearFilters} variant="outline">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{category?.name || 'Category'}</h1>
            <p className="text-muted-foreground">{totalCount} ads found</p>
          </div>
          
          {/* Mobile Filter Button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterPanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Desktop Filters */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 bg-card p-4 rounded-lg border">
              <h3 className="font-semibold mb-4">Filters</h3>
              <FilterPanel />
            </div>
          </aside>

          {/* Ads Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-lg" />
                ))}
              </div>
            ) : ads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No ads found in this category.</p>
                <Button onClick={clearFilters} variant="outline" className="mt-4">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {ads.map((ad) => (
                    <AdCard
                      key={ad.id}
                      ad={ad}
                      isFavorite={favorites.includes(ad.id)}
                    />
                  ))}
                </div>

                {/* Pagination */}
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
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
