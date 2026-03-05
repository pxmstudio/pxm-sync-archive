"use client";

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  useSyncSettings,
  DEFAULT_FIELD_LOCK_MAPPINGS,
} from "@/hooks/use-sync-settings";
import { useGlobalSyncSettings, type GlobalSyncSettings } from "@/hooks/use-global-sync-settings";
import { useIntegrations, useMetafieldDefinitions, useStoreMetadata, type MetafieldDefinition, type StoreMetadata } from "@/hooks/use-integrations";
import { apiClient } from "@/lib/api";
import type {
  FieldMappingRule,
  FilterRules,
  PricingMargin,
  MarginRule,
  FieldLockConfig,
  PublicationOverride,
  ShopifyPublication,
  FilterOptions,
  ProductStatus,
  SyncExclusionRule,
} from "./types";
import { generateRuleId } from "./types";

interface SyncSettingsContextValue {
  // Connection info
  connectionId: string;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  isDirty: boolean;
  error: Error | null;

  // Settings state
  hasSettings: boolean;
  isSyncEnabled: boolean;
  syncEnabled: boolean;
  setSyncEnabled: (value: boolean) => void;
  selectedIntegrationId: string;
  setSelectedIntegrationId: (value: string) => void;

  // Filter rules
  filterRules: FilterRules;
  setFilterRules: (value: FilterRules | ((prev: FilterRules) => FilterRules)) => void;
  filterOptions: FilterOptions;

  // Field mappings
  fieldMappings: FieldMappingRule[];
  addMappingRule: () => void;
  removeMappingRule: (ruleId: string) => void;
  updateMappingRule: (ruleId: string, updates: Partial<FieldMappingRule>) => void;

  // SKU Prefix
  skuPrefix: string;
  setSkuPrefix: (value: string) => void;
  useSkuPrefixOverride: boolean;
  setUseSkuPrefixOverride: (value: boolean) => void;

  // Publications
  publicationOverride: PublicationOverride | null;
  setPublicationOverride: (value: PublicationOverride | null | ((prev: PublicationOverride | null) => PublicationOverride | null)) => void;
  usePublicationsOverride: boolean;
  setUsePublicationsOverride: (value: boolean) => void;
  availablePublications: ShopifyPublication[];
  isLoadingPublications: boolean;
  fetchPublications: () => Promise<void>;

  // Field locks
  fieldLocks: FieldLockConfig | null;
  setFieldLocks: (value: FieldLockConfig | null | ((prev: FieldLockConfig | null) => FieldLockConfig | null)) => void;
  useFieldLocksOverride: boolean;
  setUseFieldLocksOverride: (value: boolean) => void;
  metafieldDefinitions: MetafieldDefinition[];
  metafieldOptions: { value: string; label: string }[];
  isLoadingMetafields: boolean;
  fetchMetafieldDefinitions: () => void;
  getNamespaceFromFullKey: (fullKey: string) => string;

  // Pricing margin
  pricingMargin: PricingMargin;
  setPricingMargin: (value: PricingMargin | ((prev: PricingMargin) => PricingMargin)) => void;
  usePricingOverride: boolean;
  setUsePricingOverride: (value: boolean) => void;
  openMarginRules: Set<string>;
  addMarginRule: () => void;
  removeMarginRule: (ruleId: string) => void;
  updateMarginRule: (ruleId: string, updates: Partial<MarginRule>) => void;
  toggleMarginRuleOpen: (id: string) => void;

  // Default product status
  defaultProductStatus: ProductStatus;
  setDefaultProductStatus: (value: ProductStatus) => void;
  useDefaultStatusOverride: boolean;
  setUseDefaultStatusOverride: (value: boolean) => void;

  // Exclusion rules
  exclusionRules: SyncExclusionRule[];
  setExclusionRules: (value: SyncExclusionRule[] | ((prev: SyncExclusionRule[]) => SyncExclusionRule[])) => void;
  useExclusionRulesOverride: boolean;
  setUseExclusionRulesOverride: (value: boolean) => void;

  // Store metadata
  storeMetadata: StoreMetadata | null;
  isLoadingStoreMetadata: boolean;

  // Global settings
  globalSyncSettings: GlobalSyncSettings | null;

  // Available integrations
  availableIntegrations: { id: string; name: string; provider: string }[];
  activeShopifyIntegration: { id: string; name: string } | undefined;

  // Actions
  handleSave: () => Promise<void>;
  handleTriggerSync: (forceFullSync?: boolean) => Promise<void>;
  setIsDirty: (value: boolean) => void;

  // Bulk status change
  changeBulkStatus: (status: "active" | "draft" | "archived", publicationIds?: string[]) => Promise<{ jobId: string }>;
}

const SyncSettingsContext = createContext<SyncSettingsContextValue | null>(null);

/**
 * Accesses the current SyncSettingsContext value.
 *
 * @returns The `SyncSettingsContextValue` provided by the nearest `SyncSettingsProvider`.
 * @throws An `Error` if called outside of a `SyncSettingsProvider`.
 */
export function useSyncSettingsContext() {
  const context = useContext(SyncSettingsContext);
  if (!context) {
    throw new Error("useSyncSettingsContext must be used within SyncSettingsProvider");
  }
  return context;
}

interface SyncSettingsProviderProps {
  connectionId: string;
  children: ReactNode;
}

/**
 * Provides sync settings state and actions for a connection and makes them available via SyncSettingsContext to descendants.
 *
 * Exposes loading/saving flags, current settings and override controls (pricing, SKU prefix, field locks, publications, default status, exclusions), field mappings and metafield helpers, pricing margin rules, store/global metadata, available integrations, and handlers for saving and triggering syncs.
 *
 * @param connectionId - The ID of the connection whose sync settings will be loaded and managed.
 * @param children - React children that will receive the SyncSettingsContext value.
 * @returns The provider element that wraps `children` with SyncSettingsContext.
 */
export function SyncSettingsProvider({ connectionId, children }: SyncSettingsProviderProps) {
  const {
    settings,
    filterOptions,
    availableIntegrations,
    isLoading,
    isSyncing,
    error,
    isSyncEnabled,
    hasSettings,
    fetchSyncSettings,
    createSyncSettings,
    updateSyncSettings,
    triggerSync,
    changeBulkStatus,
  } = useSyncSettings(connectionId);

  const { activeShopifyIntegration, fetchIntegrations } = useIntegrations();
  const {
    syncSettings: globalSyncSettings,
    fetchSyncSettings: fetchGlobalSyncSettings,
  } = useGlobalSyncSettings();
  const { getToken } = useAuth();

  // Override states
  const [usePricingOverride, setUsePricingOverride] = useState(false);
  const [useSkuPrefixOverride, setUseSkuPrefixOverride] = useState(false);
  const [useFieldLocksOverride, setUseFieldLocksOverride] = useState(false);
  const [usePublicationsOverride, setUsePublicationsOverride] = useState(false);
  const [useDefaultStatusOverride, setUseDefaultStatusOverride] = useState(false);
  const [useExclusionRulesOverride, setUseExclusionRulesOverride] = useState(false);

  // Local state
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("");
  const [filterRules, setFilterRules] = useState<FilterRules>({});
  const [fieldMappings, setFieldMappings] = useState<FieldMappingRule[]>([]);
  const [pricingMargin, setPricingMargin] = useState<PricingMargin>({
    defaultMargin: null,
    rules: [],
  });
  const [skuPrefix, setSkuPrefix] = useState<string>("");
  const [fieldLocks, setFieldLocks] = useState<FieldLockConfig | null>(null);
  const [publicationOverride, setPublicationOverride] = useState<PublicationOverride | null>(null);
  const [defaultProductStatus, setDefaultProductStatus] = useState<ProductStatus>("draft");
  const [exclusionRules, setExclusionRules] = useState<SyncExclusionRule[]>([]);
  const [availablePublications, setAvailablePublications] = useState<ShopifyPublication[]>([]);
  const [isLoadingPublications, setIsLoadingPublications] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openMarginRules, setOpenMarginRules] = useState<Set<string>>(new Set());

  // Metafield definitions
  const {
    definitions: metafieldDefinitions,
    isLoading: isLoadingMetafields,
    fetchDefinitions: fetchMetafieldDefinitions,
  } = useMetafieldDefinitions(selectedIntegrationId || undefined);

  // Store metadata
  const {
    metadata: storeMetadata,
    isLoading: isLoadingStoreMetadata,
    fetchMetadata: fetchStoreMetadata,
  } = useStoreMetadata(selectedIntegrationId || undefined);

  // Convert metafield definitions to combobox options
  const metafieldOptions = metafieldDefinitions
    .filter((def) => def.type === "boolean")
    .map((def) => ({
      value: def.fullKey,
      label: `${def.name} (${def.namespace})`,
    }));

  const getNamespaceFromFullKey = useCallback((fullKey: string) => {
    const parts = fullKey.split(".");
    return parts.length > 1 ? parts.slice(0, -1).join(".") : "";
  }, []);

  // Load data on mount
  useEffect(() => {
    fetchSyncSettings();
    fetchIntegrations();
    fetchGlobalSyncSettings();
  }, [fetchSyncSettings, fetchIntegrations, fetchGlobalSyncSettings]);

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setSyncEnabled(settings.syncEnabled === "true");
      setSelectedIntegrationId(settings.integrationId);
      setFilterRules(settings.filterRules || {});
      setFieldMappings(settings.fieldMappings || []);

      // Publications override
      const hasConnectionPublications = settings.publicationOverride !== null && settings.publicationOverride !== undefined;
      if (hasConnectionPublications) {
        setUsePublicationsOverride(true);
        setPublicationOverride(settings.publicationOverride);
      } else {
        setUsePublicationsOverride(false);
        if (globalSyncSettings?.defaultPublications) {
          const globalPubs = globalSyncSettings.defaultPublications;
          setPublicationOverride({
            mode: globalPubs.mode === "all" ? "default" : globalPubs.mode === "none" ? "none" : "override",
            publicationIds: globalPubs.publicationIds || [],
          });
        } else {
          setPublicationOverride(null);
        }
      }

      // SKU prefix override
      const hasConnectionSkuPrefix = settings.skuPrefix !== null && settings.skuPrefix !== undefined && settings.skuPrefix !== "";
      if (hasConnectionSkuPrefix) {
        setUseSkuPrefixOverride(true);
        setSkuPrefix(settings.skuPrefix || "");
      } else {
        setUseSkuPrefixOverride(false);
        setSkuPrefix(globalSyncSettings?.skuPrefix || "");
      }

      // Field locks override
      const hasConnectionFieldLocks = settings.fieldLocks !== null && settings.fieldLocks !== undefined;
      if (hasConnectionFieldLocks) {
        setUseFieldLocksOverride(true);
        setFieldLocks(settings.fieldLocks);
      } else {
        setUseFieldLocksOverride(false);
        setFieldLocks(globalSyncSettings?.fieldLocks || null);
      }

      // Pricing margin override
      const hasConnectionMargin =
        settings.pricingMargin &&
        (settings.pricingMargin.defaultMargin !== null ||
          settings.pricingMargin.rules.length > 0);

      if (hasConnectionMargin) {
        setUsePricingOverride(true);
        setPricingMargin(settings.pricingMargin!);
      } else {
        setUsePricingOverride(false);
        setPricingMargin(
          globalSyncSettings?.pricingMargin || { defaultMargin: null, rules: [] }
        );
      }

      // Default product status override
      const hasConnectionDefaultStatus = settings.defaultProductStatus !== null && settings.defaultProductStatus !== undefined;
      if (hasConnectionDefaultStatus) {
        setUseDefaultStatusOverride(true);
        setDefaultProductStatus(settings.defaultProductStatus!);
      } else {
        setUseDefaultStatusOverride(false);
        setDefaultProductStatus(globalSyncSettings?.defaultStatus || "draft");
      }

      // Exclusion rules override
      const hasConnectionExclusionRules = settings.exclusionRules !== null && settings.exclusionRules !== undefined && settings.exclusionRules.length > 0;
      if (hasConnectionExclusionRules) {
        setUseExclusionRulesOverride(true);
        setExclusionRules(settings.exclusionRules!);
      } else {
        setUseExclusionRulesOverride(false);
        setExclusionRules(globalSyncSettings?.exclusionRules || []);
      }

      setIsDirty(false);
    } else if (activeShopifyIntegration) {
      setSelectedIntegrationId(activeShopifyIntegration.id);
    }
  }, [settings, activeShopifyIntegration, globalSyncSettings]);

  // Fetch metafield definitions when field locks are enabled
  useEffect(() => {
    if (fieldLocks?.enabled && selectedIntegrationId) {
      fetchMetafieldDefinitions();
    }
  }, [fieldLocks?.enabled, selectedIntegrationId, fetchMetafieldDefinitions]);

  // Fetch store metadata when integration is selected
  useEffect(() => {
    if (selectedIntegrationId) {
      fetchStoreMetadata();
    }
  }, [selectedIntegrationId, fetchStoreMetadata]);

  // Auto-fetch publications when custom channels mode is selected
  useEffect(() => {
    if (publicationOverride?.mode === "override" && availablePublications.length === 0 && selectedIntegrationId) {
      fetchPublications();
    }
  }, [publicationOverride?.mode, availablePublications.length, selectedIntegrationId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const marginToSave = usePricingOverride ? pricingMargin : null;
      const skuPrefixToSave = useSkuPrefixOverride ? (skuPrefix || null) : null;
      const fieldLocksToSave = useFieldLocksOverride ? fieldLocks : null;
      const publicationsToSave = usePublicationsOverride ? publicationOverride : null;
      const defaultStatusToSave = useDefaultStatusOverride ? defaultProductStatus : null;
      const exclusionRulesToSave = useExclusionRulesOverride ? exclusionRules : null;

      if (hasSettings) {
        await updateSyncSettings({
          syncEnabled,
          filterRules,
          fieldMappings,
          pricingMargin: marginToSave,
          skuPrefix: skuPrefixToSave,
          fieldLocks: fieldLocksToSave,
          publicationOverride: publicationsToSave,
          defaultProductStatus: defaultStatusToSave,
          exclusionRules: exclusionRulesToSave,
        });
      } else {
        await createSyncSettings({
          integrationId: selectedIntegrationId,
          syncEnabled,
          filterRules,
          fieldMappings,
          pricingMargin: marginToSave,
          skuPrefix: skuPrefixToSave,
          fieldLocks: fieldLocksToSave,
          publicationOverride: publicationsToSave,
          defaultProductStatus: defaultStatusToSave,
          exclusionRules: exclusionRulesToSave,
        });
      }
      setIsDirty(false);
      toast.success("Sync settings saved");
    } catch {
      toast.error("Failed to save sync settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    hasSettings,
    syncEnabled,
    filterRules,
    fieldMappings,
    pricingMargin,
    usePricingOverride,
    useSkuPrefixOverride,
    useFieldLocksOverride,
    usePublicationsOverride,
    useDefaultStatusOverride,
    useExclusionRulesOverride,
    defaultProductStatus,
    exclusionRules,
    selectedIntegrationId,
    skuPrefix,
    fieldLocks,
    publicationOverride,
    updateSyncSettings,
    createSyncSettings,
  ]);

  const handleTriggerSync = useCallback(async (forceFullSync = false) => {
    try {
      await triggerSync("incremental", { forceFullSync });
      toast.success(forceFullSync ? "Full sync started (ignoring change detection)" : "Sync started");
    } catch {
      toast.error("Failed to start sync");
    }
  }, [triggerSync]);

  const fetchPublications = useCallback(async () => {
    if (!selectedIntegrationId) return;

    setIsLoadingPublications(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await apiClient<{
        publications: ShopifyPublication[];
        integrationId: string;
      }>(`/internal/integrations/${selectedIntegrationId}/publications`, {
        token,
      });

      setAvailablePublications(response.publications);
    } catch (err) {
      console.error("Failed to fetch publications:", err);
      toast.error("Failed to fetch sales channels");
    } finally {
      setIsLoadingPublications(false);
    }
  }, [selectedIntegrationId, getToken]);

  // Field mapping helpers
  const addMappingRule = useCallback(() => {
    const newRule: FieldMappingRule = {
      id: generateRuleId(),
      sourceField: "brand",
      sourceValue: "",
      targetField: "brand",
      targetValue: "",
    };
    setFieldMappings((prev) => [...prev, newRule]);
    setIsDirty(true);
  }, []);

  const removeMappingRule = useCallback((ruleId: string) => {
    setFieldMappings((prev) => prev.filter((r) => r.id !== ruleId));
    setIsDirty(true);
  }, []);

  const updateMappingRule = useCallback(
    (ruleId: string, updates: Partial<FieldMappingRule>) => {
      setFieldMappings((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
      );
      setIsDirty(true);
    },
    []
  );

  // Margin rule helpers
  const addMarginRule = useCallback(() => {
    const newRule: MarginRule = {
      id: generateRuleId(),
      name: `Margin Rule ${pricingMargin.rules.length + 1}`,
      priority: pricingMargin.rules.length,
      conditions: [{ field: "brand", operator: "equals", value: "" }],
      marginType: "percentage",
      marginValue: 10,
    };
    setPricingMargin((prev) => ({
      ...prev,
      rules: [...prev.rules, newRule],
    }));
    setOpenMarginRules((prev) => new Set([...prev, newRule.id]));
    setIsDirty(true);
  }, [pricingMargin.rules.length]);

  const removeMarginRule = useCallback((ruleId: string) => {
    setPricingMargin((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
    }));
    setOpenMarginRules((prev) => {
      const next = new Set(prev);
      next.delete(ruleId);
      return next;
    });
    setIsDirty(true);
  }, []);

  const updateMarginRule = useCallback(
    (ruleId: string, updates: Partial<MarginRule>) => {
      setPricingMargin((prev) => ({
        ...prev,
        rules: prev.rules.map((r) =>
          r.id === ruleId ? { ...r, ...updates } : r
        ),
      }));
      setIsDirty(true);
    },
    []
  );

  const toggleMarginRuleOpen = useCallback((id: string) => {
    setOpenMarginRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const value: SyncSettingsContextValue = {
    connectionId,
    isLoading,
    isSaving,
    isSyncing,
    isDirty,
    error: error as Error | null,
    hasSettings,
    isSyncEnabled,
    syncEnabled,
    setSyncEnabled: (value) => { setSyncEnabled(value); setIsDirty(true); },
    selectedIntegrationId,
    setSelectedIntegrationId: (value) => { setSelectedIntegrationId(value); setIsDirty(true); },
    filterRules,
    setFilterRules: (value) => {
      if (typeof value === "function") {
        setFilterRules((prev) => { const next = value(prev); setIsDirty(true); return next; });
      } else {
        setFilterRules(value);
        setIsDirty(true);
      }
    },
    filterOptions: filterOptions || { brands: [], productTypes: [], tags: [] },
    fieldMappings,
    addMappingRule,
    removeMappingRule,
    updateMappingRule,
    skuPrefix,
    setSkuPrefix: (value) => { setSkuPrefix(value); setIsDirty(true); },
    useSkuPrefixOverride,
    setUseSkuPrefixOverride,
    publicationOverride,
    setPublicationOverride: (value) => {
      if (typeof value === "function") {
        setPublicationOverride((prev) => { const next = value(prev); setIsDirty(true); return next; });
      } else {
        setPublicationOverride(value);
        setIsDirty(true);
      }
    },
    usePublicationsOverride,
    setUsePublicationsOverride,
    availablePublications,
    isLoadingPublications,
    fetchPublications,
    fieldLocks,
    setFieldLocks: (value) => {
      if (typeof value === "function") {
        setFieldLocks((prev) => { const next = value(prev); setIsDirty(true); return next; });
      } else {
        setFieldLocks(value);
        setIsDirty(true);
      }
    },
    useFieldLocksOverride,
    setUseFieldLocksOverride,
    metafieldDefinitions,
    metafieldOptions,
    isLoadingMetafields,
    fetchMetafieldDefinitions,
    getNamespaceFromFullKey,
    pricingMargin,
    setPricingMargin: (value) => {
      if (typeof value === "function") {
        setPricingMargin((prev) => { const next = value(prev); setIsDirty(true); return next; });
      } else {
        setPricingMargin(value);
        setIsDirty(true);
      }
    },
    usePricingOverride,
    setUsePricingOverride,
    openMarginRules,
    addMarginRule,
    removeMarginRule,
    updateMarginRule,
    toggleMarginRuleOpen,
    defaultProductStatus,
    setDefaultProductStatus: (value) => { setDefaultProductStatus(value); setIsDirty(true); },
    useDefaultStatusOverride,
    setUseDefaultStatusOverride,
    exclusionRules,
    setExclusionRules: (value) => {
      if (typeof value === "function") {
        setExclusionRules((prev) => { const next = value(prev); setIsDirty(true); return next; });
      } else {
        setExclusionRules(value);
        setIsDirty(true);
      }
    },
    useExclusionRulesOverride,
    setUseExclusionRulesOverride,
    storeMetadata: storeMetadata || null,
    isLoadingStoreMetadata,
    globalSyncSettings: globalSyncSettings || null,
    availableIntegrations: availableIntegrations || [],
    activeShopifyIntegration,
    handleSave,
    handleTriggerSync,
    setIsDirty,
    changeBulkStatus,
  };

  return (
    <SyncSettingsContext.Provider value={value}>
      {children}
    </SyncSettingsContext.Provider>
  );
}