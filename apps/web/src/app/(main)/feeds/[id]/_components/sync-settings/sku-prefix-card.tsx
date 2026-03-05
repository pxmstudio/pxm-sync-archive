"use client";

import { Tag, Info } from "lucide-react";
import Link from "next/link";
import { useSyncSettingsContext } from "./context";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";

/**
 * Render a settings card that lets the user view and configure a per-feed SKU prefix and toggle whether to override the global SKU prefix.
 *
 * Shows the current global prefix when not overriding (or a notice if none is configured), provides a switch to enable a feed-level override, and — when overriding — an input to edit the prefix with a live example. Toggling or editing updates the synchronization settings context and marks the settings as dirty.
 *
 * @returns A Card element containing controls and informational UI for managing the SKU prefix and override state.
 */
export function SkuPrefixCard() {
  const {
    skuPrefix,
    setSkuPrefix,
    useSkuPrefixOverride,
    setUseSkuPrefixOverride,
    globalSyncSettings,
    setIsDirty,
  } = useSyncSettingsContext();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              SKU Prefix
              {useSkuPrefixOverride && (
                <Badge variant="secondary" className="ml-2">Override</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Add a prefix to all SKUs when syncing products to your store
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Override Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Override Global Settings</Label>
            <p className="text-sm text-muted-foreground">
              {useSkuPrefixOverride
                ? "Using custom SKU prefix for this feed"
                : "Using global SKU prefix"}
              {!useSkuPrefixOverride && (
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
            checked={useSkuPrefixOverride}
            onCheckedChange={(checked) => {
              setUseSkuPrefixOverride(checked);
              if (!checked) {
                setSkuPrefix(globalSyncSettings?.skuPrefix || "");
              }
              setIsDirty(true);
            }}
          />
        </div>

        {/* Show global settings info when not overriding */}
        {!useSkuPrefixOverride && globalSyncSettings?.skuPrefix && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <strong>Global prefix:</strong>{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded">{globalSyncSettings.skuPrefix}</code>
                <span className="text-muted-foreground ml-2">
                  (ABC123 → {globalSyncSettings.skuPrefix}ABC123)
                </span>
              </div>
            </div>
          </div>
        )}

        {!useSkuPrefixOverride && !globalSyncSettings?.skuPrefix && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                No global SKU prefix configured. SKUs will sync as-is.
              </div>
            </div>
          </div>
        )}

        {/* Only show editing when using override */}
        {useSkuPrefixOverride && (
          <div className="space-y-2">
            <Label htmlFor="sku-prefix">Prefix</Label>
            <div className="flex items-center gap-3">
              <Input
                id="sku-prefix"
                value={skuPrefix}
                onChange={(e) => setSkuPrefix(e.target.value)}
                placeholder="e.g., GGB-"
                className="max-w-xs"
                maxLength={20}
              />
              {skuPrefix && (
                <span className="text-sm text-muted-foreground">
                  Example: <code className="bg-muted px-1.5 py-0.5 rounded">ABC123</code> →{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">{skuPrefix}ABC123</code>
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Leave empty to keep original SKUs. Max 20 characters.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}