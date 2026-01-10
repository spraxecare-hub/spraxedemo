import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Smartphone, Car, Home, Briefcase, Shirt, Wrench, Sofa, GraduationCap,
  LucideIcon
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

interface CategoryGridProps {
  categories: Category[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold mb-6">Browse Categories</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {categories.map((category) => {
          const IconComponent = iconMap[category.icon || 'Smartphone'] || Smartphone;
          return (
            <Link key={category.id} to={`/category/${category.slug}`}>
              <Card className="group hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {category.name}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
