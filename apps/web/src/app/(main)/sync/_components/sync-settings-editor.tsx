"use client";

import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Info, Globe } from "lucide-react";
import type { SyncSettings, DefaultPublications, DefaultPublicationMode } from "@/hooks/use-field-mappings";
import { useGlobalSyncSettings, type ShopifyPublication } from "@/hooks/use-global-sync-settings";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
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

interface SyncSettingsEditorProps {
  syncSettings?: SyncSettings;
  onSave: (settings: Partial<SyncSettings>) => Promise<void>;
  isSaving: boolean;
}

const DEFAULT_SETTINGS: SyncSettings = {
  syncEnabled: false,
  syncImages: true,
  syncInventory: true,
  createNewProducts: true,
  deleteRemovedProducts: false,
  defaultStatus: "draft",
  publishToChannels: false,
  defaultPublications: null,
  skuPrefix: "",
  defaultVendor: "",
};

export function SyncSettingsEditor({
  syncSettings,
  onSave,
  isSaving,
}: SyncSettingsEditorProps) {
  const { t } = useTranslation("sync");
  const [localSettings, setLocalSettings] = useState<SyncSettings>(
    syncSettings || DEFAULT_SETTINGS
  );
  const [isDirty, setIsDirty] = useState(false);

  // Fetch available publications
  const {
    availablePublications,
    isLoadingPublications,
    fetchAvailablePublications,
  } = useGlobalSyncSettings();

  // Derive current publication mode
  const publicationMode: DefaultPublicationMode = localSettings.defaultPublications?.mode
    || (localSettings.publishToChannels ? "all" : "none");

  // Auto-fetch publications when "selected" mode is chosen and no publications loaded yet
  useEffect(() => {
    if (publicationMode === "selected" && availablePublications.length === 0 && !isLoadingPublications) {
      fetchAvailablePublications();
    }
  }, [publicationMode, availablePublications.length, isLoadingPublications, fetchAvailablePublications]);

  // Reset local state when prop changes
  useEffect(() => {
    setLocalSettings(syncSettings || DEFAULT_SETTINGS);
    setIsDirty(false);
  }, [syncSettings]);

  const handleChange = useCallback(
    <K extends keyof SyncSettings>(key: K, value: SyncSettings[K]) => {
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    []
  );

  const handlePublicationModeChange = useCallback((mode: DefaultPublicationMode) => {
    setLocalSettings((prev) => ({
      ...prev,
      defaultPublications: {
        mode,
        publicationIds: prev.defaultPublications?.publicationIds || [],
      },
      // Also update legacy field for backward compatibility
      publishToChannels: mode !== "none",
    }));
    setIsDirty(true);
  }, []);

  const handlePublicationToggle = useCallback((publicationId: string, checked: boolean) => {
    setLocalSettings((prev) => {
      const currentIds = prev.defaultPublications?.publicationIds || [];
      const newIds = checked
        ? [...currentIds, publicationId]
        : currentIds.filter((id) => id !== publicationId);
      return {
        ...prev,
        defaultPublications: {
          mode: prev.defaultPublications?.mode || "selected",
          publicationIds: newIds,
        },
      };
    });
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    await onSave(localSettings);
    setIsDirty(false);
  }, [localSettings, onSave]);

  return (
    <div className="space-y-6">
      <TooltipProvider>
        {/* Product Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("syncSettings.productBehavior.title")}</CardTitle>
            <CardDescription>
              {t("syncSettings.productBehavior.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create New Products */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>{t("syncSettings.productBehavior.createNew")}</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        {t("syncSettings.productBehavior.createNewTooltip")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("syncSettings.productBehavior.createNewDescription")}
                </p>
              </div>
              <Switch
                checked={localSettings.createNewProducts}
                onCheckedChange={(checked) =>
                  handleChange("createNewProducts", checked)
                }
              />
            </div>

            {/* Delete Removed Products */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>{t("syncSettings.productBehavior.deleteRemoved")}</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        {t("syncSettings.productBehavior.deleteRemovedTooltip")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("syncSettings.productBehavior.deleteRemovedDescription")}
                </p>
              </div>
              <Switch
                checked={localSettings.deleteRemovedProducts}
                onCheckedChange={(checked) =>
                  handleChange("deleteRemovedProducts", checked)
                }
              />
            </div>

            {/* Default Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>{t("syncSettings.productBehavior.defaultStatus")}</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        {t("syncSettings.productBehavior.defaultStatusTooltip")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("syncSettings.productBehavior.defaultStatusDescription")}
                </p>
              </div>
              <Select
                value={localSettings.defaultStatus}
                onValueChange={(value) =>
                  handleChange(
                    "defaultStatus",
                    value as SyncSettings["defaultStatus"]
                  )
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("syncSettings.productBehavior.statuses.active")}</SelectItem>
                  <SelectItem value="draft">{t("syncSettings.productBehavior.statuses.draft")}</SelectItem>
                  <SelectItem value="archived">{t("syncSettings.productBehavior.statuses.archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </CardContent>
        </Card>

        {/* Sales Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("syncSettings.salesChannels.title")}
            </CardTitle>
            <CardDescription>
              {t("syncSettings.salesChannels.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={publicationMode}
              onValueChange={(value) => handlePublicationModeChange(value as DefaultPublicationMode)}
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="all" id="pub-all" />
                <Label htmlFor="pub-all" className="flex-1 cursor-pointer">
                  <div className="font-medium">{t("syncSettings.salesChannels.allChannels")}</div>
                  <p className="text-sm text-muted-foreground">
                    {t("syncSettings.salesChannels.allChannelsDescription")}
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="selected" id="pub-selected" />
                <Label htmlFor="pub-selected" className="flex-1 cursor-pointer">
                  <div className="font-medium">{t("syncSettings.salesChannels.selectedChannels")}</div>
                  <p className="text-sm text-muted-foreground">
                    {t("syncSettings.salesChannels.selectedChannelsDescription")}
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="none" id="pub-none" />
                <Label htmlFor="pub-none" className="flex-1 cursor-pointer">
                  <div className="font-medium">{t("syncSettings.salesChannels.noChannels")}</div>
                  <p className="text-sm text-muted-foreground">
                    {t("syncSettings.salesChannels.noChannelsDescription")}
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {publicationMode === "selected" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label>{t("syncSettings.salesChannels.selectChannels")}</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchAvailablePublications()}
                    disabled={isLoadingPublications}
                  >
                    {isLoadingPublications ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">{t("syncSettings.salesChannels.refresh")}</span>
                  </Button>
                </div>
                {availablePublications.length === 0 ? (
                  <div className="text-center py-4">
                    {isLoadingPublications ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t("syncSettings.salesChannels.loading")}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("syncSettings.salesChannels.noChannelsFound")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availablePublications.map((pub) => (
                      <div
                        key={pub.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border"
                      >
                        <Checkbox
                          id={pub.id}
                          checked={localSettings.defaultPublications?.publicationIds?.includes(pub.id) ?? false}
                          onCheckedChange={(checked) => handlePublicationToggle(pub.id, checked as boolean)}
                        />
                        <Label htmlFor={pub.id} className="flex-1 cursor-pointer">
                          <div className="font-medium">{pub.name}</div>
                          {pub.handle && (
                            <p className="text-xs text-muted-foreground">{pub.handle}</p>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("syncSettings.dataSync.title")}</CardTitle>
            <CardDescription>
              {t("syncSettings.dataSync.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sync Images */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("syncSettings.dataSync.syncImages")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("syncSettings.dataSync.syncImagesDescription")}
                </p>
              </div>
              <Switch
                checked={localSettings.syncImages}
                onCheckedChange={(checked) => handleChange("syncImages", checked)}
              />
            </div>

            {/* Sync Inventory */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("syncSettings.dataSync.syncInventory")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("syncSettings.dataSync.syncInventoryDescription")}
                </p>
              </div>
              <Switch
                checked={localSettings.syncInventory}
                onCheckedChange={(checked) =>
                  handleChange("syncInventory", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Defaults & Prefixes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("syncSettings.defaults.title")}</CardTitle>
            <CardDescription>
              {t("syncSettings.defaults.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* SKU Prefix */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t("syncSettings.defaults.skuPrefix")}</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      {t("syncSettings.defaults.skuPrefixTooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={localSettings.skuPrefix || ""}
                onChange={(e) => handleChange("skuPrefix", e.target.value)}
                placeholder={t("syncSettings.defaults.skuPrefixPlaceholder")}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                {t("syncSettings.defaults.skuPrefixDescription")}
              </p>
            </div>

            {/* Default Vendor */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t("syncSettings.defaults.defaultVendor")}</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      {t("syncSettings.defaults.defaultVendorTooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                value={localSettings.defaultVendor || ""}
                onChange={(e) => handleChange("defaultVendor", e.target.value)}
                placeholder={t("syncSettings.defaults.defaultVendorPlaceholder")}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                {t("syncSettings.defaults.defaultVendorDescription")}
              </p>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Save button */}
      {isDirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {t("syncSettings.saveSyncSettings")}
          </Button>
        </div>
      )}
    </div>
  );
}
