"use client";

import { useState } from "react";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import {
  useActivity,
  useActivityFilters,
  useActivityDetail,
  type SyncRun,
} from "@/hooks/use-activity";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

function StatusBadge({ status }: { status: SyncRun["status"] }) {
  const { t } = useTranslation("activity");

  const config = {
    pending: {
      icon: Clock,
      variant: "secondary" as const,
      iconClassName: "",
    },
    running: {
      icon: RefreshCw,
      variant: "info" as const,
      iconClassName: "animate-spin",
    },
    completed: {
      icon: CheckCircle2,
      variant: "success" as const,
      iconClassName: "",
    },
    failed: {
      icon: XCircle,
      variant: "error" as const,
      iconClassName: "",
    },
    partial: {
      icon: AlertTriangle,
      variant: "warning" as const,
      iconClassName: "",
    },
  };

  const { icon: Icon, variant, iconClassName } = config[status];

  return (
    <Badge variant={variant}>
      <Icon className={`h-3 w-3 ${iconClassName}`} />
      {t(`statuses.${status}`)}
    </Badge>
  );
}

function ProductCounts({
  created,
  updated,
  skipped,
  failed,
}: {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}) {
  const parts = [];

  if (created > 0) {
    parts.push(
      <span key="created" className="text-emerald-600 dark:text-emerald-400">
        +{created}
      </span>
    );
  }
  if (updated > 0) {
    parts.push(
      <span key="updated" className="text-primary">
        ~{updated}
      </span>
    );
  }
  if (failed > 0) {
    parts.push(
      <span key="failed" className="text-red-600 dark:text-red-400">
        ✗{failed}
      </span>
    );
  }
  if (skipped > 0) {
    parts.push(
      <span key="skipped" className="text-muted-foreground">
        ({skipped} skipped)
      </span>
    );
  }

  if (parts.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return <div className="flex items-center gap-2 text-sm">{parts}</div>;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "—";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Render a slide-over sheet that displays detailed information for a sync run.
 *
 * Shows status, timing, summary metrics, change breakdown, and errors for the specified run.
 *
 * @param runId - The ID of the run to display details for, or `null` to show no run.
 * @param open - Whether the sheet is open and visible.
 * @param onOpenChange - Callback invoked with the new open state when the sheet is opened or closed.
 * @returns The rendered detail sheet element for the given sync run.
 */
function ActivityDetailSheet({
  runId,
  open,
  onOpenChange,
}: {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("activity");
  const { run, isLoading, error } = useActivityDetail(open ? runId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto px-6">
        <SheetHeader>
          <SheetTitle>{t("detail.title")}</SheetTitle>
          <SheetDescription>
            {run?.feed.name} → {run?.integration.name}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("error.failedToLoad")}</AlertTitle>
          </Alert>
        )}

        {run && !isLoading && (
          <div className="space-y-6 mt-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={run.status} />
            </div>

            {/* Sync type */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("detail.syncType")}</span>
              <span className="text-sm font-medium capitalize">{run.syncType}</span>
            </div>

            {/* Triggered by */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("detail.triggeredBy")}</span>
              <span className="text-sm font-medium capitalize">{run.triggeredBy}</span>
            </div>

            {/* Timing */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("detail.startedAt")}</span>
                <span className="text-sm">
                  {run.startedAt
                    ? new Date(run.startedAt).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("detail.completedAt")}</span>
                <span className="text-sm">
                  {run.completedAt
                    ? new Date(run.completedAt).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("detail.duration")}</span>
                <span className="text-sm font-mono">{formatDuration(run.duration)}</span>
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">{t("detail.summary")}</h4>
              <div className="grid grid-cols-2 gap-3">
                <Card variant="flat">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                      {run.productsCreated}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("products.created")}</div>
                  </CardContent>
                </Card>
                <Card variant="flat">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-semibold text-primary">
                      {run.productsUpdated}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("products.updated")}</div>
                  </CardContent>
                </Card>
                <Card variant="flat">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-semibold text-muted-foreground">
                      {run.productsSkipped}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("products.skipped")}</div>
                  </CardContent>
                </Card>
                <Card variant="flat">
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
                      {run.productsFailed}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("products.failed")}</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Change Breakdown */}
            {run.changeBreakdown && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Change Breakdown</h4>
                <div className="flex flex-wrap gap-2">
                  {run.changeBreakdown.new > 0 && (
                    <Badge variant="secondary">
                      {run.changeBreakdown.new} new
                    </Badge>
                  )}
                  {run.changeBreakdown.full > 0 && (
                    <Badge variant="secondary">
                      {run.changeBreakdown.full} full updates
                    </Badge>
                  )}
                  {run.changeBreakdown.price > 0 && (
                    <Badge variant="outline">
                      {run.changeBreakdown.price} price changes
                    </Badge>
                  )}
                  {run.changeBreakdown.inventory > 0 && (
                    <Badge variant="outline">
                      {run.changeBreakdown.inventory} inventory
                      {run.changeBreakdown.inventoryFastPath && run.changeBreakdown.inventoryFastPath > 0 && (
                        <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                          ({run.changeBreakdown.inventoryFastPath} fast)
                        </span>
                      )}
                    </Badge>
                  )}
                  {run.changeBreakdown.unchanged > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {run.changeBreakdown.unchanged} unchanged
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Errors */}
            {run.errors && run.errors.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3 text-red-600 dark:text-red-400">
                  {t("detail.errors")} ({run.errors.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {run.errors.map((error, index) => (
                    <Card key={index} variant="flat" className="bg-red-500/10 dark:bg-red-500/15">
                      <CardContent className="p-3">
                        <div className="text-sm font-medium text-red-700 dark:text-red-300">
                          {error.productName || error.sku || `Product ${index + 1}`}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {error.message}
                        </div>
                        {error.code && (
                          <div className="text-xs text-red-500/70 dark:text-red-400/70 mt-1 font-mono">
                            {error.code}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Error message if no detailed errors */}
            {run.errorMessage && (!run.errors || run.errors.length === 0) && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3 text-red-600">{t("detail.errors")}</h4>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{run.errorMessage}</AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Renders the Activity view allowing users to filter, browse, and inspect sync runs.
 *
 * Displays a header with refresh, filter controls for feed/store/status, a table of runs (or an empty state),
 * pagination controls, and a per-run detail sheet. If the user lacks subscription access an upgrade prompt is shown;
 * if loading fails an error alert with retry is displayed.
 *
 * @returns The Activity client UI as a React element.
 */
export function ActivityClient() {
  const { t } = useTranslation("activity");

  const [page, setPage] = useState(1);
  const [feedId, setFeedId] = useState<string | undefined>();
  const [integrationId, setIntegrationId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { runs, pagination, isLoading, error, refresh } = useActivity({
    page,
    limit: 20,
    feedId,
    integrationId,
    status,
  });

  const { filters } = useActivityFilters();

  const handleViewDetails = (runId: string) => {
    setSelectedRunId(runId);
    setDetailOpen(true);
  };

  // Loading state while fetching initial data
  if (isLoading && runs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("error.failedToLoad")}</AlertTitle>
        <AlertDescription>
          <button onClick={refresh} className="underline">
            {t("error.tryAgain")}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {t("actions.refresh")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={feedId || "all"}
          onValueChange={(v) => {
            setFeedId(v === "all" ? undefined : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filters.allFeeds")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allFeeds")}</SelectItem>
            {filters.feeds.map((feed) => (
              <SelectItem key={feed.id} value={feed.id}>
                {feed.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={integrationId || "all"}
          onValueChange={(v) => {
            setIntegrationId(v === "all" ? undefined : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filters.allStores")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStores")}</SelectItem>
            {filters.integrations.map((integration) => (
              <SelectItem key={integration.id} value={integration.id}>
                {integration.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? undefined : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filters.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
            {filters.statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table or empty state */}
      {runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">{t("noActivity")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("noActivityDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.time")}</TableHead>
                  <TableHead>{t("columns.feed")}</TableHead>
                  <TableHead>{t("columns.store")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.products")}</TableHead>
                  <TableHead>{t("columns.duration")}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {formatRelativeTime(run.startedAt)}
                    </TableCell>
                    <TableCell>{run.feed.name}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{run.integration.name}</div>
                        {run.integration.shopDomain && (
                          <div className="text-xs text-muted-foreground">
                            {run.integration.shopDomain}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      <ProductCounts
                        created={run.productsCreated}
                        updated={run.productsUpdated}
                        skipped={run.productsSkipped}
                        failed={run.productsFailed}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(run.duration)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(run.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t("actions.viewDetails")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("pagination.showing")} {(page - 1) * pagination.limit + 1}{" "}
                {t("pagination.to")}{" "}
                {Math.min(page * pagination.limit, pagination.total)}{" "}
                {t("pagination.of")} {pagination.total} {t("pagination.runs")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("pagination.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  {t("pagination.next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail sheet */}
      <ActivityDetailSheet
        runId={selectedRunId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}