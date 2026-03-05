"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import {
  Package,
  ExternalLink,
  AlertTriangle,
  Check,
  X,
  Copy,
  ChevronRight,
  Tag,
  Layers,
  FileText,
  Code,
  Clock,
  Store,
  Database,
  Settings,
  Filter,
  DollarSign,
  Lock,
  ArrowRight,
  Play,
  RefreshCw,
  Loader2,
  Zap,
  Trash2,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { CompareProduct } from "@/hooks/use-shop-catalog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

interface CompareDetailSheetProps {
  product: CompareProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

// Diff indicator component
function DiffBadge({ hasDiff, feedValue, shopValue }: { hasDiff: boolean; feedValue: string | null; shopValue: string | null }) {
  if (!hasDiff) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Check className="w-3 h-3" />
        <span className="text-xs">Match</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
      <AlertTriangle className="w-3 h-3" />
      <span className="text-xs">Differs</span>
    </span>
  );
}

// Copy button component
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-slate-400" />
      )}
    </button>
  );
}

// Field comparison row
function CompareRow({
  label,
  feedValue,
  shopValue,
  hasDiff,
  type = "text",
}: {
  label: string;
  feedValue: string | number | null | undefined;
  shopValue: string | number | null | undefined;
  hasDiff?: boolean;
  type?: "text" | "price" | "array" | "html";
}) {
  const feedStr = feedValue?.toString() || "—";
  const shopStr = shopValue?.toString() || "—";
  const isDifferent = hasDiff ?? (feedStr !== shopStr && feedStr !== "—" && shopStr !== "—");

  return (
    <div className="grid grid-cols-12 gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="col-span-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="col-span-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {type === "html" ? (
              <div
                className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none line-clamp-3"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(feedStr) }}
              />
            ) : (
              <span className={`text-sm break-words ${isDifferent ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
                {feedStr}
              </span>
            )}
          </div>
          {feedStr !== "—" && <CopyButton value={feedStr} />}
        </div>
      </div>
      <div className="col-span-1 flex justify-center">
        {isDifferent ? (
          <ChevronRight className="w-4 h-4 text-amber-500" />
        ) : (
          <Check className="w-4 h-4 text-emerald-500" />
        )}
      </div>
      <div className="col-span-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {type === "html" ? (
              <div
                className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none line-clamp-3"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(shopStr) }}
              />
            ) : (
              <span className={`text-sm break-words ${isDifferent ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-600 dark:text-slate-400"}`}>
                {shopStr}
              </span>
            )}
          </div>
          {shopStr !== "—" && <CopyButton value={shopStr} />}
        </div>
      </div>
      <div className="col-span-1 flex justify-end">
        {isDifferent && (
          <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
            DIFF
          </Badge>
        )}
      </div>
    </div>
  );
}

// Tags comparison component
function TagsCompare({ feedTags, shopTags }: { feedTags: string[] | null; shopTags: string[] }) {
  const feed = feedTags || [];
  const shop = shopTags || [];

  return (
    <div className="grid grid-cols-12 gap-4 py-3 border-b border-slate-100 dark:border-slate-800">
      <div className="col-span-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Tags
        </span>
      </div>
      <div className="col-span-4">
        <div className="flex flex-wrap gap-1">
          {feed.length > 0 ? feed.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={`text-[10px] ${shop.includes(tag) ? "bg-slate-50 dark:bg-slate-900" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"}`}
            >
              {tag}
            </Badge>
          )) : <span className="text-sm text-slate-400">—</span>}
        </div>
      </div>
      <div className="col-span-1" />
      <div className="col-span-4">
        <div className="flex flex-wrap gap-1">
          {shop.length > 0 ? shop.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={`text-[10px] ${feed.includes(tag) ? "bg-slate-50 dark:bg-slate-900" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"}`}
            >
              {tag}
            </Badge>
          )) : <span className="text-sm text-slate-400">—</span>}
        </div>
      </div>
      <div className="col-span-1" />
    </div>
  );
}

// Description comparison component with expand/collapse
function DescriptionCompare({
  feedDescription,
  shopDescription,
  hasDiff,
}: {
  feedDescription: string | null;
  shopDescription: string | null | undefined;
  hasDiff?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const feedStr = feedDescription || "—";
  const shopStr = shopDescription || "—";
  const isDifferent = hasDiff ?? (feedStr !== shopStr && feedStr !== "—" && shopStr !== "—");

  return (
    <div className="grid grid-cols-12 gap-4 py-3 border-b border-slate-100 dark:border-slate-800">
      <div className="col-span-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Description
        </span>
        {(feedStr !== "—" || shopStr !== "—") && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>
      <div className="col-span-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none ${expanded ? "" : "line-clamp-3"}`}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(feedStr) }}
            />
          </div>
          {feedStr !== "—" && <CopyButton value={feedStr} />}
        </div>
      </div>
      <div className="col-span-1 flex justify-center">
        {isDifferent ? (
          <ChevronRight className="w-4 h-4 text-amber-500" />
        ) : (
          <Check className="w-4 h-4 text-emerald-500" />
        )}
      </div>
      <div className="col-span-4">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none ${expanded ? "" : "line-clamp-3"}`}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(shopStr) }}
            />
          </div>
          {shopStr !== "—" && <CopyButton value={shopStr} />}
        </div>
      </div>
      <div className="col-span-1 flex justify-end">
        {isDifferent && (
          <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
            DIFF
          </Badge>
        )}
      </div>
    </div>
  );
}

// Images side-by-side comparison component
function ImagesCompare({
  feedImages,
  shopImages,
}: {
  feedImages: string[];
  shopImages?: string[];
}) {
  const shopImgs = shopImages || [];
  const maxImages = Math.max(feedImages.length, shopImgs.length);

  return (
    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-4">
        Images Comparison
      </h4>
      <div className="grid grid-cols-2 gap-6">
        {/* Feed Images */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            <Database className="w-3.5 h-3.5" />
            Feed Images ({feedImages.length})
          </div>
          <div className="grid grid-cols-4 gap-2">
            {feedImages.length > 0 ? feedImages.map((img, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700"
              >
                <img
                  src={img}
                  alt={`Feed image ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )) : (
              <div className="col-span-4 text-sm text-slate-400 py-4">No images</div>
            )}
          </div>
        </div>

        {/* Shopify Images */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            <Store className="w-3.5 h-3.5" />
            Shopify Images ({shopImgs.length})
          </div>
          <div className="grid grid-cols-4 gap-2">
            {shopImgs.length > 0 ? shopImgs.map((img, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700"
              >
                <img
                  src={img}
                  alt={`Shopify image ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )) : (
              <div className="col-span-4 text-sm text-slate-400 py-4">No images in Shopify</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Variant detail row - table-style layout
function VariantRow({ feedVariant, shopVariant, index }: {
  feedVariant: CompareProduct["feed"]["variants"][0];
  shopVariant: NonNullable<CompareProduct["shopify"]>["variants"][0] | undefined;
  index: number;
}) {
  const formatPrice = (price: number | null, currency: string = "USD") => {
    if (price === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  };

  // Only check price and stock for issues (not SKU - it's expected to differ due to prefix)
  const priceDiff = shopVariant && feedVariant.price != null
    ? Math.abs(feedVariant.price - shopVariant.price) > 0.01
    : false;
  const stockDiff = shopVariant
    ? feedVariant.quantity !== shopVariant.inventoryQuantity
    : false;

  // Build comparison rows for the table
  const rows = [
    { label: "SKU", feedValue: feedVariant.sku || "—", shopValue: shopVariant?.sku || "—", highlight: false },
    { label: "Name/Title", feedValue: feedVariant.name || "Default", shopValue: shopVariant?.title || "Default", highlight: false },
    { label: "Barcode", feedValue: feedVariant.barcode || "—", shopValue: shopVariant?.barcode || "—", highlight: false },
    { label: "Price", feedValue: formatPrice(feedVariant.price, feedVariant.currency || "USD"), shopValue: shopVariant ? formatPrice(shopVariant.price, feedVariant.currency || "USD") : "—", highlight: priceDiff },
    { label: "Compare At", feedValue: formatPrice(feedVariant.compareAtPrice, feedVariant.currency || "USD"), shopValue: shopVariant ? formatPrice(shopVariant.compareAtPrice, feedVariant.currency || "USD") : "—", highlight: false },
    { label: "Stock", feedValue: String(feedVariant.quantity), shopValue: shopVariant ? String(shopVariant.inventoryQuantity) : "—", highlight: stockDiff },
  ];

  if (shopVariant?.externalId) {
    rows.push({ label: "Shopify ID", feedValue: "—", shopValue: shopVariant.externalId, highlight: false });
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          Variant {index + 1}
          {feedVariant.sku && <span className="ml-2 font-mono text-slate-400">({feedVariant.sku})</span>}
        </span>
        {(priceDiff || stockDiff) && (
          <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {priceDiff && stockDiff ? "Price & Stock Diff" : priceDiff ? "Price Diff" : "Stock Diff"}
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {/* Column headers */}
        <div className="grid grid-cols-12 text-xs font-medium uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="col-span-2 px-4 py-2">Field</div>
          <div className="col-span-5 px-4 py-2 flex items-center gap-1.5">
            <Database className="w-3 h-3" />
            Feed
          </div>
          <div className="col-span-5 px-4 py-2 flex items-center gap-1.5">
            <Store className="w-3 h-3" />
            Shopify
          </div>
        </div>

        {/* Data rows */}
        {rows.map((row) => (
          <div
            key={row.label}
            className={`grid grid-cols-12 text-sm ${row.highlight ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
          >
            <div className="col-span-2 px-4 py-2 text-xs font-medium text-slate-500">{row.label}</div>
            <div className={`col-span-5 px-4 py-2 font-mono text-xs ${row.highlight ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
              {row.feedValue}
            </div>
            <div className={`col-span-5 px-4 py-2 font-mono text-xs ${row.highlight ? "text-amber-700 dark:text-amber-300 font-medium" : "text-slate-600 dark:text-slate-400"}`}>
              {row.shopValue}
            </div>
          </div>
        ))}

        {/* Attributes section */}
        {(feedVariant.attributes && Object.keys(feedVariant.attributes).length > 0) || (shopVariant?.attributes && Object.keys(shopVariant.attributes).length > 0) ? (
          <div className="px-4 py-3 bg-slate-50/30 dark:bg-slate-800/20">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Attributes</span>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                {feedVariant.attributes && Object.entries(feedVariant.attributes).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-slate-500">{key}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {shopVariant?.attributes && Object.entries(shopVariant.attributes).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-slate-500">{key}</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Not synced message */}
      {!shopVariant && (
        <div className="px-4 py-6 text-center text-sm text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
          Not synced to Shopify
        </div>
      )}
    </div>
  );
}

export function CompareDetailSheet({ product, open, onOpenChange, onRefresh }: CompareDetailSheetProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isForceResyncing, setIsForceResyncing] = useState(false);
  const [isChangingMapping, setIsChangingMapping] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [newShopifyProductId, setNewShopifyProductId] = useState("");
  const { getToken } = useAuth();

  if (!product) return null;

  const feedImage = product.feed.images?.[0];
  const hasMarginIssue = product.feed.variants[0]?.price != null &&
    product.shopify?.variants[0]?.price != null &&
    (Math.abs(product.feed.variants[0].price - product.shopify.variants[0].price) < 0.01 ||
      product.shopify.variants[0].price < product.feed.variants[0].price);

  const handleRetrySync = async () => {
    try {
      setIsRetrying(true);
      const token = await getToken();
      await apiClient(`/internal/shop/products/${product.id}/retry-sync`, {
        method: "POST",
        token: token ?? undefined,
      });
      toast.success("Sync triggered", {
        description: `Resync started for "${product.feed.name}"`,
      });
      // Refresh the list after a short delay to allow sync to start
      setTimeout(() => {
        onRefresh?.();
      }, 2000);
    } catch (error) {
      console.error("Failed to retry sync:", error);
      toast.error("Sync failed", {
        description: "Could not trigger resync. Please try again.",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleForceResync = async () => {
    try {
      setIsForceResyncing(true);
      const token = await getToken();
      await apiClient(`/internal/shop/products/${product.id}/retry-sync?force=true`, {
        method: "POST",
        token: token ?? undefined,
      });
      toast.success("Force resync triggered", {
        description: `Full resync started for "${product.feed.name}"`,
      });
      setTimeout(() => {
        onRefresh?.();
      }, 2000);
    } catch (error) {
      console.error("Failed to force resync:", error);
      toast.error("Force resync failed", {
        description: "Could not trigger force resync. Please try again.",
      });
    } finally {
      setIsForceResyncing(false);
    }
  };

  const handleChangeMapping = async () => {
    const trimmedId = newShopifyProductId.trim();
    if (!trimmedId) return;

    try {
      setIsChangingMapping(true);
      const token = await getToken();
      await apiClient(`/internal/shop/products/${product.id}/mapping`, {
        method: "PUT",
        token: token ?? undefined,
        body: JSON.stringify({ shopifyProductId: trimmedId }),
      });
      toast.success("Mapping updated", {
        description: `Product now mapped to Shopify product ${trimmedId}`,
      });
      setShowMappingDialog(false);
      setNewShopifyProductId("");
      setTimeout(() => {
        onRefresh?.();
      }, 1000);
    } catch (error) {
      console.error("Failed to change mapping:", error);
      toast.error("Failed to change mapping", {
        description: "Could not update the Shopify product mapping.",
      });
    } finally {
      setIsChangingMapping(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-start gap-4">
            {/* Product Image */}
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 ring-1 ring-slate-200 dark:ring-slate-700">
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

            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate pr-8">
                {product.feed.name || "Untitled Product"}
              </SheetTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span className="font-mono">{product.feed.variants[0]?.sku || "No SKU"}</span>
                {product.feedName && (
                  <>
                    <span>•</span>
                    <span>{product.feedName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {product.differences.totalDiffCount > 0 && (
                  <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {product.differences.totalDiffCount} differences
                  </Badge>
                )}
                {hasMarginIssue && (
                  <Badge className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700">
                    Pricing Issue
                  </Badge>
                )}
                {product.sync.status === "failed" && (
                  <Badge className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700">
                    Sync Failed
                  </Badge>
                )}
                {product.sync.shopifyAdminUrl && (
                  <a
                    href={product.sync.shopifyAdminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View in Shopify
                  </a>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Content with Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="overview">
                <FileText className="w-4 h-4 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="variants">
                <Layers className="w-4 h-4 mr-1.5" />
                Variants ({product.feed.variants.length})
              </TabsTrigger>
              <TabsTrigger value="sync">
                <Clock className="w-4 h-4 mr-1.5" />
                Sync Status
              </TabsTrigger>
              <TabsTrigger value="rules">
                <Settings className="w-4 h-4 mr-1.5" />
                Rules
              </TabsTrigger>
              <TabsTrigger value="actions">
                <Zap className="w-4 h-4 mr-1.5" />
                Actions
              </TabsTrigger>
              <TabsTrigger value="raw">
                <Code className="w-4 h-4 mr-1.5" />
                Raw Data
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            {/* Overview Tab */}
            <TabsContent value="overview" className="p-6 m-0">
              {/* Column Headers */}
              <div className="grid grid-cols-12 gap-4 pb-3 mb-2 border-b-2 border-slate-200 dark:border-slate-700">
                <div className="col-span-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Field
                  </span>
                </div>
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Feed Data
                    </span>
                  </div>
                </div>
                <div className="col-span-1" />
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Shopify Data
                    </span>
                  </div>
                </div>
                <div className="col-span-1" />
              </div>

              {/* Comparison Rows */}
              <div className="space-y-0">
                <CompareRow
                  label="Name"
                  feedValue={product.feed.name}
                  shopValue={product.shopify?.title}
                  hasDiff={product.differences.hasNameDiff}
                />
                <CompareRow
                  label="Brand"
                  feedValue={product.feed.brand}
                  shopValue={product.shopify?.vendor}
                  hasDiff={product.differences.hasVendorDiff}
                />
                <CompareRow
                  label="Type"
                  feedValue={product.feed.productType}
                  shopValue={product.shopify?.productType}
                  hasDiff={product.differences.hasTypeDiff}
                />
                <DescriptionCompare
                  feedDescription={product.feed.description}
                  shopDescription={product.shopify?.description}
                  hasDiff={product.differences.hasDescriptionDiff}
                />
                <TagsCompare
                  feedTags={product.feed.tags}
                  shopTags={product.shopify?.tags || []}
                />
                <CompareRow
                  label="Status"
                  feedValue="—"
                  shopValue={product.shopify?.status}
                />
                <CompareRow
                  label="Product ID"
                  feedValue={product.id}
                  shopValue={product.shopify?.externalId}
                  hasDiff={false}
                />
              </div>

              {/* Images Section */}
              <ImagesCompare
                feedImages={product.feed.images}
                shopImages={product.shopify?.images}
              />
            </TabsContent>

            {/* Variants Tab */}
            <TabsContent value="variants" className="p-6 m-0">
              <div className="space-y-4">
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

                  return (
                    <VariantRow
                      key={feedVariant.id}
                      feedVariant={feedVariant}
                      shopVariant={shopifyVariant}
                      index={index}
                    />
                  );
                })}
              </div>
            </TabsContent>

            {/* Sync Status Tab */}
            <TabsContent value="sync" className="p-6 m-0">
              <div className="space-y-6">
                {/* Sync Status Card */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Current Sync Status
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Status</span>
                      <div className="mt-1">
                        <Badge
                          className={
                            product.shopify && (product.sync.status === "synced" || product.sync.status === "success" || product.sync.status === "never" || !product.sync.status)
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                              : product.sync.status === "failed"
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }
                        >
                          {product.shopify ? (product.sync.status === "failed" ? "Failed" : "Synced") : "Not Synced"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Shopify Product ID</span>
                      <div className="mt-1 font-mono text-sm">
                        {product.shopify?.externalId || "—"}
                      </div>
                    </div>
                  </div>

                  {product.sync.lastError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase">
                            Last Error
                          </span>
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-mono break-all">
                            {product.sync.lastError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Differences Summary */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Differences Summary
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Name", hasDiff: product.differences.hasNameDiff },
                      { label: "Description", hasDiff: product.differences.hasDescriptionDiff },
                      { label: "Vendor/Brand", hasDiff: product.differences.hasVendorDiff },
                      { label: "Product Type", hasDiff: product.differences.hasTypeDiff },
                      { label: "Price", hasDiff: product.differences.hasPriceDiff },
                      { label: "Inventory", hasDiff: product.differences.hasInventoryDiff },
                    ].map(({ label, hasDiff }) => (
                      <div
                        key={label}
                        className={`flex items-center justify-between p-2 rounded ${
                          hasDiff
                            ? "bg-amber-50 dark:bg-amber-950/30"
                            : "bg-emerald-50 dark:bg-emerald-950/30"
                        }`}
                      >
                        <span className="text-sm">{label}</span>
                        {hasDiff ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Check className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* IDs for Debugging */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Internal IDs (for debugging)
                  </h4>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Product ID</span>
                      <span className="flex items-center gap-1">
                        {product.id}
                        <CopyButton value={product.id} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Feed ID</span>
                      <span className="flex items-center gap-1">
                        {product.feedId || "—"}
                        {product.feedId && <CopyButton value={product.feedId} />}
                      </span>
                    </div>
                    {product.shopify && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Shopify Product ID</span>
                        <span className="flex items-center gap-1">
                          {product.shopify.externalId}
                          <CopyButton value={product.shopify.externalId} />
                        </span>
                      </div>
                    )}
                    {product.sync.shopifyAdminUrl && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Admin URL</span>
                        <a
                          href={product.sync.shopifyAdminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules" className="p-6 m-0">
              <div className="space-y-6">
                {product.rulesApplied ? (
                  <>
                    {/* SKU Prefix */}
                    {product.rulesApplied.skuPrefix && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          SKU Prefix
                        </h4>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                          <span className="font-mono text-sm">{product.rulesApplied.skuPrefix}</span>
                        </div>
                      </div>
                    )}

                    {/* Filter Rules */}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filter Rules
                      </h4>
                      {Object.keys(product.rulesApplied.filterRules || {}).length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {product.rulesApplied.filterRules.brands && product.rulesApplied.filterRules.brands.length > 0 && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                              <span className="text-xs font-medium text-slate-500 uppercase">Include Brands</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.rulesApplied.filterRules.brands.map((b, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px]">{b}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.excludeBrands && product.rulesApplied.filterRules.excludeBrands.length > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Exclude Brands</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.rulesApplied.filterRules.excludeBrands.map((b, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-300">{b}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.productTypes && product.rulesApplied.filterRules.productTypes.length > 0 && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                              <span className="text-xs font-medium text-slate-500 uppercase">Include Product Types</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.rulesApplied.filterRules.productTypes.map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.excludeProductTypes && product.rulesApplied.filterRules.excludeProductTypes.length > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Exclude Product Types</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.rulesApplied.filterRules.excludeProductTypes.map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-300">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.tags && product.rulesApplied.filterRules.tags.length > 0 && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                              <span className="text-xs font-medium text-slate-500 uppercase">Include Tags</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.rulesApplied.filterRules.tags.map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.excludeTags && product.rulesApplied.filterRules.excludeTags.length > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Exclude Tags</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.rulesApplied.filterRules.excludeTags.map((t, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-300">{t}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {(product.rulesApplied.filterRules.minPrice !== undefined || product.rulesApplied.filterRules.maxPrice !== undefined) && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                              <span className="text-xs font-medium text-slate-500 uppercase">Price Range</span>
                              <p className="mt-1 text-sm">
                                {product.rulesApplied.filterRules.minPrice !== undefined && `Min: $${product.rulesApplied.filterRules.minPrice}`}
                                {product.rulesApplied.filterRules.minPrice !== undefined && product.rulesApplied.filterRules.maxPrice !== undefined && " – "}
                                {product.rulesApplied.filterRules.maxPrice !== undefined && `Max: $${product.rulesApplied.filterRules.maxPrice}`}
                              </p>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.requireStock && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Require Stock</span>
                              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Only sync products with stock &gt; 0</p>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.excludeTitleKeywords && product.rulesApplied.filterRules.excludeTitleKeywords.length > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg col-span-2">
                              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Exclude Title Keywords</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {product.rulesApplied.filterRules.excludeTitleKeywords.map((k, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-300">{k}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {product.rulesApplied.filterRules.defaultToDraft && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                              <span className="text-xs font-medium text-slate-500 uppercase">Default Status</span>
                              <p className="mt-1 text-sm">New products set to DRAFT</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>No product filters applied - all products synced</span>
                        </div>
                      )}
                    </div>

                    {/* Pricing Margin */}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Pricing Margin
                        </h4>
                        {product.rulesApplied.pricingMarginSource && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              product.rulesApplied.pricingMarginSource === "global"
                                ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                : "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            }`}
                          >
                            {product.rulesApplied.pricingMarginSource === "global" ? "Global Settings" : "Feed Override"}
                          </Badge>
                        )}
                      </div>
                      {product.rulesApplied.pricingMargin ? (
                        <div className="space-y-4">
                          {product.rulesApplied.pricingMargin.defaultMargin && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Default Margin</span>
                              <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                                {product.rulesApplied.pricingMargin.defaultMargin.type === "percentage"
                                  ? `+${product.rulesApplied.pricingMargin.defaultMargin.value}%`
                                  : `+$${product.rulesApplied.pricingMargin.defaultMargin.value}`}
                              </p>
                            </div>
                          )}
                          {product.rulesApplied.pricingMargin.rules && product.rulesApplied.pricingMargin.rules.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-slate-500 uppercase">Conditional Rules ({product.rulesApplied.pricingMargin.rules.length})</span>
                              <div className="mt-2 space-y-2">
                                {product.rulesApplied.pricingMargin.rules.map((rule) => (
                                  <div key={rule.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium">{rule.name}</span>
                                      <Badge variant="outline" className="text-[10px]">
                                        Priority: {rule.priority}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <span>Conditions:</span>
                                      {rule.conditions.map((c, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px]">
                                          {c.field} {c.operator} {String(c.value)}
                                        </Badge>
                                      ))}
                                      <ArrowRight className="w-3 h-3" />
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {rule.marginType === "percentage" ? `+${rule.marginValue}%` : `+$${rule.marginValue}`}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {product.rulesApplied.pricingMargin.rounding?.enabled && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                              <span className="text-xs font-medium text-slate-500 uppercase">Rounding</span>
                              <p className="mt-1 text-sm">
                                {product.rulesApplied.pricingMargin.rounding.strategy} to {product.rulesApplied.pricingMargin.rounding.precision} decimal places
                                {product.rulesApplied.pricingMargin.rounding.endWith !== undefined && ` (end with .${product.rulesApplied.pricingMargin.rounding.endWith})`}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>No markup applied - using feed prices directly</span>
                        </div>
                      )}
                    </div>

                    {/* Field Mappings */}
                    {product.rulesApplied.fieldMappings && product.rulesApplied.fieldMappings.length > 0 && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          Field Mappings ({product.rulesApplied.fieldMappings.length})
                        </h4>
                        <div className="space-y-2">
                          {product.rulesApplied.fieldMappings.map((mapping) => (
                            <div key={mapping.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                              <span className="text-slate-500">When</span>
                              <Badge variant="outline" className="text-xs">
                                {mapping.sourceField === "productType" ? "Product Type" : mapping.sourceField === "brand" ? "Brand" : "Tag"}
                              </Badge>
                              <span className="text-slate-500">is</span>
                              <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{mapping.sourceValue}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-500">set</span>
                              <Badge variant="outline" className="text-xs">
                                {mapping.targetField === "productType" ? "Product Type" : mapping.targetField === "brand" ? "Vendor" : "Tag"}
                              </Badge>
                              <span className="text-slate-500">to</span>
                              <span className="font-mono bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-xs">{mapping.targetValue}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Field Locks */}
                    {product.rulesApplied.fieldLocks?.enabled && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Field Locks
                        </h4>
                        <div className="space-y-2">
                          <div className="text-xs text-slate-500">
                            Namespace: <span className="font-mono">{product.rulesApplied.fieldLocks.namespace}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(product.rulesApplied.fieldLocks.mappings).map(([field, metafield]) => (
                              <div key={field} className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded text-xs">
                                <span className="font-medium">{field}</span>
                                <span className="text-slate-400 mx-1">→</span>
                                <span className="font-mono text-slate-600 dark:text-slate-400">{metafield}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Settings className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">No Rules Data Available</h3>
                    <p className="text-xs text-slate-500 mt-1">Sync settings information is not available for this product</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="p-6 m-0">
              <div className="space-y-6">
                {/* Sync Actions */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Sync Actions
                  </h4>
                  <div className="space-y-4">
                    {/* Resync Button */}
                    <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Resync Product
                        </h5>
                        <p className="text-xs text-slate-500 mt-1">
                          Push the latest feed data to Shopify. This will update the product with current feed values.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetrySync}
                        disabled={isRetrying || isForceResyncing}
                        className="ml-4 shrink-0"
                      >
                        {isRetrying ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Resync
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Force Full Resync Button */}
                    <div className="flex items-start justify-between p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Force Full Resync
                        </h5>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Ignore cached hashes and push all data to Shopify. Use this if the product seems stuck or out of sync.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleForceResync}
                        disabled={isRetrying || isForceResyncing}
                        className="ml-4 shrink-0 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      >
                        {isForceResyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Force Resync
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Change Mapping */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Product Mapping
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Mapped to Shopify</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {product.shopify?.externalId || "Not mapped"}
                      </span>
                    </div>
                    {showMappingDialog ? (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          New Shopify Product ID
                        </label>
                        <input
                          type="text"
                          value={newShopifyProductId}
                          onChange={(e) => setNewShopifyProductId(e.target.value)}
                          placeholder="e.g. 9682167431497 or gid://shopify/Product/..."
                          className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowMappingDialog(false);
                              setNewShopifyProductId("");
                            }}
                            disabled={isChangingMapping}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleChangeMapping}
                            disabled={isChangingMapping || !newShopifyProductId.trim()}
                          >
                            {isChangingMapping ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              "Update Mapping"
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMappingDialog(true)}
                        className="w-full"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Change Mapping
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status Info */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Current Status
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Sync Status</span>
                      <Badge
                        className={
                          product.shopify && (product.sync.status === "synced" || product.sync.status === "success" || product.sync.status === "never" || !product.sync.status)
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                            : product.sync.status === "failed"
                              ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                              : product.sync.status === "pending"
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }
                      >
                        {product.shopify ? (product.sync.status === "failed" ? "Failed" : "Synced") : "Not Synced"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Shopify Product</span>
                      <span className="text-sm font-mono">
                        {product.shopify?.externalId || "Not synced"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Differences</span>
                      <span className="text-sm">
                        {product.differences.totalDiffCount > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {product.differences.totalDiffCount} field{product.differences.totalDiffCount > 1 ? "s" : ""} differ
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">In sync</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {product.sync.lastError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase">
                            Last Error
                          </span>
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-mono break-all">
                            {product.sync.lastError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Links */}
                {product.shopify && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Quick Links
                    </h4>
                    <div className="space-y-2">
                      {product.sync.shopifyAdminUrl && (
                        <a
                          href={product.sync.shopifyAdminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Store className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            View in Shopify Admin
                          </span>
                          <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Raw Data Tab */}
            <TabsContent value="raw" className="p-6 m-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Raw Product Data (JSON)
                  </h4>
                  <CopyButton value={JSON.stringify(product, null, 2)} />
                </div>
                <pre className="p-4 bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-lg overflow-auto text-xs font-mono max-h-[600px]">
                  {JSON.stringify(product, null, 2)}
                </pre>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
