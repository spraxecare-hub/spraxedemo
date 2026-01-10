import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  Smartphone, Car, Home, Briefcase, Shirt, Wrench, Sofa, GraduationCap,
  LucideIcon, ChevronRight
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Smartphone,
  Car,
  Home,
  Briefcase,
  Shirt,
  Wrench,
  Sofa,
  GraduationCap,
};

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [catRes, subRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('subcategories').select('*'),
    ]);
    
    if (catRes.data) setCategories(catRes.data);
    if (subRes.data) setSubcategories(subRes.data);
    setIsLoading(false);
  };

  const getSubcategories = (categoryId: string) => {
    return subcategories.filter(s => s.category_id === categoryId);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">All Categories</h1>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const IconComponent = iconMap[category.icon || 'Smartphone'] || Smartphone;
              const subs = getSubcategories(category.id);
              
              return (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <Link to={`/category/${category.slug}`} className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <IconComponent className="h-6 w-6 text-primary" />
                      </div>
                      <h2 className="text-xl font-semibold hover:text-primary transition-colors">
                        {category.name}
                      </h2>
                    </Link>
                    
                    {subs.length > 0 && (
                      <div className="space-y-2 pl-15">
                        {subs.slice(0, 4).map((sub) => (
                          <Link
                            key={sub.id}
                            to={`/category/${category.slug}?subcategory=${sub.id}`}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ChevronRight className="h-3 w-3" />
                            {sub.name}
                          </Link>
                        ))}
                        {subs.length > 4 && (
                          <Link
                            to={`/category/${category.slug}`}
                            className="text-sm text-primary hover:underline"
                          >
                            View all {subs.length} subcategories
                          </Link>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
