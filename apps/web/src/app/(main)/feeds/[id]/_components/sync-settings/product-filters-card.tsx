"use client";

import { useSyncSettingsContext } from "./context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { MultiSelect } from "@workspace/ui/components/multi-select";

/**
 * Render a "Product Filters" card with controls to select which products are synced.
 *
 * The card contains three MultiSelect controls for brands, product types, and tags.
 * User selections update the sync settings context's filter rules.
 *
 * @returns A React element containing the Product Filters card with MultiSelect controls for brands, product types, and tags.
 */
export function ProductFiltersCard() {
  const {
    filterRules,
    setFilterRules,
    filterOptions,
  } = useSyncSettingsContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Product Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Sync only these brands</Label>
            <MultiSelect
              options={filterOptions.brands.map((b) => ({ label: b, value: b }))}
              value={filterRules.brands || []}
              onValueChange={(values: string[]) => {
                setFilterRules({ ...filterRules, brands: values });
              }}
              placeholder="All brands"
            />
          </div>
          <div className="space-y-2">
            <Label>Sync only these product types</Label>
            <MultiSelect
              options={filterOptions.productTypes.map((t) => ({ label: t, value: t }))}
              value={filterRules.productTypes || []}
              onValueChange={(values: string[]) => {
                setFilterRules({ ...filterRules, productTypes: values });
              }}
              placeholder="All types"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Sync only products with these tags</Label>
          <MultiSelect
            options={filterOptions.tags.map((t) => ({ label: t, value: t }))}
            value={filterRules.tags || []}
            onValueChange={(values: string[]) => {
              setFilterRules({ ...filterRules, tags: values });
            }}
            placeholder="All tags"
          />
        </div>
      </CardContent>
    </Card>
  );
}