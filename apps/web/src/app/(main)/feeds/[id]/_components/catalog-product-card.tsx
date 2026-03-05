"use client";

import { useState, useCallback, useEffect } from "react";
import { Package, ChevronLeft, ChevronRight, Store } from "lucide-react";
import type { CatalogProduct, CatalogVariant } from "@/hooks/use-feed-catalog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@workspace/ui/components/carousel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
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

interface CatalogProductCardProps {
  product: CatalogProduct;
  onClick?: () => void;
}

export function CatalogProductCard({ product, onClick }: CatalogProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<CatalogVariant | null>(
    product.variants[0] ?? null
  );

  // Carousel state
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const onCarouselSelect = useCallback(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
  }, [carouselApi]);

  // Set up carousel event listener
  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on("select", onCarouselSelect);
    onCarouselSelect();
    return () => {
      carouselApi.off("select", onCarouselSelect);
    };
  }, [carouselApi, onCarouselSelect]);

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
  const hasMultipleVariants = product.variants.length > 1;

  // Skip rendering if no variants
  if (!selectedVariant) {
    return null;
  }

  return (
    <Card
      className={cn(
        "flex flex-col h-full overflow-hidden group p-0",
        onClick && "cursor-pointer hover:shadow-md transition-shadow"
      )}
      onClick={onClick}
    >
      {/* Image Carousel */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {/* Synced Badge */}
        {product.syncStatus?.synced && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 z-10 bg-green-600 text-white hover:bg-green-600 gap-1 text-xs"
          >
            <Store className="h-3 w-3" />
            Synced
          </Badge>
        )}
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
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Navigation arrows - show on hover when multiple images */}
            {hasMultipleImages && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollPrev();
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollNext();
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Dot indicators - show when multiple images */}
            {hasMultipleImages && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {validImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      scrollTo(index);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      currentSlide === index
                        ? "w-4 bg-white"
                        : "w-1.5 bg-white/60 hover:bg-white/80"
                    )}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </Carousel>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
      </div>

      <CardContent className="flex-1 p-4">
        {/* Brand & Type */}
        <div className="flex items-center gap-2 mb-1">
          {product.brand && (
            <span className="text-xs text-muted-foreground">
              {product.brand}
            </span>
          )}
          {product.brand && product.productType && (
            <span className="text-xs text-muted-foreground">•</span>
          )}
          {product.productType && (
            <span className="text-xs text-muted-foreground">
              {product.productType}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-medium line-clamp-2 mb-2">{product.name}</h3>

        {/* SKU */}
        <p className="text-xs text-muted-foreground mb-2">
          SKU: {selectedVariant.sku}
        </p>

        {/* Pricing - show if available, otherwise show "Connect to see pricing" */}
        <div className="mb-3">
          {selectedVariant.price != null ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {selectedVariant.currency || "USD"} {formatNumber(selectedVariant.price)}
                </span>
                {selectedVariant.compareAtPrice != null && selectedVariant.compareAtPrice > selectedVariant.price && (
                  <span className="text-sm text-muted-foreground line-through">
                    {selectedVariant.currency || "USD"} {formatNumber(selectedVariant.compareAtPrice)}
                  </span>
                )}
              </div>
              {selectedVariant.available != null && (
                <p className={`text-xs ${selectedVariant.available > 0 ? "text-green-600" : "text-red-600"}`}>
                  {selectedVariant.available > 0 ? `${formatInteger(selectedVariant.available)} in stock` : "Out of stock"}
                </p>
              )}
            </div>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Connect to see pricing
            </Badge>
          )}
        </div>

        {/* Variant Selector */}
        {hasMultipleVariants && (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={selectedVariant.id}
              onValueChange={(id) => {
                const variant = product.variants.find((v) => v.id === id);
                if (variant) {
                  setSelectedVariant(variant);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {product.variants.map((variant) => (
                  <SelectItem key={variant.id} value={variant.id}>
                    {variant.name || variant.sku}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
