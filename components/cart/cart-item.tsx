'use client';

import { Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/ui/safe-image';
import { useCart } from '@/lib/cart/cart-context';

interface CartItemProps {
  item: {
    id: string;
    quantity: number;
    product_id: string;
    // The details are inside the 'product' object
    product?: {
      name: string;
      price: number;
      images?: string[];
      slug?: string;
    };
  };
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();

  // Safely access product details
  const product = item.product;
  if (!product) return null; // Don't render if product data is missing

  const imageUrl = product.images?.[0] || null;
  const totalPrice = (product.price || 0) * item.quantity;

  return (
    <div className="flex gap-4">
      {/* Image */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {imageUrl ? (
          <SafeImage
            src={imageUrl}
            alt={product.name}
            fill
            sizes="64px"
            className="object-cover object-center"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
            No Img
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col">
        <div>
          <div className="flex justify-between text-base font-medium text-gray-900">
            <h3 className="line-clamp-2 text-sm leading-tight pr-4">
              {/* Link to product page using slug or ID */}
              <a href={`/products/${product.slug || item.product_id}`} className="hover:underline">
                {product.name}
              </a>
            </h3>
            <p className="ml-4 flex-shrink-0">৳{totalPrice}</p>
          </div>
          <p className="mt-1 text-sm text-gray-500">Unit: ৳{product.price}</p>
        </div>
        
        <div className="flex flex-1 items-end justify-between text-sm mt-2">
          {/* Quantity Controls */}
          <div className="flex items-center border rounded-md h-7">
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-7 rounded-none rounded-l-md px-0"
              onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
              disabled={item.quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            <div className="h-full w-8 flex items-center justify-center border-x text-xs font-medium">
              {item.quantity}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-full w-7 rounded-none rounded-r-md px-0"
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Remove Button */}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2"
            onClick={() => removeItem(item.id)}
          >
            <span className="sr-only">Remove</span>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
