"use client";

import { Settings2, AlertCircle, Store, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { SyncSettingsProvider, useSyncSettingsContext } from "./context";
import { ProductSyncCard } from "./product-sync-card";
import { ProductFiltersCard } from "./product-filters-card";
import { ExclusionRulesCard } from "./exclusion-rules-card";
import { SkuPrefixCard } from "./sku-prefix-card";
import { SalesChannelsCard } from "./sales-channels-card";
import { FieldLocksCard } from "./field-locks-card";
import { FieldMappingsCard } from "./field-mappings-card";
import { PricingMarginCard } from "./pricing-margin-card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";

/**
 * Render the Sync Settings content area and its state-specific UI.
 *
 * Shows skeleton placeholders while loading, a destructive alert if an error occurred,
 * an informational alert when no integrations or settings exist, or the full set of
 * settings cards when configuration is available. When changes are dirty, displays a
 * sticky "Save Changes" button that invokes the provider's save handler and shows a
 * spinner while saving.
 *
 * @returns The rendered settings UI: skeletons when loading, an error alert on failure,
 * an integration-missing alert when there are no integrations or settings, or the
 * settings cards with an optional sticky Save Changes button when editable changes exist.
 */
function SyncSettingsContent() {
  const {
    isLoading,
    isSaving,
    isDirty,
    error,
    hasSettings,
    availableIntegrations,
    handleSave,
  } = useSyncSettingsContext();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading sync settings</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!hasSettings && availableIntegrations.length === 0) {
    return (
      <Alert>
        <Store className="h-4 w-4" />
        <AlertTitle>No Shopify integration found</AlertTitle>
        <AlertDescription>
          Connect a Shopify store in your integrations settings to enable product sync.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <ProductSyncCard />
      <ProductFiltersCard />
      <ExclusionRulesCard />
      <FieldMappingsCard />
      <SkuPrefixCard />
      <SalesChannelsCard />
      <FieldLocksCard />
      <PricingMarginCard />

      {/* Save Button */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="sticky bottom-4 flex justify-end"
          >
            <Button onClick={handleSave} disabled={isSaving} className="shadow-lg">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface SyncSettingsPanelProps {
  connectionId: string;
}

/**
 * Render the Sync Settings panel for a specific connection.
 *
 * @param connectionId - The ID of the connection whose sync settings will be loaded and managed
 * @returns The Sync Settings panel element containing the header and provider-wrapped settings content
 */
export function SyncSettingsPanel({ connectionId }: SyncSettingsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Settings2 className="h-5 w-5" />
          Sync Settings
        </div>
      </div>

      <SyncSettingsProvider connectionId={connectionId}>
        <SyncSettingsContent />
      </SyncSettingsProvider>
    </div>
  );
}