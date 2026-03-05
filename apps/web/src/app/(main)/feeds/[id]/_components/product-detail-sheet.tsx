"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Package,
  ChevronLeft,
  ChevronRight,
  Tag,
  Layers,
  Box,
  Hash,
  DollarSign,
  BarChart3,
  Store,
  ExternalLink,
} from "lucide-react";
import type { CatalogProduct, CatalogVariant } from "@/hooks/use-feed-catalog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@workspace/ui/components/carousel";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/utils";

// Format number with thousand separators and 2 decimal places
function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Format integer with thousand separators
function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

interface ProductDetailSheetProps {
  product: CatalogProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
}: ProductDetailSheetProps) {
  // Carousel state
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const onCarouselSelect = useCallback(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on("select", onCarouselSelect);
    onCarouselSelect();
    return () => {
      carouselApi.off("select", onCarouselSelect);
    };
  }, [carouselApi, onCarouselSelect]);

  // Reset carousel when product changes
  useEffect(() => {
    if (carouselApi && product) {
      carouselApi.scrollTo(0);
      setCurrentSlide(0);
    }
  }, [carouselApi, product?.id]);

  const scrollPrev = useCallback(() => {
    carouselApi?.scrollPrev();
  }, [carouselApi]);

  const scrollNext = useCallback(() => {
    carouselApi?.scrollNext();
  }, [carouselApi]);

  const scrollTo = useCallback(
    (index: number) => {
      carouselApi?.scrollTo(index);
    },
    [carouselApi]
  );

  if (!product) return null;

  // Filter out empty or invalid image URLs
  const validImages = (product.images || []).filter((url) => {
    if (!url || typeof url !== "string") return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });

  const hasMultipleImages = validImages.length > 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-0 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg line-clamp-2">{product.name}</SheetTitle>
              {(product.brand || product.productType) && (
                <SheetDescription className="flex items-center gap-2">
                  {product.brand && <span>{product.brand}</span>}
                  {product.brand && product.productType && <span>•</span>}
                  {product.productType && <span>{product.productType}</span>}
                </SheetDescription>
              )}
            </div>
            {product.syncStatus?.synced && product.syncStatus.shopifyAdminUrl && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                asChild
              >
                <a
                  href={product.syncStatus.shopifyAdminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Store className="h-4 w-4" />
                  View in Shopify
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pb-6 space-y-6">
            {/* Sync Status Badge */}
            {product.syncStatus?.synced && (
              <div className="mt-4">
                <Badge
                  variant="secondary"
                  className="bg-green-600 text-white hover:bg-green-600 gap-1.5"
                >
                  <Store className="h-3.5 w-3.5" />
                  Synced to your Shopify store
                </Badge>
              </div>
            )}

            {/* Image Gallery */}
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {validImages.length > 0 ? (
                <Carousel
                  setApi={setCarouselApi}
                  opts={{ loop: true }}
                  className="w-full h-full"
                >
                  <CarouselContent className="-ml-0 h-full">
                    {validImages.map((image, index) => (
                      <CarouselItem key={index} className="pl-0 h-full">
                        <div className="relative w-full h-full aspect-square">
                          <img
                            src={image}
                            alt={`${product.name} - Image ${index + 1}`}
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>

                  {/* Navigation arrows */}
                  {hasMultipleImages && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md"
                        onClick={scrollPrev}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full shadow-md"
                        onClick={scrollNext}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {/* Dot indicators */}
                  {hasMultipleImages && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 px-2 py-1 rounded-full">
                      {validImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => scrollTo(index)}
                          className={cn(
                            "h-2 rounded-full transition-all",
                            currentSlide === index
                              ? "w-4 bg-white"
                              : "w-2 bg-white/60 hover:bg-white/80"
                          )}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </Carousel>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-16 w-16 text-muted-foreground/50" />
                </div>
              )}
            </div>

            {/* Image count */}
            {validImages.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {currentSlide + 1} of {validImages.length} images
              </p>
            )}

            {/* Description */}
            {product.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Description
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Variants */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Box className="h-4 w-4 text-muted-foreground" />
                Variants ({product.variants.length})
              </h4>

              <div className="space-y-3">
                {product.variants.map((variant) => (
                  <VariantCard key={variant.id} variant={variant} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function VariantCard({ variant }: { variant: CatalogVariant }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Variant name and SKU */}
      <div className="space-y-1">
        {variant.name && (
          <p className="font-medium text-sm">{variant.name}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Hash className="h-3 w-3" />
          SKU: {variant.sku}
        </p>
      </div>

      {/* Attributes */}
      {variant.attributes && Object.keys(variant.attributes).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(variant.attributes).map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-xs">
              {key}: {value}
            </Badge>
          ))}
        </div>
      )}

      {/* Pricing and Inventory */}
      <div className="flex items-center justify-between pt-2 border-t">
        {/* Pricing */}
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          {variant.price != null ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {variant.currency || "USD"} {formatNumber(variant.price)}
              </span>
              {variant.compareAtPrice != null &&
                variant.compareAtPrice > variant.price && (
                  <span className="text-sm text-muted-foreground line-through">
                    {variant.currency || "USD"} {formatNumber(variant.compareAtPrice)}
                  </span>
                )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No pricing</span>
          )}
        </div>

        {/* Inventory */}
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          {variant.available != null ? (
            <span
              className={cn(
                "text-sm font-medium",
                variant.available > 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {variant.available > 0
                ? `${formatInteger(variant.available)} in stock`
                : "Out of stock"}
            </span>
          ) : variant.quantity != null ? (
            <span className="text-sm text-muted-foreground">
              Qty: {formatInteger(variant.quantity)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No inventory</span>
          )}
        </div>
      </div>
    </div>
  );
}
