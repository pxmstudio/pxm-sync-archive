"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useFeedSources, type FeedSource } from "@/hooks/use-feed-sources";
import { FeedCard } from "./feed-card";
import type { Feed } from "@/hooks/use-feeds";
import { SubscribeFeedModal } from "./subscribe-feed-modal";
import { RequestFeedModal } from "./request-feed-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";

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

interface FeedLibraryProps {
  initialPage?: number;
  initialSearch?: string;
}

export function FeedLibrary({
  initialPage = 1,
  initialSearch = "",
}: FeedLibraryProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const debouncedSearch = useDebounce(searchInput, 300);

  const { feedSources, pagination, isLoading, error, refresh } = useFeedSources({
    page: currentPage,
    limit: 12,
    search: debouncedSearch || undefined,
  });

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSubscribe = (feed: Feed) => {
    setSelectedFeed(feed);
    setShowSubscribeModal(true);
  };

  const handleViewProducts = (feed: Feed) => {
    router.push(`/feeds/${feed.id}`);
  };

  const handleSubscribeSuccess = () => {
    refresh();
  };

  const handleRequestSuccess = () => {
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header with search and request button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search feeds..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowRequestModal(true)} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Request Feed
        </Button>
      </div>

      {/* Info text */}
      <p className="text-sm text-muted-foreground">
        Feed Library sources are managed by the platform. Subscribe to access their
        product feeds - orders must be placed directly with the source.
      </p>

      {/* Loading */}
      {isLoading && <FeedsGridSkeleton />}

      {/* Error */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load feeds</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && feedSources?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg font-medium">
            {searchInput ? "No feeds found" : "No feeds available"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {searchInput
              ? "Try a different search term"
              : "Request a feed you'd like to see in the Feed Library"}
          </p>
          {!searchInput && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowRequestModal(true)}
            >
              Request a Feed
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && feedSources && feedSources.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {feedSources.map((feedSource: FeedSource) => (
              <FeedCard
                key={feedSource.id}
                feed={feedSource as unknown as Feed}
                onSubscribe={handleSubscribe}
                onViewProducts={handleViewProducts}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit + 1).toLocaleString()} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()} of{" "}
                {pagination.total.toLocaleString()} feeds
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <SubscribeFeedModal
        feedSource={selectedFeed as unknown as FeedSource}
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        onSuccess={handleSubscribeSuccess}
      />

      <RequestFeedModal
        open={showRequestModal}
        onOpenChange={setShowRequestModal}
        onSuccess={handleRequestSuccess}
      />
    </div>
  );
}
