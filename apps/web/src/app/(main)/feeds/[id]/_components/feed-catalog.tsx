"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, Package, LayoutGrid, List } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { useDebounce } from "@/hooks/use-debounce";
import { ColumnDef } from "@tanstack/react-table";
import {
  useFeedCatalogProducts,
  useFeedCatalogFacets,
  type CatalogFilters,
  type CatalogProduct,
} from "@/hooks/use-feed-catalog";
import {
  CatalogFiltersSidebar,
  CatalogFiltersMobile,
  CatalogActiveFilters,
  type CatalogFiltersState,
} from "./catalog-filters";
import { CatalogProductCard } from "./catalog-product-card";
import { ProductDetailSheet } from "./product-detail-sheet";
import { Button } from "@workspace/ui/components/button";
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

interface FeedCatalogProps {
  feedId: string;
}

type SortOption = "updatedAt-desc" | "updatedAt-asc" | "name-asc" | "name-desc";
type ViewMode = "grid" | "list";

export function FeedCatalog({ feedId }: FeedCatalogProps) {
  const { t } = useTranslation("feeds");

  // Catalog hooks
  const {
    products,
    pagination,
    isLoading: productsLoading,
    fetchProducts,
  } = useFeedCatalogProducts(feedId);
  const { facets, isLoading: facetsLoading, fetchFacets } = useFeedCatalogFacets(feedId);

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filters state
  const [filters, setFilters] = useState<CatalogFiltersState>({
    brands: [],
    productTypes: [],
    collectionIds: [],
  });

  // Sort state
  const [sortOption, setSortOption] = useState<SortOption>("updatedAt-desc");

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Product detail sheet state
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Fetch facets on mount
  useEffect(() => {
    fetchFacets();
  }, [fetchFacets]);

  // Fetch products when filters or search changes
  const loadProducts = useCallback(
    (page = 1) => {
      const [sortBy, sortOrder] = sortOption.split("-") as [
        CatalogFilters["sortBy"],
        CatalogFilters["sortOrder"]
      ];

      const catalogFilters: CatalogFilters = {
        page,
        limit: 20,
        sortBy,
        sortOrder,
      };

      if (filters.brands.length > 0) {
        catalogFilters.brands = filters.brands;
      }
      if (filters.productTypes.length > 0) {
        catalogFilters.productTypes = filters.productTypes;
      }
      if (filters.collectionIds.length > 0) {
        catalogFilters.collectionIds = filters.collectionIds;
      }
      if (debouncedSearch) {
        catalogFilters.search = debouncedSearch;
      }

      fetchProducts(catalogFilters);
    },
    [filters, debouncedSearch, sortOption, fetchProducts]
  );

  // Load products when filters change
  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  const handlePageChange = (page: number) => {
    loadProducts(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFiltersChange = (newFilters: CatalogFiltersState) => {
    setFilters(newFilters);
  };

  const handleProductClick = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setIsSheetOpen(true);
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
  };

  // Table columns for list view
  const columns: ColumnDef<CatalogProduct>[] = useMemo(
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
        header: t("catalog.name"),
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
        header: t("catalog.brand"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.brand || "—"}
          </span>
        ),
      },
      {
        accessorKey: "productType",
        header: t("catalog.type"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.productType || "—"}
          </span>
        ),
      },
      {
        accessorKey: "variants",
        header: t("catalog.variants"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.variants?.length || 0}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: t("catalog.price"),
        cell: ({ row }) => {
          const firstVariant = row.original.variants?.[0];
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
    ],
    [t]
  );

  // Loading state
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

  const hasActiveFilters =
    filters.brands.length > 0 ||
    filters.productTypes.length > 0 ||
    filters.collectionIds.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <CatalogFiltersSidebar
          facets={facets}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Top bar: Mobile filters + Search + Sort + View */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Mobile filter trigger */}
            <CatalogFiltersMobile
              facets={facets}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("catalog.searchPlaceholder")}
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
                <SelectItem value="updatedAt-desc">{t("catalog.sort.newest")}</SelectItem>
                <SelectItem value="updatedAt-asc">{t("catalog.sort.oldest")}</SelectItem>
                <SelectItem value="name-asc">{t("catalog.sort.nameAZ")}</SelectItem>
                <SelectItem value="name-desc">{t("catalog.sort.nameZA")}</SelectItem>
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="hidden sm:flex border rounded-lg">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
                title={t("catalog.gridView")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-l-none"
                title={t("catalog.listView")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Results count */}
            <div className="hidden sm:flex items-center text-sm text-muted-foreground whitespace-nowrap">
              {pagination.total.toLocaleString()} {t("catalog.products")}
            </div>
          </div>

          {/* Active filters */}
          {hasActiveFilters && (
            <CatalogActiveFilters
              facets={facets}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          )}

          {/* Products */}
          {productsLoading ? (
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
                <EmptyTitle>{t("catalog.noProductsFound")}</EmptyTitle>
                <EmptyDescription>
                  {searchQuery || hasActiveFilters
                    ? t("catalog.noProductsDescription")
                    : t("catalog.noProductsYet")}
                </EmptyDescription>
              </EmptyHeader>
              {hasActiveFilters && (
                <EmptyContent>
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleFiltersChange({
                        brands: [],
                        productTypes: [],
                        collectionIds: [],
                      })
                    }
                  >
                    {t("catalog.clearFilters")}
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
                    <CatalogProductCard
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
                          pagination.page > 1 &&
                          handlePageChange(pagination.page - 1)
                        }
                        className={
                          pagination.page <= 1
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
                          Math.abs(page - pagination.page) <= 1
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
                              isActive={page === pagination.page}
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
                          pagination.page < pagination.totalPages &&
                          handlePageChange(pagination.page + 1)
                        }
                        className={
                          pagination.page >= pagination.totalPages
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
                {t("catalog.showingResults", {
                  from: ((pagination.page - 1) * pagination.limit + 1).toLocaleString(),
                  to: Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString(),
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
