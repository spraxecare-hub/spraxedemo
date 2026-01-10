import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function HeroBanner() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
          Buy & Sell Anything in <span className="text-primary">Bangladesh</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join millions of Bangladeshis buying and selling on BazarBD. 
          From electronics to property, find everything you need.
        </p>
        
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="What are you looking for?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
          <Button type="submit" size="lg" className="px-8">
            Search
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Popular:</span>
          {['iPhone', 'Car', 'Flat', 'Laptop', 'Bike'].map((term) => (
            <button
              key={term}
              onClick={() => navigate(`/search?q=${term}`)}
              className="px-3 py-1 rounded-full bg-card border border-border hover:border-primary hover:text-primary transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
