'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart/cart-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CartItem } from '@/components/cart/cart-item';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

const fmtBDT = (n: number) => `৳${(n || 0).toLocaleString('en-BD')}`;

export function FloatingCartButton() {
  const { items, subtotal } = useCart();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Don't show if cart is empty (Optional - remove if you always want it visible)
  if (items.length === 0) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 rounded-l-lg rounded-r-none shadow-xl bg-blue-900 hover:bg-blue-800 h-14 w-14 flex flex-col gap-0.5 p-0 border-l border-t border-b border-white/20 transition-transform duration-300 hover:-translate-x-1"
          size="icon"
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5 text-white" />
            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-blue-900">
              {items.length}
            </span>
          </div>
          <span className="text-[10px] font-medium text-white/90">Cart</span>
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md flex flex-col pr-0 sm:pr-6">
        <SheetHeader className="px-1">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ShoppingCart className="w-5 h-5" />
            Your Cart ({items.length})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 mt-4">
          <ScrollArea className="flex-1 -mr-4 pr-4">
            {items.length > 0 ? (
              <div className="space-y-4 pb-4">
                {items.map((item) => (
                  <div key={item.id}>
                    <CartItem item={item} />
                    <Separator className="mt-4" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500">
                <ShoppingCart className="w-16 h-16 opacity-20" />
                <p>Your cart is empty.</p>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Continue Shopping
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>

        {items.length > 0 && (
          <div className="pt-4 mt-auto space-y-4 bg-white border-t mr-6">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{fmtBDT(subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{fmtBDT(subtotal)}</span>
              </div>
            </div>

            {/* ✅ FIX: go to /cart */}
            <Link href="/cart" onClick={() => setIsOpen(false)}>
              <Button className="w-full bg-blue-900 hover:bg-blue-800 h-12 text-base font-semibold shadow-md">
                Proceed to Checkout
              </Button>
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
