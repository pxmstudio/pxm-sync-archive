"use client";

import { useEffect, useState, useCallback, useMemo, useTransition } from "react";
import { useQueryStates } from "nuqs";
import { Search, Package, Rss, LayoutGrid, List, GitCompare, RefreshCw, Download } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { useDebounce } from "@/hooks/use-debounce";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import {
  useShopProducts,
  useShopFacets,
  useShopCompare,
  type ShopFilters,
  type ShopProduct,
  type CompareFilters,
} from "@/hooks/use-shop-catalog";
import {
  ShopFiltersSidebar,
  ShopFiltersMobile,
  ShopActiveFilters,
  type ShopFiltersState,
} from "./shop-filters";
import { ShopProductCard } from "./shop-product-card";
import { ShopCompareView } from "./shop-compare-view";
import { ProductDetailSheet } from "../../feeds/[id]/_components/product-detail-sheet";
import type { CatalogProduct } from "@/hooks/use-feed-catalog";
import { shopSearchParams, shopUrlKeys, type SortOption, type ViewMode } from "./search-params";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { DataTable } from "@workspace/ui/components/data-table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@workspace/ui/components/empty";
import { Input } from "@workspace/ui/components/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";

/**
 * Renders the shop catalog interface with search, filtering, sorting, view toggles, pagination, and product detail sheet.
 *
 * The component fetches product facets on mount and loads products when filters, search, or sort change. It conditionally
 * renders initial loading skeletons, an upgrade prompt when the user lacks access, an empty state when no feeds or products
 * are available, and the products in either a grid or list (table) view. Product details can be opened in a slide-over sheet.
 *
 * @returns The shop client UI as a React element.
 */
export function ShopClient() {
  const { t } = useTranslation("shop");

  // Shop hooks
  const {
    products,
    pagination,
    isLoading: productsLoading,
    fetchProducts,
  } = useShopProducts();
  const { facets, isLoading: facetsLoading, fetchFacets } = useShopFacets();
  const {
    products: compareProducts,
    pagination: comparePagination,
    summary: compareSummary,
    isLoading: compareLoading,
    fetchCompareProducts,
  } = useShopCompare();

  // URL state with nuqs
  const [urlState, setUrlState] = useQueryStates(shopSearchParams, {
    urlKeys: shopUrlKeys,
    shallow: false, // Notify server of URL changes for proper navigation
  });

  // Pending transition for non-blocking URL updates
  const [isPending, startTransition] = useTransition();

  // Destructure URL state for convenience
  const {
    q: searchQuery,
    feeds: feedIds,
    brands,
    types: productTypes,
    sort: sortOption,
    view: viewMode,
    diff: showOnlyDifferences,
    page: currentPage,
  } = urlState;

  // Debounce search for API calls
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Build filters object from URL state
  const filters: ShopFiltersState = useMemo(() => ({
    feedIds,
    brands,
    productTypes,
  }), [feedIds, brands, productTypes]);

  // Product detail sheet state (not persisted in URL)
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // URL state setters
  const setSearchQuery = useCallback((value: string) => {
    startTransition(() => {
      setUrlState({ q: value, page: 1 }); // Reset page on search
    });
  }, [setUrlState]);

  const setSortOption = useCallback((value: SortOption) => {
    startTransition(() => {
      setUrlState({ sort: value, page: 1 }); // Reset page on sort change
    });
  }, [setUrlState]);

  const setViewMode = useCallback((value: ViewMode) => {
    startTransition(() => {
      setUrlState({ view: value, page: 1 }); // Reset page on view change
    });
  }, [setUrlState]);

  const setShowOnlyDifferences = useCallback((value: boolean) => {
    startTransition(() => {
      setUrlState({ diff: value, page: 1 }); // Reset page on filter change
    });
  }, [setUrlState]);

  const setPage = useCallback((value: number) => {
    startTransition(() => {
      setUrlState({ page: value });
    });
  }, [setUrlState]);

  // Fetch facets on mount and when feed selection changes
  // Brands and product types will be filtered based on selected feeds
  useEffect(() => {
    fetchFacets(feedIds.length > 0 ? feedIds : undefined);
  }, [fetchFacets, feedIds]);

  // Clear invalid brands/productTypes when facets change (after feed selection changes)
  useEffect(() => {
    const availableBrands = new Set(facets.brands.map((b) => b.name));
    const availableProductTypes = new Set(facets.productTypes.map((t) => t.name));

    const validBrands = brands.filter((b) => availableBrands.has(b));
    const validProductTypes = productTypes.filter((t) => availableProductTypes.has(t));

    // Only update if there are invalid selections
    if (validBrands.length !== brands.length || validProductTypes.length !== productTypes.length) {
      startTransition(() => {
        setUrlState({
          brands: validBrands,
          types: validProductTypes,
        });
      });
    }
  }, [facets.brands, facets.productTypes, brands, productTypes, setUrlState]);

  // Fetch products when filters or search changes
  const loadProducts = useCallback(
    (page?: number) => {
      const effectivePage = page ?? currentPage;
      const [sortBy, sortOrder] = sortOption.split("-") as [
        ShopFilters["sortBy"],
        ShopFilters["sortOrder"]
      ];

      const shopFilters: ShopFilters = {
        page: effectivePage,
        limit: 20,
        sortBy,
        sortOrder,
      };

      if (filters.feedIds.length > 0) {
        shopFilters.feedIds = filters.feedIds;
      }
      if (filters.brands.length > 0) {
        shopFilters.brands = filters.brands;
      }
      if (filters.productTypes.length > 0) {
        shopFilters.productTypes = filters.productTypes;
      }
      if (debouncedSearch) {
        shopFilters.search = debouncedSearch;
      }

      fetchProducts(shopFilters);
    },
    [filters, debouncedSearch, sortOption, currentPage, fetchProducts]
  );

  // Fetch compare products when in compare mode
  const loadCompareProducts = useCallback(
    (page?: number) => {
      const effectivePage = page ?? currentPage;
      const [sortBy, sortOrder] = sortOption.split("-") as [
        CompareFilters["sortBy"],
        CompareFilters["sortOrder"]
      ];

      const compareFilters: CompareFilters = {
        page: effectivePage,
        limit: 20,
        sortBy,
        sortOrder,
        showOnlyDifferences,
      };

      if (filters.feedIds.length > 0) {
        compareFilters.feedIds = filters.feedIds;
      }
      if (filters.brands.length > 0) {
        compareFilters.brands = filters.brands;
      }
      if (filters.productTypes.length > 0) {
        compareFilters.productTypes = filters.productTypes;
      }
      if (debouncedSearch) {
        compareFilters.search = debouncedSearch;
      }

      fetchCompareProducts(compareFilters);
    },
    [filters, debouncedSearch, sortOption, showOnlyDifferences, currentPage, fetchCompareProducts]
  );

  // Load products when filters change (for grid/list view)
  useEffect(() => {
    if (viewMode !== "compare") {
      loadProducts();
    }
  }, [loadProducts, viewMode]);

  // Load compare products when in compare mode
  useEffect(() => {
    if (viewMode === "compare") {
      loadCompareProducts();
    }
  }, [loadCompareProducts, viewMode]);

  const handlePageChange = useCallback((page: number) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setPage]);

  const handleFiltersChange = useCallback((newFilters: ShopFiltersState) => {
    startTransition(() => {
      setUrlState({
        feeds: newFilters.feedIds,
        brands: newFilters.brands,
        types: newFilters.productTypes,
        page: 1, // Reset page on filter change
      });
    });
  }, [setUrlState]);

  const handleSortChange = useCallback((value: string) => {
    setSortOption(value as SortOption);
  }, [setSortOption]);

  const handleProductClick = (product: ShopProduct) => {
    setSelectedProduct(product as unknown as CatalogProduct);
    setIsSheetOpen(true);
  };

  // Export compare data to CSV
  const handleExportCSV = useCallback(() => {
    if (compareProducts.length === 0) return;

    const headers = [
      "Product ID",
      "Product Name (Feed)",
      "Product Name (Shopify)",
      "Brand (Feed)",
      "Brand (Shopify)",
      "Type (Feed)",
      "Type (Shopify)",
      "SKU",
      "Price (Feed)",
      "Price (Shopify)",
      "Stock (Feed)",
      "Stock (Shopify)",
      "Sync Status",
      "Has Differences",
      "Difference Count",
      "Shopify URL",
    ];

    const rows = compareProducts.flatMap((product) => {
      // Create a row for each variant
      return product.feed.variants.map((feedVariant) => {
        const shopifyVariant = product.shopify?.variants.find(
          (sv) => sv.sku === feedVariant.sku
        );

        return [
          product.id,
          product.feed.name || "",
          product.shopify?.title || "",
          product.feed.brand || "",
          product.shopify?.vendor || "",
          product.feed.productType || "",
          product.shopify?.productType || "",
          feedVariant.sku || "",
          feedVariant.price?.toString() || "",
          shopifyVariant?.price?.toString() || "",
          feedVariant.quantity?.toString() || "0",
          shopifyVariant?.inventoryQuantity?.toString() || "",
          product.sync.status,
          product.differences.totalDiffCount > 0 ? "Yes" : "No",
          product.differences.totalDiffCount.toString(),
          product.sync.shopifyAdminUrl || "",
        ];
      });
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => {
          // Escape quotes and wrap in quotes if contains comma or newline
          const escaped = String(cell).replace(/"/g, '""');
          return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
        }).join(",")
      ),
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `product-comparison-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [compareProducts]);

  // Table columns for list view
  const columns: ColumnDef<ShopProduct>[] = useMemo(
    () => [
      {
        accessorKey: "image",
        header: "",
        cell: ({ row }) => {
          const image = row.original.images?.[0];
          return (
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
              {image ? (
                <img
                  src={image}
                  alt={row.original.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "name",
        header: t("productCard.viewDetails"),
        cell: ({ row }) => (
          <button
            onClick={() => handleProductClick(row.original)}
            className="text-left hover:underline font-medium"
          >
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: "brand",
        header: "Brand",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.brand || "—"}
          </span>
        ),
      },
      {
        accessorKey: "productType",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.productType || "—"}
          </span>
        ),
      },
      {
        accessorKey: "variants",
        header: "Variants",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.variants.length}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => {
          const firstVariant = row.original.variants[0];
          if (!firstVariant?.price) return <span className="text-muted-foreground">—</span>;
          return (
            <span>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: firstVariant.currency || "USD",
              }).format(firstVariant.price)}
            </span>
          );
        },
      },
      {
        accessorKey: "feed",
        header: "Feed",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.feed?.name || "—"}
          </span>
        ),
      },
    ],
    [t]
  );

  // Loading state while fetching initial data
  if (facetsLoading && products.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 w-full sm:w-[200px]" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state - no subscribed feeds
  if (!facetsLoading && facets.feeds.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Rss className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>{t("empty.noFeeds")}</EmptyTitle>
          <EmptyDescription>{t("empty.noFeedsDescription")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/feeds">{t("empty.browseFeeds")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const hasActiveFilters =
    filters.feedIds.length > 0 ||
    filters.brands.length > 0 ||
    filters.productTypes.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <ShopFiltersSidebar
          facets={facets}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Top bar: Mobile filters + Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Mobile filter trigger */}
            <ShopFiltersMobile
              facets={facets}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Sort */}
            <Select value={sortOption} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt-desc">{t("sort.newest")}</SelectItem>
                <SelectItem value="updatedAt-asc">{t("sort.oldest")}</SelectItem>
                <SelectItem value="name-asc">{t("sort.nameAZ")}</SelectItem>
                <SelectItem value="name-desc">{t("sort.nameZA")}</SelectItem>
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="hidden sm:flex border rounded-lg">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
                title={t("gridView")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-none border-x-0"
                title={t("listView")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "compare" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("compare")}
                className="rounded-l-none"
                title="Compare Mode"
              >
                <GitCompare className="h-4 w-4" />
              </Button>
            </div>

            {/* Results count */}
            <div className="hidden sm:flex items-center text-sm text-muted-foreground whitespace-nowrap">
              {(viewMode === "compare" ? comparePagination.total : pagination.total).toLocaleString()} {t("products")}
            </div>
          </div>

          {/* Active filters */}
          {hasActiveFilters && (
            <ShopActiveFilters
              facets={facets}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          )}

          {/* Compare mode toolbar */}
          {viewMode === "compare" && (
            <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={showOnlyDifferences}
                  onCheckedChange={(checked: boolean | "indeterminate") => setShowOnlyDifferences(checked === true)}
                />
                Show only differences
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={compareLoading || compareProducts.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadCompareProducts()}
                  disabled={compareLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${compareLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          )}

          {/* Products - Compare view */}
          {viewMode === "compare" ? (
            <>
              <ShopCompareView
                products={compareProducts}
                summary={compareSummary}
                isLoading={compareLoading}
                onRefresh={() => loadCompareProducts()}
              />
              {/* Compare mode pagination */}
              {comparePagination.totalPages > 1 && (
                <Pagination className="mt-8">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          currentPage > 1 &&
                          handlePageChange(currentPage - 1)
                        }
                        className={
                          currentPage <= 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {Array.from({ length: comparePagination.totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        return (
                          page === 1 ||
                          page === comparePagination.totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, idx, arr) => {
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <PaginationItem key={page}>
                            {showEllipsis && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <PaginationLink
                              onClick={() => handlePageChange(page)}
                              isActive={page === currentPage}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          currentPage < comparePagination.totalPages &&
                          handlePageChange(currentPage + 1)
                        }
                        className={
                          currentPage >= comparePagination.totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          ) : productsLoading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4]" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            )
          ) : products.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>{t("empty.noProducts")}</EmptyTitle>
                <EmptyDescription>
                  {searchQuery || hasActiveFilters
                    ? t("empty.noProductsFiltered")
                    : t("empty.noProductsYet")}
                </EmptyDescription>
              </EmptyHeader>
              {hasActiveFilters && (
                <EmptyContent>
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleFiltersChange({
                        feedIds: [],
                        brands: [],
                        productTypes: [],
                      })
                    }
                  >
                    {t("filters.clearAll")}
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <>
              {/* Grid view */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <ShopProductCard
                      key={product.id}
                      product={product}
                      onClick={() => handleProductClick(product)}
                    />
                  ))}
                </div>
              ) : (
                /* List view */
                <DataTable columns={columns} data={products} />
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <Pagination className="mt-8">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          currentPage > 1 &&
                          handlePageChange(currentPage - 1)
                        }
                        className={
                          currentPage <= 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        return (
                          page === 1 ||
                          page === pagination.totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, idx, arr) => {
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <PaginationItem key={page}>
                            {showEllipsis && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <PaginationLink
                              onClick={() => handlePageChange(page)}
                              isActive={page === currentPage}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          currentPage < pagination.totalPages &&
                          handlePageChange(currentPage + 1)
                        }
                        className={
                          currentPage >= pagination.totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}

              {/* Results info */}
              <p className="text-center text-sm text-muted-foreground">
                {t("showingResults", {
                  from: ((currentPage - 1) * pagination.limit + 1).toLocaleString(),
                  to: Math.min(currentPage * pagination.limit, pagination.total).toLocaleString(),
                  total: pagination.total.toLocaleString(),
                })}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        product={selectedProduct}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </div>
  );
}