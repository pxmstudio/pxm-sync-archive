"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"
import Link from "next/link"
import { apiClient, ApiError } from "@/lib/api"
import {
  Store,
  Package,
  ArrowRight,
  RefreshCw,
  Rss,
  Link2,
  CheckCircle2,
} from "lucide-react"
import { useTranslation } from "@workspace/i18n"
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
import { ShopifyLogoIcon } from "@workspace/ui/icons/ShopifyLogoIcon";

interface DashboardStats {
  connectedFeeds: number
  totalProducts: number
  activeIntegrations: number
}

interface Feed {
  id: string
  name: string
  logoUrl: string | null
  status: "pending" | "mapping" | "active" | "paused" | "deprecated"
  productCount?: number
}

interface Integration {
  id: string
  provider: string
  name: string
  isActive: string
  externalIdentifier: string | null
}

const FEED_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  mapping: "secondary",
  active: "default",
  paused: "outline",
  deprecated: "destructive",
}

export function DashboardClient() {
  const { t } = useTranslation("dashboard")
  const { getToken } = useAuth()
  const { redirectToSignIn } = useClerk()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const token = await getToken()
      if (!token) {
        redirectToSignIn()
        return
      }

      // Fetch feeds (subscribed only)
      let feedsData: Feed[] = []
      let feedsTotal = 0
      let productsTotal = 0
      try {
        // Fetch all feeds to get accurate product count
        const allFeedsResponse = await apiClient<{ items: Feed[], pagination: { total: number } }>(
          "/internal/feeds/subscribed?limit=100",
          { token }
        )
        const allFeeds = allFeedsResponse.items || []
        feedsTotal = allFeedsResponse.pagination?.total || allFeeds.length
        // Sum product counts from all subscribed feeds
        productsTotal = allFeeds.reduce((sum, feed) => sum + (feed.productCount || 0), 0)
        // Only display first 6 feeds
        feedsData = allFeeds.slice(0, 6)
      } catch {
        // Feeds endpoint might not exist yet
        feedsData = []
      }
      setFeeds(feedsData)

      // Fetch integrations
      let integrationsData: Integration[] = []
      let activeIntegrations = 0
      try {
        integrationsData = await apiClient<Integration[]>(
          "/internal/integrations",
          { token }
        )
        activeIntegrations = integrationsData.filter(i => i.isActive === "true").length
      } catch {
        integrationsData = []
      }
      setIntegrations(integrationsData.filter(i => i.isActive === "true"))

      setStats({
        connectedFeeds: feedsTotal,
        totalProducts: productsTotal,
        activeIntegrations,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedToLoad"))
    } finally {
      setIsLoading(false)
    }
  }, [getToken, redirectToSignIn, t])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("tryAgain")}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("connectedFeeds")}</CardTitle>
            <Rss className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.connectedFeeds || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t("productSources")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("totalProducts")}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.totalProducts || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t("availableToSync")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("integrations")}</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.activeIntegrations || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t("connectedStores")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connected Feeds */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("yourFeeds")}</CardTitle>
                <CardDescription>{t("subscribedProductSources")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/feeds">
                  {t("viewAll")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {feeds.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                <Rss className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">{t("noFeedsConnected")}</p>
                <Button variant="link" size="sm" asChild className="mt-1">
                  <Link href="/feeds">{t("browseFeeds")}</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {feeds.map((feed) => (
                  <Link
                    key={feed.id}
                    href={`/feeds/${feed.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      {feed.logoUrl ? (
                        <img
                          src={feed.logoUrl}
                          alt={feed.name}
                          className="h-8 w-8 rounded object-contain"
                        />
                      ) : (
                        <Store className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{feed.name}</p>
                      <Badge variant={FEED_STATUS_VARIANTS[feed.status] || "secondary"} className="mt-1">
                        {feed.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("yourIntegrations")}</CardTitle>
                <CardDescription>{t("connectedStoreAccounts")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings/integrations">
                  {t("manage")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {integrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                <Link2 className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">{t("noIntegrationsConnected")}</p>
                <Button variant="link" size="sm" asChild className="mt-1">
                  <Link href="/settings/integrations">{t("connectStore")}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#96bf48]/10">
                      <ShopifyLogoIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{integration.name || integration.provider}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {integration.externalIdentifier}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("getStarted")}</CardTitle>
          <CardDescription>{t("quickActionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/feeds"
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Rss className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t("browseFeeds")}</p>
                <p className="text-sm text-muted-foreground">{t("findProductSources")}</p>
              </div>
            </Link>

            <Link
              href="/shop"
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t("browseProducts")}</p>
                <p className="text-sm text-muted-foreground">{t("viewAvailableProducts")}</p>
              </div>
            </Link>

            <Link
              href="/sync"
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t("syncSettings")}</p>
                <p className="text-sm text-muted-foreground">{t("configureStoreSync")}</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
