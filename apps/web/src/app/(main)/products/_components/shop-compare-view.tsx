"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";






import {
  Check,
  X,
  AlertTriangle,
  Clock,
  MinusCircle,
  ChevronDown,
  ExternalLink,
  Package,
  ArrowRight,
  Layers,
  Database,
  Store,
  RefreshCw,
  Eye,
} from "lucide-react";
import type { CompareProduct, CompareSummary } from "@/hooks/use-shop-catalog";
import { apiClient } from "@/lib/api";
import { CompareDetailSheet } from "./compare-detail-sheet";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
// Styles for the compare view
const styles = `
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  @keyframes scan-line {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }

  .compare-card {
    position: relative;
    overflow: hidden;
  }

  .compare-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      transparent 0%,
      rgba(217, 119, 6, 0.02) 50%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  .compare-card.has-diff::before {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.04) 0%,
      rgba(217, 119, 6, 0.08) 50%,
      rgba(245, 158, 11, 0.04) 100%
    );
  }

  .compare-card.has-error::before {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.04) 0%,
      rgba(220, 38, 38, 0.08) 50%,
      rgba(239, 68, 68, 0.04) 100%
    );
  }

  .data-cell {
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: 0.8125rem;
    letter-spacing: -0.01em;
  }

  .diff-highlight {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .diff-highlight::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #f59e0b, #d97706);
    border-radius: 1px;
  }

  .stat-card {
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-1px);
  }

  .stat-card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 4px 4px 0 0;
  }

  .stat-card.stat-synced::after { background: linear-gradient(90deg, #10b981, #059669); }
  .stat-card.stat-diff::after { background: linear-gradient(90deg, #f59e0b, #d97706); }
  .stat-card.stat-error::after { background: linear-gradient(90deg, #ef4444, #dc2626); }
  .stat-card.stat-pending::after { background: linear-gradient(90deg, #6b7280, #4b5563); }

  .variant-row {
    transition: background-color 0.15s ease;
  }

  .variant-row:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  @media (prefers-color-scheme: dark) {
    .variant-row:hover {
      background-color: rgba(255, 255, 255, 0.02);
    }
  }
`;

interface ShopCompareViewProps {
  products: CompareProduct[];
  summary: CompareSummary;
  isLoading: boolean;
  onRefresh?: () => void;
}

function StatusIndicator({ status, hasShopifyData }: { status: CompareProduct["sync"]["status"]; hasShopifyData: boolean }) {
  // If sync failed but product exists in Shopify, show sync error
  if (hasShopifyData && status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
          Sync Error
        </span>
      </div>
    );
  }

  // If no Shopify data and status is never or not set, show "Not Synced"
  if (!hasShopifyData && (status === "never" || !status)) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Not Synced
        </span>
      </div>
    );
  }

  // If product exists in Shopify and status is success/synced or not explicitly set, show "Synced"
  if (hasShopifyData && (status === "success" || status === "synced" || status === "never" || !status)) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
          Synced
        </span>
      </div>
    );
  }

  const config = {
    success: { color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Synced" },
    synced: { color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Synced" },
    failed: { color: "bg-red-500", text: "text-red-600 dark:text-red-400", label: "Failed" },
    partial: { color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Partial" },
    pending: { color: "bg-slate-400", text: "text-slate-600 dark:text-slate-400", label: "Pending" },
    never: { color: "bg-slate-300 dark:bg-slate-600", text: "text-slate-500 dark:text-slate-400", label: "Not Synced" },
  }[status] || { color: "bg-slate-300 dark:bg-slate-600", text: "text-slate-500 dark:text-slate-400", label: "Not Synced" };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color} ${status === "pending" ? "animate-pulse" : ""}`} />
      <span className={`text-xs font-medium uppercase tracking-wide ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}

function DataValue({
  value,
  hasDiff = false,
  isEmpty = false,
  variant = "default"
}: {
  value: string | number | null;
  hasDiff?: boolean;
  isEmpty?: boolean;
  variant?: "default" | "price" | "stock";
}) {
  if (isEmpty || value === null || value === undefined) {
    return <span className="text-slate-400 dark:text-slate-500 data-cell">—</span>;
  }

  const baseClass = "data-cell";
  const diffClass = hasDiff ? "diff-highlight text-amber-700 dark:text-amber-300 font-medium" : "";

  return (
    <span className={`${baseClass} ${diffClass}`}>
      {value}
    </span>
  );
}

function CompareField({
  label,
  feedValue,
  shopifyValue,
  hasDiff,
}: {
  label: string;
  feedValue: string | null;
  shopifyValue: string | null;
  hasDiff: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20 flex-shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-1 min-w-0 truncate">
          <DataValue value={feedValue} hasDiff={hasDiff} />
        </div>
        {shopifyValue !== null && shopifyValue !== feedValue && (
          <>
            <ArrowRight className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0 truncate text-right">
              <span className="data-cell text-amber-600 dark:text-amber-400">
                {shopifyValue || "—"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PriceCompare({
  feedPrice,
  shopifyPrice,
  feedCurrency = "USD",
  storeCurrency = "USD",
}: {
  feedPrice: number | null;
  shopifyPrice: number | null;
  feedCurrency?: string;
  storeCurrency?: string;
}) {
  const formatFeedPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: feedCurrency,
    }).format(price);
  };

  const formatShopPrice = (price: number | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: storeCurrency,
    }).format(price);
  };

  // Flag as issue if:
  // 1. Prices are the same (margin not applied)
  // 2. Store price < feed price (margin applied incorrectly)
  const hasMarginIssue = feedPrice !== null && shopifyPrice !== null &&
    (Math.abs(feedPrice - shopifyPrice) < 0.01 || shopifyPrice < feedPrice);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Feed</span>
        <DataValue
          value={formatFeedPrice(feedPrice)}
          hasDiff={hasMarginIssue}
          isEmpty={feedPrice === null}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Shop</span>
        <span className={`data-cell ${hasMarginIssue ? "text-amber-700 dark:text-amber-300 font-medium" : ""}`}>
          {formatShopPrice(shopifyPrice) || <span className="text-slate-400">—</span>}
        </span>
      </div>
    </div>
  );
}

function StockCompare({
  feedStock,
  shopifyStock,
  hasDiff
}: {
  feedStock: number;
  shopifyStock: number | null;
  hasDiff: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Feed</span>
        <DataValue value={feedStock} hasDiff={hasDiff} />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Shop</span>
        <span className={`data-cell ${hasDiff ? "text-amber-700 dark:text-amber-300 font-medium" : ""}`}>
          {shopifyStock !== null ? shopifyStock : <span className="text-slate-400">—</span>}
        </span>
      </div>
    </div>
  );
}

function CompareCard({ product, onRefresh }: { product: CompareProduct; onRefresh?: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { getToken } = useAuth();

  const hasDifferences = product.differences.totalDiffCount > 0;
  const hasError = product.sync.status === "failed";
  const feedImage = product.feed.images?.[0];

  const handleRetrySync = async () => {
    try {
      setIsRetrying(true);
      const token = await getToken();
      await apiClient(`/internal/shop/products/${product.id}/retry-sync`, {
        method: "POST",
        token: token ?? undefined,
      });
      // Refresh the list after a short delay to allow sync to start
      setTimeout(() => {
        onRefresh?.();
      }, 1500);
    } catch (error) {
      console.error("Failed to retry sync:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  const totalFeedStock = product.feed.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
  const totalShopifyStock = product.shopify
    ? product.shopify.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0)
    : null;

  // Check for pricing issues:
  // 1. Prices are the same (margin not applied)
  // 2. Store price < feed price (margin applied incorrectly)
  const feedPrice = product.feed.variants[0]?.price ?? null;
  const shopPrice = product.shopify?.variants[0]?.price ?? null;
  const hasMarginIssue = feedPrice !== null && shopPrice !== null &&
    (Math.abs(feedPrice - shopPrice) < 0.01 || shopPrice < feedPrice);

  const cardClass = `compare-card ${hasDifferences ? "has-diff" : ""} ${hasError && !product.shopify ? "has-error" : ""}`;

  return (
    <Card
      variant="outlined"
      padding="none"
      className={`${cardClass} transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600`}
    >
      {/* Main Content */}
      <div className="relative z-10 p-4">
        {/* Header Row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Product Image */}
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-700">
            {feedImage ? (
              <img
                src={feedImage}
                alt={product.feed.name || "Product"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-6 w-6 text-slate-400" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                  {product.feed.name || "Untitled Product"}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 uppercase">Feed:</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 data-cell">
                    {product.feed.variants[0]?.sku || "—"}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">→</span>
                  <span className="text-[10px] text-slate-400 uppercase">Shop:</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 data-cell">
                    {product.shopify?.variants[0]?.sku || "—"}
                  </span>
                  {product.feedName && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-xs text-slate-500">{product.feedName}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col items-end gap-1">
                <StatusIndicator status={product.sync.status} hasShopifyData={!!product.shopify} />
                {product.shopify?.status && (
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${
                    product.shopify.status.toLowerCase() === 'active'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : product.shopify.status.toLowerCase() === 'draft'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {product.shopify.status}
                  </span>
                )}
              </div>
            </div>

            {/* Diff Type Badges */}
            {hasDifferences && (
              <div className="mt-2 flex flex-wrap gap-1">
                {product.differences.hasNameDiff && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                    Name
                  </Badge>
                )}
                {product.differences.hasDescriptionDiff && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                    Description
                  </Badge>
                )}
                {product.differences.hasVendorDiff && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                    Vendor
                  </Badge>
                )}
                {product.differences.hasTypeDiff && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                    Type
                  </Badge>
                )}
                {product.differences.hasPriceDiff && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                    Price
                  </Badge>
                )}
                {product.differences.hasInventoryDiff && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                    Stock
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Split Comparison Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Feed vs Shopify Data */}
          <div className="col-span-8 space-y-1 border-r border-slate-100 dark:border-slate-800 pr-4">
            <CompareField
              label="Brand"
              feedValue={product.feed.brand}
              shopifyValue={product.shopify?.vendor ?? null}
              hasDiff={product.differences.hasVendorDiff}
            />
            <CompareField
              label="Type"
              feedValue={product.feed.productType}
              shopifyValue={product.shopify?.productType ?? null}
              hasDiff={product.differences.hasTypeDiff}
            />
          </div>

          {/* Right: Price & Stock */}
          <div className="col-span-4 flex gap-4">
            <div className="flex-1">
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${hasMarginIssue ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                <span className={`w-1 h-1 rounded-full ${hasMarginIssue ? "bg-amber-500" : "bg-slate-400"}`} />
                Price
                {hasMarginIssue && (
                  <AlertTriangle className="w-3 h-3" />
                )}
              </div>
              <PriceCompare
                feedPrice={feedPrice}
                shopifyPrice={shopPrice}
                feedCurrency={product.feed.variants[0]?.currency || "USD"}
                storeCurrency={product.feed.variants[0]?.currency || "USD"}
              />
            </div>
            <div className="flex-1">
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${product.differences.hasInventoryDiff ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                <span className={`w-1 h-1 rounded-full ${product.differences.hasInventoryDiff ? "bg-amber-500" : "bg-slate-400"}`} />
                Stock
                {product.differences.hasInventoryDiff && (
                  <AlertTriangle className="w-3 h-3" />
                )}
              </div>
              <StockCompare
                feedStock={totalFeedStock}
                shopifyStock={totalShopifyStock}
                hasDiff={product.differences.hasInventoryDiff}
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {product.sync.status === "failed" && product.sync.lastError && (
          <div className="mt-4 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium flex-1">
                {product.sync.lastError}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetrySync}
                disabled={isRetrying}
                className="h-6 px-2 text-xs gap-1 shrink-0 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry Sync"}
              </Button>
            </div>
          </div>
        )}

        {/* Footer: Expand + Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 gap-1.5 -ml-2"
          >
            <Layers className="w-3.5 h-3.5" />
            {product.feed.variants.length} {product.feed.variants.length === 1 ? "variant" : "variants"}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </Button>

          <div className="flex items-center gap-2">
            {/* View Details button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDetailOpen(true)}
                    className="h-7 px-2 text-xs gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View detailed comparison</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Sync button - always available */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetrySync}
                    disabled={isRetrying}
                    className="h-7 px-2 text-xs gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                    {isRetrying ? "Syncing..." : "Sync"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Force sync this product to Shopify</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {product.sync.shopifyAdminUrl && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs gap-1.5">
                      <a href={product.sync.shopifyAdminUrl} target="_blank" rel="noopener noreferrer">
                        <Store className="w-3.5 h-3.5" />
                        View in Shopify
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in Shopify Admin</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Variants Section */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="p-4">
            {/* Variants Header */}
            <div className="grid grid-cols-12 gap-3 pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="col-span-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">SKU</div>
              <div className="col-span-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Variant</div>
              <div className="col-span-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Feed Price</div>
              <div className="col-span-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Shop Price</div>
              <div className="col-span-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Feed</div>
              <div className="col-span-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Shop</div>
            </div>

            {/* Variant Rows */}
            <div className="space-y-0">
              {product.feed.variants.map((feedVariant, index) => {
                let shopifyVariant = product.shopify?.variants.find(
                  (sv) => sv.sku && feedVariant.sku && sv.sku === feedVariant.sku
                );
                if (!shopifyVariant && product.shopify?.variants) {
                  if (product.feed.variants.length === 1 && product.shopify.variants.length === 1) {
                    shopifyVariant = product.shopify.variants[0];
                  } else if (product.shopify.variants[index]) {
                    shopifyVariant = product.shopify.variants[index];
                  }
                }

                // Flag as issue if:
                // 1. Prices are the same (margin not applied)
                // 2. Store price < feed price (margin applied incorrectly)
                const hasMarginIssue = shopifyVariant && feedVariant.price != null
                  ? (Math.abs(feedVariant.price - shopifyVariant.price) < 0.01 || shopifyVariant.price < feedVariant.price)
                  : false;
                const stockDiff = shopifyVariant
                  ? feedVariant.quantity !== shopifyVariant.inventoryQuantity
                  : false;

                const formatPrice = (price: number | null, currency: string = "USD") => {
                  if (price === null) return "—";
                  return new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency,
                  }).format(price);
                };

                return (
                  <div
                    key={feedVariant.id}
                    className="variant-row grid grid-cols-12 gap-3 py-2 rounded-md px-1 -mx-1"
                  >
                    <div className="col-span-3 truncate">
                      <span className="data-cell text-slate-700 dark:text-slate-300">
                        {feedVariant.sku || "—"}
                      </span>
                    </div>
                    <div className="col-span-3 truncate text-sm text-slate-600 dark:text-slate-400">
                      {feedVariant.name || "Default"}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`data-cell ${hasMarginIssue ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
                        {formatPrice(feedVariant.price, feedVariant.currency || "USD")}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`data-cell ${hasMarginIssue ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-600 dark:text-slate-400"}`}>
                        {shopifyVariant ? formatPrice(shopifyVariant.price, feedVariant.currency || "USD") : "—"}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className={`data-cell ${stockDiff ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
                        {feedVariant.quantity}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className={`data-cell ${stockDiff ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-600 dark:text-slate-400"}`}>
                        {shopifyVariant ? shopifyVariant.inventoryQuantity : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <CompareDetailSheet
        product={product}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onRefresh={onRefresh}
      />
    </Card>
  );
}

function StatCard({
  label,
  value,
  variant,
  icon: Icon,
}: {
  label: string;
  value: number;
  variant: "synced" | "diff" | "error" | "pending";
  icon: React.ElementType;
}) {
  const variantStyles = {
    synced: "stat-synced",
    diff: "stat-diff",
    error: "stat-error",
    pending: "stat-pending",
  };

  const iconColors = {
    synced: "text-emerald-600 dark:text-emerald-400",
    diff: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
    pending: "text-slate-500",
  };

  return (
    <Card
      variant="outlined"
      padding="sm"
      className={`stat-card ${variantStyles[variant]} min-w-[140px]`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {value}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mt-0.5">
            {label}
          </div>
        </div>
        <Icon className={`w-5 h-5 ${iconColors[variant]} opacity-60`} />
      </div>
    </Card>
  );
}

export function ShopCompareView({ products, summary, isLoading, onRefresh }: ShopCompareViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <style>{styles}</style>
        {/* Stats skeleton */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 min-w-[140px] rounded-xl" />
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{styles}</style>

      {/* Summary Stats */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2">
          <StatCard
            label="In Shopify"
            value={summary.synced}
            variant="synced"
            icon={Check}
          />
          {summary.withDifferences > 0 && (
            <StatCard
              label="With Differences"
              value={summary.withDifferences}
              variant="diff"
              icon={AlertTriangle}
            />
          )}
          {summary.failed > 0 && (
            <StatCard
              label="Sync Errors"
              value={summary.failed}
              variant="error"
              icon={X}
            />
          )}
          {summary.neverSynced > 0 && (
            <StatCard
              label="Not Synced"
              value={summary.neverSynced}
              variant="pending"
              icon={MinusCircle}
            />
          )}
          {summary.pending > 0 && (
            <StatCard
              label="Pending"
              value={summary.pending}
              variant="pending"
              icon={Clock}
            />
          )}
        </div>
      </ScrollArea>

      {/* Product Cards */}
      {products.length === 0 ? (
        <Card variant="outlined" padding="lg" className="text-center">
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Database className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">No products to compare</h3>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search criteria</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <CompareCard key={product.id} product={product} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}
