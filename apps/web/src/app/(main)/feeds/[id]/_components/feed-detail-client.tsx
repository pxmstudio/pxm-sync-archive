"use client";

import { useState } from "react";
import {
  ExternalLink,
  CheckCircle,
  XCircle,
  Globe,
  Package,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { useFeedDetail } from "@/hooks/use-feed-detail";
import { ConnectFeedDialog } from "./connect-feed-dialog";
import { FeedCatalog } from "./feed-catalog";
import { SyncSettingsPanel } from "./sync-settings";
import { FeedSourceDetailClient } from "./feed-source-detail-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

interface FeedDetailClientProps {
  feedId: string;
}

export function FeedDetailClient({ feedId }: FeedDetailClientProps) {
  // Check if this is a feed source (from Feed Library)
  const isFeedSource = feedId.startsWith("fsrc_");

  if (isFeedSource) {
    return <FeedSourceDetailClient feedId={feedId} />;
  }

  return <RegularFeedDetailClient feedId={feedId} />;
}

function RegularFeedDetailClient({ feedId }: { feedId: string }) {
  const { t } = useTranslation("feeds");
  const { feed, subscriptionStatus, subscriptionId, isLoading, error, refresh } =
    useFeedDetail(feedId);
  const [showConnectDialog, setShowConnectDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Feed Header Skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center space-y-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>

          {/* Products Grid Skeleton */}
          <div className="flex gap-6">
            {/* Filters Sidebar */}
            <div className="w-48 shrink-0 space-y-4">
              <Skeleton className="h-5 w-16" />
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1">
              <Skeleton className="h-10 w-full mb-4" />
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !feed) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{t("detail.failedToLoad")}</p>
        <p className="text-sm text-muted-foreground">{error?.message || t("error.feedNotFound")}</p>
      </div>
    );
  }

  const initials = feed.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleConnectSuccess = () => {
    setShowConnectDialog(false);
    refresh();
  };

  const canConnect = !subscriptionStatus;

  return (
    <div className="space-y-6">
      {/* Feed Header */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main profile */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={feed.logoUrl || undefined} alt={feed.name} className="object-cover" />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-xl">{feed.name}</CardTitle>
                  {feed.website && (
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Globe className="h-3 w-3" />
                      <a
                        href={feed.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {feed.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        <ExternalLink className="h-3 w-3 inline ml-1" />
                      </a>
                    </CardDescription>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{feedId}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feed.publicDescription || feed.description ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p>{feed.publicDescription || feed.description}</p>
                </div>
              ) : (
                <p className="text-muted-foreground italic">
                  {t("detail.noDescription")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Subscription status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("detail.subscriptionStatus")}</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionStatus === "active" ? (
                <div className="text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 mx-auto">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">{t("detail.subscribed")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("detail.subscribedDescription")}
                    </p>
                  </div>
                </div>
              ) : subscriptionStatus === "suspended" || subscriptionStatus === "terminated" ? (
                <div className="text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 mx-auto">
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {subscriptionStatus === "suspended" ? "Suspended" : "Terminated"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Your subscription has been {subscriptionStatus}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("detail.notSubscribed")}
                  </p>
                  <Button
                    onClick={() => setShowConnectDialog(true)}
                    disabled={!canConnect}
                    className="w-full"
                  >
                    {t("detail.connect")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Connect Feed Dialog */}
      <ConnectFeedDialog
        feedId={feedId}
        feedName={feed.name}
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
        onSuccess={handleConnectSuccess}
      />

      {/* Only show catalog/sync tabs when subscribed */}
      {subscriptionStatus === "active" && subscriptionId && (
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList>
            <TabsTrigger value="catalog" className="gap-2">
              <Package className="h-4 w-4" />
              {t("catalog.tab")}
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t("catalog.productSync")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="catalog" className="mt-6">
            <FeedCatalog feedId={feedId} />
          </TabsContent>
          <TabsContent value="sync" className="mt-6">
            <SyncSettingsPanel connectionId={subscriptionId} />
          </TabsContent>
        </Tabs>
      )}

    </div>
  );
}
