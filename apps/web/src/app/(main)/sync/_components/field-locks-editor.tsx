"use client";

import { useState, useEffect, useMemo } from "react";
import { Lock, Info, RefreshCw, X, Loader2 } from "lucide-react";









import type { FieldLockConfig } from "@/hooks/use-field-mappings";
import { useMetafieldDefinitions } from "@/hooks/use-integrations";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
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
// Lockable fields and their default metafield keys
type LockableField =
  | "images"
  | "status"
  | "quantity"
  | "price"
  | "compareAtPrice"
  | "productType"
  | "description"
  | "title"
  | "vendor"
  | "tags";

const DEFAULT_FIELD_LOCK_MAPPINGS: Record<LockableField, string> = {
  images: "custom_images",
  status: "custom_status",
  quantity: "custom_quantity",
  price: "custom_price",
  compareAtPrice: "custom_compare_at_price",
  productType: "custom_product_type",
  description: "custom_description",
  title: "custom_title",
  vendor: "custom_vendor",
  tags: "custom_tags",
};

const LOCKABLE_FIELD_LABELS: Record<LockableField, string> = {
  images: "Images",
  status: "Status",
  quantity: "Quantity",
  price: "Price",
  compareAtPrice: "Compare At Price",
  productType: "Product Type",
  description: "Description",
  title: "Title",
  vendor: "Vendor",
  tags: "Tags",
};

interface FieldLocksEditorProps {
  fieldLocks: FieldLockConfig | null | undefined;
  onSave: (fieldLocks: FieldLockConfig | null) => Promise<void>;
  isSaving: boolean;
  integrationId?: string;
}

export function FieldLocksEditor({
  fieldLocks: initialFieldLocks,
  onSave,
  isSaving,
  integrationId,
}: FieldLocksEditorProps) {
  const [fieldLocks, setFieldLocks] = useState<FieldLockConfig | null>(
    initialFieldLocks ?? null
  );
  const [isDirty, setIsDirty] = useState(false);

  // Fetch metafield definitions from Shopify (all namespaces)
  const { definitions, isLoading: isLoadingDefinitions, fetchDefinitions } =
    useMetafieldDefinitions(integrationId);

  // Fetch definitions when enabled
  useEffect(() => {
    if (fieldLocks?.enabled && integrationId) {
      fetchDefinitions();
    }
  }, [fieldLocks?.enabled, integrationId, fetchDefinitions]);

  // Convert definitions to combobox options - only boolean metafields, use fullKey as value
  const metafieldOptions = useMemo(() => {
    return definitions
      .filter((def) => def.type === "boolean")
      .map((def) => ({
        value: def.fullKey, // namespace.key
        label: `${def.name} (${def.namespace})`,
      }));
  }, [definitions]);

  // Helper to extract namespace from fullKey (namespace.key)
  const getNamespaceFromFullKey = (fullKey: string) => {
    const parts = fullKey.split(".");
    return parts.length > 1 ? parts.slice(0, -1).join(".") : "";
  };

  // Helper to extract key from fullKey
  const getKeyFromFullKey = (fullKey: string) => {
    const parts = fullKey.split(".");
    return parts[parts.length - 1];
  };

  // Sync with parent when initialFieldLocks changes
  useEffect(() => {
    setFieldLocks(initialFieldLocks ?? null);
    setIsDirty(false);
  }, [initialFieldLocks]);

  const handleSave = async () => {
    await onSave(fieldLocks);
    setIsDirty(false);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Field Locks
        </CardTitle>
        <CardDescription>
          Prevent specific fields from being overwritten by checking Shopify metafields.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label className="text-base">Enable Field Locks</Label>
          <Switch
            checked={fieldLocks?.enabled ?? false}
            onCheckedChange={(checked) => {
              setFieldLocks(
                checked
                  ? {
                      enabled: true,
                      namespace: "custom",
                      mappings: {},
                      lockInterpretation: "lockWhenTrue",
                    }
                  : null
              );
              setIsDirty(true);
            }}
          />
        </div>

        {fieldLocks?.enabled && (
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
                    setIsDirty(true);
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
              {integrationId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDefinitions()}
                  disabled={isLoadingDefinitions}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isLoadingDefinitions ? "animate-spin" : ""}`}
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
                    {integrationId && isLoadingDefinitions ? (
                      <Skeleton className="h-9 flex-1" />
                    ) : integrationId && metafieldOptions.length > 0 ? (
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
                            setIsDirty(true);
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
                              setIsDirty(true);
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
                          setIsDirty(true);
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

    {/* Floating Save Button */}
    {isDirty && (
      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="shadow-lg">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Field Locks
        </Button>
      </div>
    )}
  </>
  );
}
