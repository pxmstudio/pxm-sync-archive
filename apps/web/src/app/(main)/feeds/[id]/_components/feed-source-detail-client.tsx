"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  CheckCircle,
  Globe,
  Package,
  Users,
  Link as LinkIcon,
  ShoppingCart,
  Mail,
  Phone,
  Info,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  useFeedSource,
  useFeedSourceSubscribe,
} from "@/hooks/use-feed-sources";
import { SubscribeFeedModal } from "../../_components/subscribe-feed-modal";
import { FeedCatalog } from "./feed-catalog";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
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

interface FeedSourceDetailClientProps {
  feedId: string;
}

export function FeedSourceDetailClient({
  feedId,
}: FeedSourceDetailClientProps) {
  const router = useRouter();
  const { feedSource, subscription, isLoading, error, refresh } =
    useFeedSource(feedId);
  const { unsubscribe } = useFeedSourceSubscribe();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Alert Skeleton */}
        <Skeleton className="h-12 w-full rounded-lg" />

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
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="flex gap-6 pt-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !feedSource) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load feed</p>
        <p className="text-sm text-muted-foreground">
          {error?.message || "Feed not found"}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/feeds")}
        >
          Back to Feeds
        </Button>
      </div>
    );
  }

  const initials = feedSource.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleUnsubscribe = async () => {
    if (!confirm("Are you sure you want to unsubscribe from this feed?")) {
      return;
    }

    try {
      setIsUnsubscribing(true);
      await unsubscribe(feedId);
      refresh();
    } catch {
      // Error handled by hook
    } finally {
      setIsUnsubscribing(false);
    }
  };

  const handleSubscribeSuccess = () => {
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Feed Library indicator */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This is a Feed Library source. Products are synced from their
          feed. Orders must be placed directly with the source.
        </AlertDescription>
      </Alert>

      {/* Feed Header */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main profile */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={feedSource.logoUrl || undefined}
                    alt={feedSource.name}
                    className="object-contain object-center"
                  />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl">{feedSource.name}</CardTitle>
                      {feedSource.website && (
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Globe className="h-3 w-3" />
                          <a
                            href={feedSource.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {feedSource.website
                              .replace(/^https?:\/\//, "")
                              .replace(/\/$/, "")}
                            <ExternalLink className="h-3 w-3 inline ml-1" />
                          </a>
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {subscription?.isActive ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Subscribed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <LinkIcon className="h-3 w-3" />
                          Feed Library
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedSource.description ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p>{feedSource.description}</p>
                </div>
              ) : (
                <p className="text-muted-foreground italic">
                  No description available
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2">
                <div className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  <span>{feedSource.productCount.toLocaleString()} products</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{feedSource.subscriptionCount} subscribers</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Subscription & Ordering */}
        <div className="space-y-6">
          {/* Subscription Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscription Status</CardTitle>
            </CardHeader>
            <CardContent>
              {subscription?.isActive ? (
                <div className="text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 mx-auto">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Subscribed</p>
                    <p className="text-sm text-muted-foreground">
                      Subscribed on{" "}
                      {new Date(subscription.verifiedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleUnsubscribe}
                    disabled={isUnsubscribing}
                  >
                    {isUnsubscribing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Unsubscribing...
                      </>
                    ) : (
                      "Unsubscribe"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Subscribe to this feed to browse their products.
                  </p>
                  <Button
                    onClick={() => setShowSubscribeModal(true)}
                    className="w-full"
                  >
                    Subscribe to Feed
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ordering Information */}
          {subscription?.isActive && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  How to Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Orders for this feed must be placed directly on their
                    platform.
                  </AlertDescription>
                </Alert>

                {feedSource.orderingUrl && (
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={feedSource.orderingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Ordering Portal
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}

                {feedSource.orderingInstructions && (
                  <p className="text-sm text-muted-foreground">
                    {feedSource.orderingInstructions}
                  </p>
                )}

                {(feedSource.orderingEmail || feedSource.orderingPhone) && (
                  <div className="space-y-2 text-sm">
                    {feedSource.orderingEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`mailto:${feedSource.orderingEmail}`}
                          className="hover:underline"
                        >
                          {feedSource.orderingEmail}
                        </a>
                      </div>
                    )}
                    {feedSource.orderingPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`tel:${feedSource.orderingPhone}`}
                          className="hover:underline"
                        >
                          {feedSource.orderingPhone}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs for Catalog */}
      {subscription?.isActive && (
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList>
            <TabsTrigger value="catalog" className="gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
          </TabsList>
          <TabsContent value="catalog" className="mt-6">
            <FeedCatalog feedId={feedId} />
          </TabsContent>
        </Tabs>
      )}

      {/* Subscribe Modal */}
      <SubscribeFeedModal
        feedSource={feedSource}
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        onSuccess={handleSubscribeSuccess}
      />
    </div>
  );
}
