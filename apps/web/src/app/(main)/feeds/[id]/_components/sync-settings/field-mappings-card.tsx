"use client";

import { Plus, ArrowRight, Trash2, Layers } from "lucide-react";
import { useSyncSettingsContext } from "./context";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Combobox } from "@workspace/ui/components/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

/**
 * Render a card for configuring field mappings used when syncing product data to Shopify.
 *
 * Presents existing mapping rules and controls to add, edit, or remove mappings.
 * Each rule maps a source field/value (brand, product type, or tag) to a target field/value (vendor, product type, or tag)
 * with comboboxes that allow selecting or typing custom values and selects for choosing fields.
 *
 * @returns The Field Mappings card React element.
 */
export function FieldMappingsCard() {
  const {
    fieldMappings,
    addMappingRule,
    removeMappingRule,
    updateMappingRule,
    filterOptions,
    storeMetadata,
    isLoadingStoreMetadata,
  } = useSyncSettingsContext();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Field Mappings
          </CardTitle>
          <CardDescription>
            Transform field values when syncing to Shopify
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={addMappingRule}>
          <Plus className="h-4 w-4" />
          Add Mapping
        </Button>
      </CardHeader>
      <CardContent>
        {fieldMappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No field mappings. Values will sync as-is from the feed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {fieldMappings.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 p-3 rounded-lg border bg-card flex-wrap"
              >
                {/* Source: When [field] is [value] */}
                <span className="text-sm text-muted-foreground">When</span>
                <Select
                  value={rule.sourceField}
                  onValueChange={(value) =>
                    updateMappingRule(rule.id, {
                      sourceField: value as "brand" | "productType" | "tag",
                      sourceValue: "", // Reset value when field changes
                    })
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="productType">Product Type</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">is</span>
                <Combobox
                  options={
                    rule.sourceField === "brand"
                      ? filterOptions.brands.map((b) => ({ label: b, value: b }))
                      : rule.sourceField === "productType"
                      ? filterOptions.productTypes.map((t) => ({ label: t, value: t }))
                      : filterOptions.tags.map((t) => ({ label: t, value: t }))
                  }
                  value={rule.sourceValue}
                  onValueChange={(value) =>
                    updateMappingRule(rule.id, { sourceValue: value })
                  }
                  placeholder="Select or type..."
                  searchPlaceholder="Search or enter custom..."
                  emptyMessage="No matches. Type to add custom value."
                  allowCustomValue
                  className="w-[240px]"
                />

                <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />

                {/* Target: Set [field] to [value] */}
                <span className="text-sm text-muted-foreground">set</span>
                <Select
                  value={rule.targetField}
                  onValueChange={(value) =>
                    updateMappingRule(rule.id, {
                      targetField: value as "brand" | "productType" | "tag",
                    })
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand">Vendor</SelectItem>
                    <SelectItem value="productType">Product Type</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">to</span>
                <Combobox
                  options={
                    rule.targetField === "brand"
                      ? (storeMetadata?.vendors ?? []).map((v) => ({ label: v, value: v }))
                      : rule.targetField === "productType"
                      ? (storeMetadata?.productTypes ?? []).map((t) => ({ label: t, value: t }))
                      : (storeMetadata?.tags ?? []).map((t) => ({ label: t, value: t }))
                  }
                  value={rule.targetValue}
                  onValueChange={(value) =>
                    updateMappingRule(rule.id, { targetValue: value })
                  }
                  placeholder={isLoadingStoreMetadata ? "Loading..." : "Select or type..."}
                  searchPlaceholder="Search or enter custom..."
                  emptyMessage="No matches. Type to add custom value."
                  allowCustomValue
                  className="w-[240px]"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive ml-auto"
                  onClick={() => removeMappingRule(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}