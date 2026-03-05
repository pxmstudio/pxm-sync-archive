"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Play, CheckCircle2, Clock, ChevronDown, Layers, CircleDot, Archive, Loader2, Info } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useSyncSettingsContext } from "./context";
import type { ShopifyPublication, ProductStatus } from "./types";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

const STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

/**
 * Render the Product Sync card UI which manages auto-sync, default product status, target store selection, and bulk status changes for Shopify.
 *
 * This component integrates with the sync settings context to display and control auto-sync toggles, select a target store when applicable, override or show global default product status, trigger incremental or full syncs, and open a dialog to perform bulk status updates (including selecting sales channels when setting products to active). It handles loading and submission states, fetches publications for the selected integration when needed, and shows success/error toasts for bulk operations.
 *
 * @returns A React element containing the Product Sync card and its associated dialogs and controls.
 */
export function ProductSyncCard() {
  const {
    hasSettings,
    isSyncing,
    isSyncEnabled,
    syncEnabled,
    setSyncEnabled,
    selectedIntegrationId,
    setSelectedIntegrationId,
    availableIntegrations,
    defaultProductStatus,
    setDefaultProductStatus,
    useDefaultStatusOverride,
    setUseDefaultStatusOverride,
    globalSyncSettings,
    handleTriggerSync,
    changeBulkStatus,
    setIsDirty,
  } = useSyncSettingsContext();

  const { getToken } = useAuth();

  // Bulk status change dialog state
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<"active" | "draft" | "archived">("active");
  const [bulkStatusPublicationIds, setBulkStatusPublicationIds] = useState<string[]>([]);
  const [isLoadingBulkStatusPublications, setIsLoadingBulkStatusPublications] = useState(false);
  const [bulkStatusPublications, setBulkStatusPublications] = useState<ShopifyPublication[]>([]);
  const [isSubmittingBulkStatus, setIsSubmittingBulkStatus] = useState(false);

  // Access settings from context for display
  const ctx = useSyncSettingsContext();
  // We need to access the raw settings for display, but it's not exposed in context
  // For now we'll use what we have

  // Open bulk status dialog
  const openBulkStatusDialog = useCallback(async (status: "active" | "draft" | "archived") => {
    setBulkStatusTarget(status);
    setBulkStatusPublicationIds([]);
    setBulkStatusDialogOpen(true);

    if (status === "active" && selectedIntegrationId) {
      setIsLoadingBulkStatusPublications(true);
      try {
        const token = await getToken();
        if (!token) return;

        const response = await apiClient<{
          publications: ShopifyPublication[];
          integrationId: string;
        }>(`/internal/integrations/${selectedIntegrationId}/publications`, {
          token,
        });

        setBulkStatusPublications(response.publications);
      } catch (err) {
        console.error("Failed to fetch publications:", err);
      } finally {
        setIsLoadingBulkStatusPublications(false);
      }
    }
  }, [selectedIntegrationId, getToken]);

  // Confirm bulk status change
  const handleBulkStatusConfirm = useCallback(async () => {
    setIsSubmittingBulkStatus(true);
    try {
      const result = await changeBulkStatus(
        bulkStatusTarget,
        bulkStatusTarget === "active" ? bulkStatusPublicationIds : undefined
      );
      toast.success(`Changing all products to ${bulkStatusTarget}...`, {
        description: `Job ID: ${result.jobId}`,
      });
      setBulkStatusDialogOpen(false);
    } catch {
      toast.error("Failed to change product status");
    } finally {
      setIsSubmittingBulkStatus(false);
    }
  }, [changeBulkStatus, bulkStatusTarget, bulkStatusPublicationIds]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Product Sync</CardTitle>
              <CardDescription>
                Automatically push products to your Shopify store
              </CardDescription>
            </div>
            {hasSettings && (
              <div className="flex items-center gap-2">
                {/* Change Status Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSyncing || !isSyncEnabled}
                    >
                      <CircleDot className="h-4 w-4" />
                      Change Status
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openBulkStatusDialog("active")}>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Set All to Active
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openBulkStatusDialog("draft")}>
                      <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                      Set All to Draft
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openBulkStatusDialog("archived")}>
                      <Archive className="h-4 w-4 mr-2 text-muted-foreground" />
                      Set All to Archived
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sync Now Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSyncing || !isSyncEnabled}
                    >
                      {isSyncing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Sync Now
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleTriggerSync(false)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Changes
                      <span className="ml-auto text-xs text-muted-foreground">Incremental</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTriggerSync(true)}>
                      <Layers className="h-4 w-4 mr-2" />
                      Force Full Sync
                      <span className="ml-auto text-xs text-muted-foreground">Re-sync all</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Auto-Sync Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label htmlFor="sync-enabled" className="text-sm font-medium">Enable auto-sync</Label>
            <Switch
              id="sync-enabled"
              checked={syncEnabled}
              onCheckedChange={setSyncEnabled}
            />
          </div>

          {/* Target Store Selection */}
          {!hasSettings && availableIntegrations.length > 0 && (
            <div className="space-y-2">
              <Label>Target Store</Label>
              <Select
                value={selectedIntegrationId}
                onValueChange={setSelectedIntegrationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {integration.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Default Product Status */}
          <TooltipProvider>
            <div className="space-y-4 rounded-lg border p-4">
              {/* Override Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Default Product Status</Label>
                    {useDefaultStatusOverride && (
                      <Badge variant="secondary">Override</Badge>
                    )}
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Status for newly created products when syncing to Shopify</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {useDefaultStatusOverride
                      ? "Using custom status for this feed"
                      : "Using global status setting"}
                    {!useDefaultStatusOverride && (
                      <Link
                        href="/sync"
                        className="ml-1 text-primary hover:underline"
                      >
                        Edit global settings
                      </Link>
                    )}
                  </p>
                </div>
                <Switch
                  checked={useDefaultStatusOverride}
                  onCheckedChange={(checked) => {
                    setUseDefaultStatusOverride(checked);
                    if (!checked) {
                      setDefaultProductStatus(globalSyncSettings?.defaultStatus || "draft");
                    }
                    setIsDirty(true);
                  }}
                />
              </div>

              {/* Show global settings info when not overriding */}
              {!useDefaultStatusOverride && globalSyncSettings?.defaultStatus && (
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <strong>Global setting:</strong>{" "}
                      {STATUS_LABELS[globalSyncSettings.defaultStatus]}
                    </span>
                  </div>
                </div>
              )}

              {/* Status selector when using override */}
              {useDefaultStatusOverride && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Status for newly created products</Label>
                  <Select
                    value={defaultProductStatus}
                    onValueChange={(value: ProductStatus) => setDefaultProductStatus(value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Bulk Status Change Dialog */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Set All Products to {bulkStatusTarget.charAt(0).toUpperCase() + bulkStatusTarget.slice(1)}
            </DialogTitle>
            <DialogDescription>
              {bulkStatusTarget === "active" ? (
                "This will set all synced products to active status. Select which sales channels to publish them to."
              ) : bulkStatusTarget === "draft" ? (
                "This will set all synced products to draft status. They will be hidden from all sales channels."
              ) : (
                "This will archive all synced products. They will be hidden from all sales channels and can be restored later."
              )}
            </DialogDescription>
          </DialogHeader>

          {bulkStatusTarget === "active" && (
            <div className="space-y-3 py-4">
              <Label>Publish to Sales Channels</Label>
              {isLoadingBulkStatusPublications ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : bulkStatusPublications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales channels available.</p>
              ) : (
                <div className="space-y-2">
                  {bulkStatusPublications.map((pub) => (
                    <div
                      key={pub.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border"
                    >
                      <Checkbox
                        id={`bulk-${pub.id}`}
                        checked={bulkStatusPublicationIds.includes(pub.id)}
                        onCheckedChange={(checked) => {
                          setBulkStatusPublicationIds((prev) =>
                            checked
                              ? [...prev, pub.id]
                              : prev.filter((id) => id !== pub.id)
                          );
                        }}
                      />
                      <Label htmlFor={`bulk-${pub.id}`} className="flex-1 cursor-pointer">
                        {pub.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkStatusConfirm}
              disabled={isSubmittingBulkStatus || (bulkStatusTarget === "active" && bulkStatusPublicationIds.length === 0)}
            >
              {isSubmittingBulkStatus && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}