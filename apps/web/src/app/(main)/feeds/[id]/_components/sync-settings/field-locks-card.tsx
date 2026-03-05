"use client";

import { Lock, Info, RefreshCw, X } from "lucide-react";
import { DEFAULT_FIELD_LOCK_MAPPINGS } from "@/hooks/use-sync-settings";
import Link from "next/link";
import { useSyncSettingsContext } from "./context";
import { LOCKABLE_FIELD_LABELS, type LockableField } from "./types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Combobox } from "@workspace/ui/components/combobox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Switch } from "@workspace/ui/components/switch";

/**
 * Render the Field Locks settings card for managing per-feed field lock overrides.
 *
 * Displays controls to toggle using global vs. feed-specific field locks, enable/disable locks,
 * choose lock interpretation, refresh and select metafields for mappings, and edit per-field mappings.
 *
 * @returns A React element containing the Field Locks configuration UI
 */
export function FieldLocksCard() {
  const {
    fieldLocks,
    setFieldLocks,
    useFieldLocksOverride,
    setUseFieldLocksOverride,
    globalSyncSettings,
    selectedIntegrationId,
    metafieldOptions,
    isLoadingMetafields,
    fetchMetafieldDefinitions,
    getNamespaceFromFullKey,
    setIsDirty,
  } = useSyncSettingsContext();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Field Locks
              {useFieldLocksOverride && (
                <Badge variant="secondary" className="ml-2">Override</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Prevent specific fields from being updated during sync based on metafield values
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Override Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Override Global Settings</Label>
            <p className="text-sm text-muted-foreground">
              {useFieldLocksOverride
                ? "Using custom field locks for this feed"
                : "Using global field locks"}
              {!useFieldLocksOverride && (
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
            checked={useFieldLocksOverride}
            onCheckedChange={(checked) => {
              setUseFieldLocksOverride(checked);
              if (!checked) {
                setFieldLocks(globalSyncSettings?.fieldLocks || null);
              }
              setIsDirty(true);
            }}
          />
        </div>

        {/* Show global settings info when not overriding */}
        {!useFieldLocksOverride && globalSyncSettings?.fieldLocks?.enabled && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <strong>Global field locks active:</strong>{" "}
                <span className="text-muted-foreground">
                  {Object.values(globalSyncSettings.fieldLocks.mappings).filter(Boolean).length} fields configured
                </span>
              </div>
            </div>
          </div>
        )}

        {!useFieldLocksOverride && !globalSyncSettings?.fieldLocks?.enabled && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                No global field locks configured. All fields will be updated during sync.
              </div>
            </div>
          </div>
        )}

        {/* Only show editing when using override */}
        {useFieldLocksOverride && (
          <>
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label className="text-sm font-medium">Enable Field Locks</Label>
              <Switch
                checked={fieldLocks?.enabled ?? false}
                onCheckedChange={(checked) => {
                  setFieldLocks(
                    checked
                      ? {
                          enabled: true,
                          namespace: "custom",
                          mappings: DEFAULT_FIELD_LOCK_MAPPINGS,
                          lockInterpretation: "lockWhenTrue",
                        }
                      : null
                  );
                }}
              />
            </div>
          </>
        )}

        {useFieldLocksOverride && fieldLocks?.enabled && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Label>Lock Interpretation</Label>
                <Select
                  value={fieldLocks.lockInterpretation || "lockWhenTrue"}
                  onValueChange={(value: "lockWhenFalse" | "lockWhenTrue") => {
                    setFieldLocks((prev) =>
                      prev ? { ...prev, lockInterpretation: value } : null
                    );
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lockWhenTrue">
                      &quot;true&quot; = locked
                    </SelectItem>
                    <SelectItem value="lockWhenFalse">
                      &quot;false&quot; = locked
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedIntegrationId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMetafieldDefinitions()}
                  disabled={isLoadingMetafields}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isLoadingMetafields ? "animate-spin" : ""}`}
                  />
                  Refresh Metafields
                </Button>
              )}
            </div>

            <div className="rounded-lg border divide-y">
              {(Object.keys(DEFAULT_FIELD_LOCK_MAPPINGS) as LockableField[]).map(
                (field) => (
                  <div
                    key={field}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="min-w-[120px] text-sm font-medium">
                      {LOCKABLE_FIELD_LABELS[field]}
                    </span>
                    <span className="text-muted-foreground">&rarr;</span>
                    {selectedIntegrationId && isLoadingMetafields ? (
                      <Skeleton className="h-9 flex-1" />
                    ) : selectedIntegrationId && metafieldOptions.length > 0 ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Combobox
                          options={metafieldOptions}
                          value={fieldLocks.mappings[field] || ""}
                          onValueChange={(value) => {
                            const namespace = getNamespaceFromFullKey(value);
                            setFieldLocks((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    namespace: namespace || prev.namespace,
                                    mappings: {
                                      ...prev.mappings,
                                      [field]: value,
                                    },
                                  }
                                : null
                            );
                          }}
                          placeholder="Select metafield..."
                          searchPlaceholder="Search metafields..."
                          emptyMessage="No metafields found"
                          allowCustomValue
                          className="flex-1"
                        />
                        {fieldLocks.mappings[field] && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              setFieldLocks((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      mappings: {
                                        ...prev.mappings,
                                        [field]: "",
                                      },
                                    }
                                  : null
                              );
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Input
                        value={fieldLocks.mappings[field] || ""}
                        onChange={(e) => {
                          setFieldLocks((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  mappings: {
                                    ...prev.mappings,
                                    [field]: e.target.value,
                                  },
                                }
                              : null
                          );
                        }}
                        placeholder={`${fieldLocks.namespace}.${DEFAULT_FIELD_LOCK_MAPPINGS[field]}`}
                        className="flex-1"
                      />
                    )}
                  </div>
                )
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How it works</AlertTitle>
              <AlertDescription>
                If a product in your Shopify store has{" "}
                <code className="bg-muted px-1 rounded">
                  {fieldLocks.mappings.price || `${fieldLocks.namespace}.custom_price`} = &quot;{fieldLocks.lockInterpretation === "lockWhenTrue" ? "true" : "false"}&quot;
                </code>
                , the price field will not be updated during sync.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}