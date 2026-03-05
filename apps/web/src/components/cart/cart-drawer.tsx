"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Package,
  Store,
} from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";

function formatPrice(amount: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    itemCount,
    subtotal,
    supplierGroups,
    updateQuantity,
    removeItem,
    clearSupplier,
  } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart
            {itemCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            Review your items before checkout
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-1">Your cart is empty</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start adding products from your connected suppliers
            </p>
            <Button asChild onClick={closeCart}>
              <Link href="/shop">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4 px-2">
                {Array.from(supplierGroups.entries()).map(
                  ([supplierId, group]) => (
                    <div key={supplierId} className="space-y-3">
                      {/* Supplier header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {group.supplierName}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => clearSupplier(supplierId)}
                        >
                          Clear
                        </Button>
                      </div>

                      {/* Items from this supplier */}
                      <div className="space-y-3">
                        {group.items.map((item) => (
                          <div
                            key={item.variantId}
                            className="flex gap-3 bg-muted/50 rounded-lg p-3"
                          >
                            {/* Image */}
                            <div className="relative h-16 w-16 rounded-md bg-muted overflow-hidden flex-shrink-0">
                              {(() => {
                                // Handle both string URLs and legacy object format
                                const imgUrl = typeof item.imageUrl === 'string'
                                  ? item.imageUrl
                                  : (item.imageUrl as { url?: string } | null)?.url;
                                return imgUrl && imgUrl.length > 0 ? (
                                  <Image
                                    src={imgUrl}
                                    alt={item.productName}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <Package className="h-6 w-6 text-muted-foreground/50" />
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {item.productName}
                              </p>
                              {item.variantName && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.variantName}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.sku}
                              </p>
                              <p className="text-sm font-medium mt-1">
                                {formatPrice(item.price, item.currency)} each
                              </p>
                            </div>

                            {/* Quantity controls */}
                            <div className="flex flex-col items-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItem(item.variantId)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              <div className="flex items-center gap-1 border rounded-md">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    updateQuantity(
                                      item.variantId,
                                      item.quantity - 1
                                    )
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    updateQuantity(
                                      item.variantId,
                                      item.quantity + 1
                                    )
                                  }
                                  disabled={
                                    item.maxQuantity !== undefined &&
                                    item.quantity >= item.maxQuantity
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm font-medium">
                                {formatPrice(item.price * item.quantity, item.currency)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Supplier subtotal */}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">
                          {formatPrice(
                            group.items.reduce(
                              (sum, item) => sum + item.price * item.quantity,
                              0
                            ),
                            group.items[0]?.currency
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </ScrollArea>

            <SheetFooter className="flex-col gap-4 border-t pt-4 mt-auto px-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total</span>
                <span className="text-lg font-bold">
                  {formatPrice(subtotal, items[0]?.currency)}
                </span>
              </div>
              {supplierGroups.size > 1 && (
                <p className="text-xs text-muted-foreground text-center">
                  Your order will be split into {supplierGroups.size} separate
                  orders (one per supplier)
                </p>
              )}
              <Button asChild className="w-full" size="lg" onClick={closeCart}>
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
