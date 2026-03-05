"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@workspace/ui/components/button";

export function CartButton() {
  const { itemCount, toggleCart } = useCart();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={toggleCart}
      aria-label={`Shopping cart with ${itemCount} items`}
    >
      <ShoppingCart className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Button>
  );
}
