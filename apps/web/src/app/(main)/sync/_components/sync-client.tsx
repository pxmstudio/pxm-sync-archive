"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings2,
  Plus,
  RefreshCw,
  AlertCircle,
  Power,
} from "lucide-react";
import {
  useFieldMappings,
  type FieldMapping,
  type SyncExclusionRule,
  type SyncSettings,
  type FieldLockConfig,
} from "@/hooks/use-field-mappings";
import { FieldMappingsEditor } from "./field-mappings-editor";
import { ExclusionRulesEditor } from "./exclusion-rules-editor";
import { SyncSettingsEditor } from "./sync-settings-editor";
import { PricingMarginEditor } from "./pricing-margin-editor";
import { FieldLocksEditor } from "./field-locks-editor";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslation } from "@workspace/i18n";
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
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Switch } from "@workspace/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { ShopifyLogoIcon } from "@workspace/ui/icons/ShopifyLogoIcon";

/**
 * Renders the UI for configuring synchronization between the app and an e-commerce integration.
 *
 * Displays an upgrade prompt when the user lacks access, loading or error states while mappings load,
 * a prompt to connect integrations when none exist, and the full sync configuration interface for a
 * selected integration (including mappings, exclusion rules, sync settings, pricing margins, and field locks).
 *
 * @returns A React element that renders the appropriate sync configuration view or access/connection states.
 */
export function SyncClient() {
  const { t } = useTranslation("sync");

  const {
    availableIntegrations,
    sourceFields,
    shopifyFields,
    defaultMappings,
    currentMapping,
    currentIntegration,
    filterOptions,
    isLoading: isLoadingMappings,
    error,
    hasMappings,
    fetchFieldMappings,
    fetchIntegrationMappings,
    createFieldMappings,
    updateFieldMappings,
    resetToDefaults,
  } = useFieldMappings();

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("mappings");

  // Load data on mount
  useEffect(() => {
    fetchFieldMappings();
  }, [fetchFieldMappings]);

  // When integrations are loaded, select the first one with mappings or the first one
  useEffect(() => {
    if (availableIntegrations.length > 0 && !selectedIntegrationId) {
      const withMappings = availableIntegrations.find((i) => i.hasMappings);
      setSelectedIntegrationId(withMappings?.id || availableIntegrations[0]!.id);
    }
  }, [availableIntegrations, selectedIntegrationId]);

  // Load integration-specific mappings when selection changes
  useEffect(() => {
    if (selectedIntegrationId) {
      fetchIntegrationMappings(selectedIntegrationId);
    }
  }, [selectedIntegrationId, fetchIntegrationMappings]);

  const handleCreateMappings = useCallback(async () => {
    if (!selectedIntegrationId) return;

    setIsSaving(true);
    try {
      await createFieldMappings({
        integrationId: selectedIntegrationId,
      });
      // Refetch the integration-specific mappings to show the editor
      await fetchIntegrationMappings(selectedIntegrationId);
      toast.success(t("fieldMappings.createdSuccess"));
    } catch {
      toast.error(t("fieldMappings.savedError"));
    } finally {
      setIsSaving(false);
    }
  }, [selectedIntegrationId, createFieldMappings, fetchIntegrationMappings, t]);

  const handleSaveFieldMappings = useCallback(
    async (fieldMappings: FieldMapping[]) => {
      if (!selectedIntegrationId) return;

      setIsSaving(true);
      try {
        await updateFieldMappings(selectedIntegrationId, { fieldMappings });
        toast.success(t("fieldMappings.savedSuccess"));
      } catch {
        toast.error(t("fieldMappings.savedError"));
      } finally {
        setIsSaving(false);
      }
    },
    [selectedIntegrationId, updateFieldMappings, t]
  );

  const handleSaveExclusionRules = useCallback(
    async (exclusionRules: SyncExclusionRule[]) => {
      if (!selectedIntegrationId) return;

      setIsSaving(true);
      try {
        await updateFieldMappings(selectedIntegrationId, { exclusionRules });
        toast.success(t("exclusionRules.savedSuccess"));
      } catch {
        toast.error(t("exclusionRules.savedError"));
      } finally {
        setIsSaving(false);
      }
    },
    [selectedIntegrationId, updateFieldMappings, t]
  );

  const handleSaveSyncSettings = useCallback(
    async (syncSettings: Partial<SyncSettings>) => {
      if (!selectedIntegrationId) return;

      setIsSaving(true);
      try {
        await updateFieldMappings(selectedIntegrationId, { syncSettings });
        toast.success(t("syncSettings.savedSuccess"));
      } catch {
        toast.error(t("syncSettings.savedError"));
      } finally {
        setIsSaving(false);
      }
    },
    [selectedIntegrationId, updateFieldMappings, t]
  );

  const handleSaveFieldLocks = useCallback(
    async (fieldLocks: FieldLockConfig | null) => {
      if (!selectedIntegrationId) return;

      setIsSaving(true);
      try {
        await updateFieldMappings(selectedIntegrationId, {
          syncSettings: { fieldLocks },
        });
        toast.success(t("fieldLocks.savedSuccess"));
      } catch {
        toast.error(t("fieldLocks.savedError"));
      } finally {
        setIsSaving(false);
      }
    },
    [selectedIntegrationId, updateFieldMappings, t]
  );

  const handleResetToDefaults = useCallback(async () => {
    if (!selectedIntegrationId) return;

    setIsSaving(true);
    try {
      await resetToDefaults(selectedIntegrationId);
      toast.success(t("fieldMappings.resetSuccess"));
    } catch {
      toast.error(t("fieldMappings.resetError"));
    } finally {
      setIsSaving(false);
    }
  }, [selectedIntegrationId, resetToDefaults, t]);

  const handleToggleSyncEnabled = useCallback(
    async (enabled: boolean) => {
      if (!selectedIntegrationId) return;

      setIsSaving(true);
      try {
        await updateFieldMappings(selectedIntegrationId, {
          syncSettings: { syncEnabled: enabled },
        });
        toast.success(
          enabled ? t("syncSettings.syncEnabled") : t("syncSettings.syncDisabled")
        );
      } catch {
        toast.error(t("syncSettings.savedError"));
      } finally {
        setIsSaving(false);
      }
    },
    [selectedIntegrationId, updateFieldMappings, t]
  );

  // Show skeleton while loading - either initial load or loading integration-specific mappings
  if (isLoadingMappings) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("error.title")}</AlertTitle>
        <AlertDescription>
          {t("error.failedToLoad")}{" "}
          <button onClick={fetchFieldMappings} className="underline">
            {t("error.tryAgain")}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  // No integrations connected
  if (availableIntegrations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">{t("integrations.noIntegrations")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("configuration.subtitle")}
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShopifyLogoIcon className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">{t("integrations.connectStoreFirst")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("integrations.noIntegrationsDescription")}
            </p>
            <Button asChild className="mt-4">
              <Link href="/settings/integrations">
                <Settings2 className="mr-2 h-4 w-4" />
                {t("integrations.goToIntegrations")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("configuration.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("configuration.subtitle")}
          </p>
        </div>
      </div>

      {/* Configuration area */}
      {selectedIntegrationId && (
        <div className="space-y-4">
          {!hasMappings ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Settings2 className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-semibold">{t("configuration.configure")}</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {t("configuration.configureDescription")}
                </p>
                <Button
                  className="mt-4"
                  onClick={handleCreateMappings}
                  disabled={isSaving}
                >
                  {isSaving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  {t("configuration.createWithDefaults")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Master sync toggle */}
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Power className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor="sync-enabled" className="text-sm font-medium cursor-pointer">
                          {t("syncSettings.enableSync")}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t("syncSettings.enableSyncDescription")}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="sync-enabled"
                      checked={currentMapping?.syncSettings?.syncEnabled ?? false}
                      onCheckedChange={handleToggleSyncEnabled}
                      disabled={isSaving}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Header with integration info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#96bf48]/10">
                        <ShopifyLogoIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {currentIntegration?.name}
                        </CardTitle>
                        <CardDescription>
                          {currentIntegration?.externalIdentifier}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetToDefaults}
                      disabled={isSaving}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t("configuration.resetToDefaults")}
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Tabs for different configuration sections */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="mappings">{t("tabs.mappings")}</TabsTrigger>
                  <TabsTrigger value="rules">{t("tabs.rules")}</TabsTrigger>
                  <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
                  <TabsTrigger value="pricing">{t("tabs.pricing")}</TabsTrigger>
                  <TabsTrigger value="locks">{t("tabs.locks")}</TabsTrigger>
                </TabsList>

                <TabsContent value="mappings" className="mt-4">
                  <FieldMappingsEditor
                    fieldMappings={currentMapping?.fieldMappings || []}
                    sourceFields={sourceFields}
                    shopifyFields={shopifyFields}
                    defaultMappings={defaultMappings}
                    onSave={handleSaveFieldMappings}
                    isSaving={isSaving}
                  />
                </TabsContent>

                <TabsContent value="rules" className="mt-4">
                  <ExclusionRulesEditor
                    exclusionRules={currentMapping?.exclusionRules || []}
                    filterOptions={filterOptions}
                    onSave={handleSaveExclusionRules}
                    isSaving={isSaving}
                  />
                </TabsContent>

                <TabsContent value="settings" className="mt-4">
                  <SyncSettingsEditor
                    syncSettings={currentMapping?.syncSettings}
                    onSave={handleSaveSyncSettings}
                    isSaving={isSaving}
                  />
                </TabsContent>

                <TabsContent value="pricing" className="mt-4">
                  <PricingMarginEditor filterOptions={filterOptions} />
                </TabsContent>

                <TabsContent value="locks" className="mt-4">
                  <FieldLocksEditor
                    fieldLocks={currentMapping?.syncSettings?.fieldLocks}
                    onSave={handleSaveFieldLocks}
                    isSaving={isSaving}
                    integrationId={selectedIntegrationId ?? undefined}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      )}

    </div>
  );
}