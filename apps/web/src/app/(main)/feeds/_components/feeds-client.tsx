"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useFeeds, type FeedFilter } from "@/hooks/use-feeds";
import { FeedCard } from "./feed-card";
import { useDebounce } from "@/hooks/use-debounce";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

function FeedCardSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4 mt-3" />
        <Skeleton className="h-3 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-auto pt-2">
          <Skeleton className="h-9 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function FeedsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Render the feeds discovery and subscription interface with search, filters, grid listing, and pagination.
 *
 * Displays loading, error, and empty states as appropriate, and shows an upgrade prompt when the current user lacks access.
 *
 * @returns A React element containing the feeds UI (search input, filter tabs, feed cards grid, and pagination) or an upgrade prompt when access is not available.
 */
export function FeedsClient() {
  const { t } = useTranslation("feeds");
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = searchParams.get("page");
  const searchParam = searchParams.get("search");
  const filterParam = searchParams.get("filter") as FeedFilter | null;

  const [searchInput, setSearchInput] = useState(searchParam || "");
  const [activeFilter, setActiveFilter] = useState<FeedFilter>(
    filterParam || "all"
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  const currentPage = pageParam ? parseInt(pageParam, 10) : 1;

  const { feeds, pagination, isLoading, error } = useFeeds({
    page: currentPage,
    limit: 12,
    search: debouncedSearch || undefined,
    filter: activeFilter,
  });

  const updateUrl = useCallback(
    (page: number, search?: string, filter?: FeedFilter) => {
      const params = new URLSearchParams();
      if (page > 1) params.set("page", String(page));
      if (search) params.set("search", search);
      if (filter && filter !== "all") params.set("filter", filter);
      const query = params.toString();
      router.push(query ? `/feeds?${query}` : "/feeds");
    },
    [router]
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    updateUrl(1, value, activeFilter);
  };

  const handleFilterChange = (filter: FeedFilter) => {
    setActiveFilter(filter);
    updateUrl(1, searchInput, filter);
  };

  const handlePageChange = (page: number) => {
    updateUrl(page, searchInput, activeFilter);
  };

  const getEmptyMessage = () => {
    if (searchInput) {
      return {
        title: t("empty.noResults"),
        description: t("empty.tryDifferentSearch"),
      };
    }
    switch (activeFilter) {
      case "subscribed":
        return {
          title: t("empty.noSubscribed"),
          description: t("empty.noSubscribedDescription"),
        };
      default:
        return {
          title: t("empty.noFeeds"),
          description: t("empty.noFeedsDescription"),
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter tabs and search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Tabs
          value={activeFilter}
          onValueChange={(value) => handleFilterChange(value as FeedFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">{t("tabs.discover")}</TabsTrigger>
            <TabsTrigger value="subscribed">{t("tabs.subscribed")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && <FeedsGridSkeleton />}

      {/* Error */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">{t("error.failedToLoad")}</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && feeds?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg font-medium">{getEmptyMessage().title}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {getEmptyMessage().description}
          </p>
          {activeFilter !== "all" && !searchInput && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => handleFilterChange("all")}
            >
              {t("empty.browseAll")}
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && feeds && feeds.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {feeds.map((feed) => (
              <FeedCard key={feed.id} feed={feed} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {t("pagination.showing")} {((pagination.page - 1) * pagination.limit + 1).toLocaleString()} {t("pagination.to")}{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()} {t("pagination.of")}{" "}
                {pagination.total.toLocaleString()} {t("pagination.feeds")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("pagination.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= pagination.totalPages}
                >
                  {t("pagination.next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}