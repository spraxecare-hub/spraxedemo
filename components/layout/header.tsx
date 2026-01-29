'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SafeImage } from '@/components/ui/safe-image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { useCart } from '@/lib/cart/cart-context';
import { useWishlist } from '@/lib/wishlist/wishlist-context';
import { PhoneAuthDialog } from '@/components/auth/phone-auth-dialog';
import { EmailAuthDialog } from '@/components/auth/email-auth-dialog';
import { CategorySidebar } from '@/components/layout/category-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShoppingCart,
  User,
  Search,
  Loader2,
  LogOut,
  Settings,
  ShoppingBag,
  Package,
  PackageSearch,
  Menu,
  Mail,
  Phone,
  ShieldCheck,
  Heart,
  Store,
  PlusCircle,
  X,
} from 'lucide-react';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState('');
  type SuggestProduct = {
    id: string;
    name: string;
    slug: string;
    price: number | null;
    retail_price: number | null;
    image: string | null;
    stock_quantity: number | null;
    supplier_name: string | null;
  };
  type SuggestCategory = { id: string; name: string; slug: string };

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestProducts, setSuggestProducts] = useState<SuggestProduct[]>([]);
  const [suggestCategories, setSuggestCategories] = useState<SuggestCategory[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimerRef = useRef<number | null>(null);

  const formatBDT = (n?: number | null) => {
    const v = Number(n ?? 0);
    try {
      return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(v);
    } catch {
      return `৳${Math.round(v).toLocaleString()}`;
    }
  };

  const cancelBlurClose = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = null;
  };
  const scheduleBlurClose = () => {
    cancelBlurClose();
    blurTimerRef.current = window.setTimeout(() => setSuggestOpen(false), 160) as any;
  };

  // Fetch suggestions (debounced)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestLoading(false);
      setSuggestProducts([]);
      setSuggestCategories([]);
      return;
    }

    setSuggestLoading(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        setSuggestProducts(Array.isArray(data?.products) ? data.products : []);
        setSuggestCategories(Array.isArray(data?.categories) ? data.categories : []);
      } catch {
        // ignore
      } finally {
        setSuggestLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [searchQuery]);

  const selectProduct = (p: SuggestProduct) => {
    setSuggestOpen(false);
    router.push(`/products/${p.slug}`);
  };
  const selectCategory = (c: SuggestCategory) => {
    setSuggestOpen(false);
    router.push(`/${c.slug}`);
  };

  const renderSuggestions = () => {
    const q = searchQuery.trim();
    if (!suggestOpen || q.length < 2) return null;

    const hasAny = suggestLoading || suggestProducts.length > 0 || suggestCategories.length > 0;

    if (!hasAny) {
      return (
        <div className="absolute z-50 mt-2 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
          <div className="p-3 text-sm text-gray-500">No results</div>
        </div>
      );
    }

    return (
      <div className="absolute z-50 mt-2 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
        {suggestLoading ? (
          <div className="p-3 text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        ) : null}

        {suggestProducts.length ? (
          <div>
            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500">Products</div>
            <div className="max-h-72 overflow-auto">
              {suggestProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectProduct(p)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50"
                >
                  <div className="h-9 w-9 rounded-lg bg-gray-100 overflow-hidden relative flex-shrink-0">
                    {p.image ? <SafeImage src={p.image} alt={p.name} fill sizes="36px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="font-semibold text-blue-900">{formatBDT(p.price)}</span>
                      {p.stock_quantity != null && p.stock_quantity <= 0 ? <span className="text-red-600">Out of stock</span> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {suggestCategories.length ? (
          <div className={suggestProducts.length ? 'border-t' : undefined}>
            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500">Categories</div>
            <div className="max-h-40 overflow-auto">
              {suggestCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCategory(c)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-800"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };
  const [phoneAuthOpen, setPhoneAuthOpen] = useState(false);
  const [emailAuthOpen, setEmailAuthOpen] = useState(false);
  const [categorySidebarOpen, setCategorySidebarOpen] = useState(false);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Close drawer when route changes
  useEffect(() => {
    setCategorySidebarOpen(false);
    setMobileSearchOpen(false);
    setSuggestOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Keep header shadow responsive without animating layout-heavy rows.
  useEffect(() => {
    let ticking = false;
    let lastY = 0;
    let lastScrolled = false;

    const update = () => {
      ticking = false;
      const y = lastY;
      const nextScrolled = y > 8;
      if (nextScrolled !== lastScrolled) {
        lastScrolled = nextScrolled;
        setIsScrolled(nextScrolled);
      }
    };

    const onScroll = () => {
      lastY = window.scrollY || 0;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Focus the mobile search input when opened.
  useEffect(() => {
    if (!mobileSearchOpen) return;
    const t = window.setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [mobileSearchOpen]);

  const adminName = useMemo(() => {
    return profile?.full_name || user?.email?.split('@')[0] || 'Account';
  }, [profile?.full_name, user?.email]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      setSuggestOpen(false);
      router.push(`/products?search=${encodeURIComponent(q)}`);
    }
  };

  return (
    <>
      {/* Mobile-only micro bar */}
      <div className="bg-blue-950 text-white border-b border-white/10 md:hidden">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-1.5 text-center text-xs font-semibold tracking-wide">
          Welcome to Spraxe
        </div>
      </div>

      {/* Top announcement bar (desktop only — mobile already has the micro bar) */}
      <div className="hidden md:block bg-blue-950 text-white border-b border-white/10">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-2 font-semibold tracking-wide">
              <span>SPRAXE</span>
            </span>
            <span className="hidden md:inline text-white/70 truncate">
              Cash on Delivery • Fast delivery • Warranty support
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-white/80">
            <a
              href="tel:+8809638371951"
              className="inline-flex items-center gap-1 hover:text-white transition"
              aria-label="Call Spraxe"
            >
              <Phone className="h-4 w-4" />
              09638371951
            </a>
            <a
              href="mailto:spraxecare@gmail.com"
              className="inline-flex items-center gap-1 hover:text-white transition"
              aria-label="Email Spraxe"
            >
              <Mail className="h-4 w-4" />
              spraxecare@gmail.com
            </a>
            <Link href="/track-order" className="hover:text-white transition">
              Track order
            </Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header
        className={`sticky top-0 z-40 border-b border-gray-200 bg-white md:bg-white/90 md:backdrop-blur md:supports-[backdrop-filter]:bg-white/70 ${isScrolled ? 'shadow-sm' : ''}`}
      >
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 relative">
          {/* Slightly taller header so the brand mark can be clearly visible */}
          <div className="h-20 flex items-center justify-between gap-3">
            {/* Left: menu + brand */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCategorySidebarOpen(true)}
                className="rounded-xl"
                aria-label="Open categories"
              >
                <Menu className="h-6 w-6" />
              </Button>

              <Link href="/" className="flex items-center gap-2" aria-label="Spraxe home">
                <Image
                  src="/header.png"
                  alt="Spraxe"
                  // Bigger logo (transparent background) for better visibility
                  width={420}
                  height={120}
                  className="h-12 sm:h-14 md:h-16 w-auto"
                  priority
                />
              </Link>
            </div>

            {/* Center: search (desktop only) */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search products, brands, categories..."
                  value={searchQuery}
                  onFocus={() => { cancelBlurClose(); setSuggestOpen(true); }}
                  onBlur={scheduleBlurClose}
                  onChange={(e) => { setSearchQuery(e.target.value); setSuggestOpen(true); }}
                  className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                {renderSuggestions()}
              </div>
            </form>

            {/* Right: actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Wishlist */}
              <Link href="/wishlist">
                <Button variant="ghost" size="sm" className="relative gap-2 rounded-xl" aria-label="Wishlist">
                  <Heart className="h-5 w-5" />
                  <span className="hidden sm:inline font-semibold">Wishlist</span>
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1">
                      <Badge className="bg-blue-900 hover:bg-blue-900 text-white px-2 py-0 text-[11px] rounded-full shadow">
                        {wishlistCount}
                      </Badge>
                    </span>
                  )}
                </Button>
              </Link>

              {/* ✅ Mobile search toggle (no navigation) */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-xl"
                onClick={() => setMobileSearchOpen((v) => !v)}
                aria-label={mobileSearchOpen ? 'Close search' : 'Open search'}
              >
                {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </Button>

              {/* Cart */}
              <Link href="/cart">
                <Button variant="ghost" size="sm" className="relative gap-2 rounded-xl">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="hidden sm:inline font-semibold">Cart</span>
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1">
                      <Badge className="bg-red-600 hover:bg-red-600 text-white px-2 py-0 text-[11px] rounded-full shadow">
                        {itemCount}
                      </Badge>
                    </span>
                  )}
                </Button>
              </Link>

              {/* Account */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 rounded-xl">
                    <User className="h-5 w-5" />
                    <span className="hidden sm:inline font-semibold">
                      {user ? adminName : 'Account'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-80 p-2">
                  {user ? (
                    <>
                      <DropdownMenuLabel className="px-2 py-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 font-extrabold">
                            {(adminName || 'A').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-gray-900 truncate">{adminName}</div>
                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                          </div>
                        </div>
                      </DropdownMenuLabel>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => router.push('/dashboard')} className="rounded-lg cursor-pointer">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        My Dashboard
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => router.push('/dashboard')} className="rounded-lg cursor-pointer">
                        <Package className="mr-2 h-4 w-4" />
                        My Orders
                      </DropdownMenuItem>

                      {profile?.role === 'seller' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push('/seller')} className="rounded-lg cursor-pointer">
                            <Store className="mr-2 h-4 w-4" />
                            Seller Dashboard
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push('/seller/inventory')} className="rounded-lg cursor-pointer">
                            <Package className="mr-2 h-4 w-4" />
                            My Inventory
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push('/seller/products/new')} className="rounded-lg cursor-pointer">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Product
                          </DropdownMenuItem>
                        </>
                      )}

                      {profile?.role === 'customer' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push('/sell')} className="rounded-lg cursor-pointer">
                            <Store className="mr-2 h-4 w-4" />
                            Become a Seller
                          </DropdownMenuItem>
                        </>
                      )}

                      {profile?.role === 'admin' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push('/admin')} className="rounded-lg cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />
                            Admin Dashboard
                          </DropdownMenuItem>
                        </>
                      )}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="rounded-lg cursor-pointer text-red-600 focus:text-red-700"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuLabel className="px-2 py-2">
                        <div className="font-extrabold text-gray-900">Sign in</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Login to track orders and checkout faster.
                        </div>
                      </DropdownMenuLabel>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => router.push('/track-order')} className="rounded-lg cursor-pointer">
                        <PackageSearch className="mr-2 h-4 w-4" />
                        Track an order
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <div className="p-2 space-y-2">
                        <Button
                          onClick={() => setPhoneAuthOpen(true)}
                          className="w-full justify-start rounded-xl bg-blue-900 hover:bg-blue-800"
                        >
                          <Phone className="mr-2 h-4 w-4" />
                          Continue with Phone
                        </Button>

                        <Button
                          onClick={() => setEmailAuthOpen(true)}
                          className="w-full justify-start rounded-xl"
                          variant="outline"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Continue with Email
                        </Button>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ✅ Mobile search overlay (no layout expansion on scroll) */}
          <div
            className={`md:hidden absolute left-0 right-0 top-full z-50 px-3 sm:px-4 lg:px-6 pt-2 pb-3 bg-white border-b border-gray-200 shadow-sm transition-[transform,opacity] duration-200 ease-out ${
              mobileSearchOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
            }`}
            style={{ willChange: 'transform,opacity' }}
          >
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={(el) => {
                    mobileSearchInputRef.current = el;
                  }}
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onFocus={() => {
                    cancelBlurClose();
                    setSuggestOpen(true);
                  }}
                  onBlur={scheduleBlurClose}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSuggestOpen(true);
                  }}
                  className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                {renderSuggestions()}
              </div>
            </form>
          </div>
        </div>
      </header>

      <CategorySidebar isOpen={categorySidebarOpen} onClose={() => setCategorySidebarOpen(false)} />
      <PhoneAuthDialog open={phoneAuthOpen} onOpenChange={setPhoneAuthOpen} />
      <EmailAuthDialog open={emailAuthOpen} onOpenChange={setEmailAuthOpen} />
    </>
  );
}
