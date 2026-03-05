"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RefreshCw,
  DollarSign,
  Percent,
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useGlobalSyncSettings } from "@/hooks/use-global-sync-settings";
import { useStore } from "@/hooks/use-store";
import type { FilterOptions } from "@/hooks/use-field-mappings";
import type {
  PricingMargin,
  MarginRule,
  MarginCondition,
} from "@/hooks/use-sync-settings";
import { toast } from "sonner";
import { useTranslation } from "@workspace/i18n";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Collapsible, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
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
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/ui/lib/utils";

function generateRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface PricingMarginEditorProps {
  filterOptions?: FilterOptions;
  onSettingsLoaded?: () => void;
}

export function PricingMarginEditor({ filterOptions, onSettingsLoaded }: PricingMarginEditorProps) {
  const { t } = useTranslation("sync");

  // Memoize combobox options
  const brandOptions = useMemo(
    () => (filterOptions?.brands || []).map((b) => ({ value: b, label: b })),
    [filterOptions?.brands]
  );
  const productTypeOptions = useMemo(
    () => (filterOptions?.productTypes || []).map((p) => ({ value: p, label: p })),
    [filterOptions?.productTypes]
  );
  const tagOptions = useMemo(
    () => (filterOptions?.tags || []).map((t) => ({ value: t, label: t })),
    [filterOptions?.tags]
  );
  const {
    syncSettings,
    isLoading,
    fetchSyncSettings,
    updateSyncSettings,
  } = useGlobalSyncSettings();

  // Get currency symbol from store data (cached via React Query)
  const { currencySymbol } = useStore();

  const [pricingMargin, setPricingMargin] = useState<PricingMargin>({
    defaultMargin: null,
    rules: [],
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openRules, setOpenRules] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    fetchSyncSettings().then(() => {
      onSettingsLoaded?.();
    });
  }, [fetchSyncSettings, onSettingsLoaded]);

  // Sync local state with fetched settings
  useEffect(() => {
    if (syncSettings?.pricingMargin) {
      setPricingMargin(syncSettings.pricingMargin);
      setIsDirty(false);
    }
  }, [syncSettings]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSyncSettings({ pricingMargin });
      setIsDirty(false);
      toast.success(t("pricing.savedSuccess"));
    } catch {
      toast.error(t("pricing.savedError"));
    } finally {
      setIsSaving(false);
    }
  }, [pricingMargin, updateSyncSettings, t]);

  const toggleRuleOpen = useCallback((id: string) => {
    setOpenRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
    setOpenRules((prev) => new Set([...prev, newRule.id]));
    setIsDirty(true);
  }, [pricingMargin.rules.length]);

  const removeMarginRule = useCallback((ruleId: string) => {
    setPricingMargin((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
    }));
    setOpenRules((prev) => {
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

  // Calculate example price
  const calculateExamplePrice = useCallback(() => {
    if (!pricingMargin.defaultMargin) return null;

    let price = 100;
    if (pricingMargin.defaultMargin.type === "percentage") {
      price = 100 * (1 + pricingMargin.defaultMargin.value / 100);
    } else {
      price = 100 + pricingMargin.defaultMargin.value;
    }

    const beforeRounding = price;

    // Apply rounding
    const rounding = pricingMargin.rounding;
    if (rounding?.enabled && rounding.strategy) {
      switch (rounding.strategy) {
        case "up":
          price = Math.ceil(price);
          break;
        case "down":
          price = Math.floor(price);
          break;
        case "nearest":
          price = Math.round(price);
          break;
      }
      if (rounding.endWith !== undefined) {
        price = price + rounding.endWith / 100;
      }
    }

    return { beforeRounding, finalPrice: price };
  }, [pricingMargin]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Global Pricing Margin Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default Margin Toggle Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>

            {/* Margin Settings Skeleton */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-[140px]" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>

            {/* Conditional Rules Skeleton */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-52" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="flex flex-col items-center py-8">
                <Skeleton className="h-12 w-12 rounded-full mb-3" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price Rounding Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const examplePrice = calculateExamplePrice();

  return (
    <div className="space-y-6">
      {/* Global Pricing Margin */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t("pricing.title")}
              </CardTitle>
              <CardDescription>
                {t("pricing.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Margin Toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">{t("pricing.enableDefault")}</Label>
            <Switch
              checked={pricingMargin.defaultMargin !== null}
              onCheckedChange={(checked) => {
                setPricingMargin((prev) => ({
                  ...prev,
                  defaultMargin: checked
                    ? { type: "percentage", value: 10 }
                    : null,
                }));
                setIsDirty(true);
              }}
            />
          </div>

          {/* Default Margin Settings */}
          <AnimatePresence initial={false}>
            {pricingMargin.defaultMargin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: 0.2, ease: "easeOut" },
                }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={pricingMargin.defaultMargin.type}
                      onValueChange={(value: "percentage" | "fixed") => {
                        setPricingMargin((prev) => ({
                          ...prev,
                          defaultMargin: prev.defaultMargin
                            ? { ...prev.defaultMargin, type: value }
                            : null,
                        }));
                        setIsDirty(true);
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">
                          <span className="flex items-center gap-2">
                            <Percent className="h-3.5 w-3.5" />
                            {t("pricing.marginTypes.percentage")}
                          </span>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <span className="flex items-center gap-2">
                            <DollarSign className="h-3.5 w-3.5" />
                            {t("pricing.marginTypes.fixed")}
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Input
                        type="number"
                        value={pricingMargin.defaultMargin.value}
                        onChange={(e) => {
                          setPricingMargin((prev) => ({
                            ...prev,
                            defaultMargin: prev.defaultMargin
                              ? {
                                  ...prev.defaultMargin,
                                  value: parseFloat(e.target.value) || 0,
                                }
                              : null,
                          }));
                          setIsDirty(true);
                        }}
                        className="w-24 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {pricingMargin.defaultMargin.type === "percentage" ? "%" : currencySymbol}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {pricingMargin.defaultMargin.type === "percentage"
                        ? `+${pricingMargin.defaultMargin.value}% markup`
                        : `+${currencySymbol}${pricingMargin.defaultMargin.value} per item`}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conditional Margin Rules */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">{t("pricing.conditionalRules")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.conditionalRulesDescription")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addMarginRule}>
                <Plus className="h-4 w-4" />
                {t("pricing.addRule")}
              </Button>
            </div>

            {pricingMargin.rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Layers className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.noRules")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pricingMargin.rules.map((rule, index) => (
                  <Collapsible
                    key={rule.id}
                    open={openRules.has(rule.id)}
                    onOpenChange={() => toggleRuleOpen(rule.id)}
                  >
                    <div className="rounded-xl border bg-card overflow-hidden">
                      {/* Rule Header */}
                      <div className="flex items-center gap-3 p-4">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-3 flex-1 text-left group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm">
                                  {rule.conditions[0]?.field}{" "}
                                  {rule.conditions[0]?.operator}{" "}
                                  {rule.conditions[0]?.operator === "between" && Array.isArray(rule.conditions[0]?.value) ? (
                                    <span className="font-medium">&quot;{rule.conditions[0].value[0]}&quot; and &quot;{rule.conditions[0].value[1]}&quot;</span>
                                  ) : rule.conditions[0]?.value ? (
                                    <span className="font-medium">&quot;{rule.conditions[0].value}&quot;</span>
                                  ) : (
                                    <span className="text-muted-foreground italic">{t("exclusionRules.noValue")}</span>
                                  )}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="secondary">
                                  {rule.marginType === "percentage"
                                    ? `+${rule.marginValue}%`
                                    : `+${currencySymbol}${rule.marginValue}`}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {t("pricing.priority")} {index + 1}
                                </Badge>
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: openRules.has(rule.id) ? 180 : 0 }}
                              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            >
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </motion.div>
                          </button>
                        </CollapsibleTrigger>
                      </div>

                      {/* Rule Content */}
                      <AnimatePresence initial={false}>
                        {openRules.has(rule.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                              opacity: { duration: 0.2, ease: "easeOut" },
                            }}
                            className="overflow-hidden"
                          >
                            <div className="border-t bg-muted/30 p-4 space-y-4">
                              {/* Margin */}
                              <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {t("pricing.margin")}
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={rule.marginType}
                                    onValueChange={(value: "percentage" | "fixed") =>
                                      updateMarginRule(rule.id, { marginType: value })
                                    }
                                  >
                                    <SelectTrigger className="w-auto min-w-[100px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="percentage">
                                        {t("pricing.marginTypes.percentage")}
                                      </SelectItem>
                                      <SelectItem value="fixed">
                                        {t("pricing.marginTypes.fixed")}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="relative flex-1">
                                    <Input
                                      type="number"
                                      value={rule.marginValue}
                                      onChange={(e) =>
                                        updateMarginRule(rule.id, {
                                          marginValue: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                      {rule.marginType === "percentage" ? "%" : currencySymbol}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Condition */}
                              <div className="space-y-2">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {t("pricing.condition")}
                                </Label>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm">{t("pricing.when")}</span>
                                  <Select
                                    value={rule.conditions[0]?.field || "brand"}
                                    onValueChange={(value) => {
                                      const currentCondition = rule.conditions[0] || {
                                        field: "brand",
                                        operator: "equals",
                                        value: "",
                                      };
                                      updateMarginRule(rule.id, {
                                        conditions: [
                                          {
                                            ...currentCondition,
                                            field: value as MarginCondition["field"],
                                          },
                                        ],
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="brand">{t("exclusionRules.fields.brand")}</SelectItem>
                                      <SelectItem value="productType">{t("exclusionRules.fields.productType")}</SelectItem>
                                      <SelectItem value="tag">{t("exclusionRules.fields.tag")}</SelectItem>
                                      <SelectItem value="sku">{t("exclusionRules.fields.sku")}</SelectItem>
                                      <SelectItem value="price">{t("exclusionRules.fields.price")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={rule.conditions[0]?.operator || "equals"}
                                    onValueChange={(value) => {
                                      const currentCondition = rule.conditions[0] || {
                                        field: "brand",
                                        operator: "equals",
                                        value: "",
                                      };
                                      const newValue = value === "between"
                                        ? [0, 0] as [number, number]
                                        : (Array.isArray(currentCondition.value) ? 0 : currentCondition.value);
                                      updateMarginRule(rule.id, {
                                        conditions: [
                                          {
                                            ...currentCondition,
                                            operator: value as MarginCondition["operator"],
                                            value: newValue,
                                          },
                                        ],
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-auto min-w-[100px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="equals">{t("exclusionRules.operators.equals")}</SelectItem>
                                      <SelectItem value="notEquals">{t("exclusionRules.operators.notEquals")}</SelectItem>
                                      <SelectItem value="contains">{t("exclusionRules.operators.contains")}</SelectItem>
                                      <SelectItem value="greaterThan">{t("exclusionRules.operators.greaterThan")}</SelectItem>
                                      <SelectItem value="lessThan">{t("exclusionRules.operators.lessThan")}</SelectItem>
                                      {["price", "compareAtPrice", "costPrice"].includes(rule.conditions[0]?.field || "") && (
                                        <SelectItem value="between">{t("exclusionRules.operators.between")}</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  {rule.conditions[0]?.operator === "between" ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        value={Array.isArray(rule.conditions[0]?.value) ? rule.conditions[0].value[0] : ""}
                                        onChange={(e) => {
                                          const currentCondition = rule.conditions[0] || {
                                            field: "price",
                                            operator: "between",
                                            value: [0, 0],
                                          };
                                          const currentValue = Array.isArray(currentCondition.value) ? currentCondition.value : [0, 0];
                                          updateMarginRule(rule.id, {
                                            conditions: [
                                              {
                                                ...currentCondition,
                                                value: [parseFloat(e.target.value) || 0, currentValue[1] ?? 0],
                                              },
                                            ],
                                          });
                                        }}
                                        placeholder="Min"
                                        className="w-[100px]"
                                      />
                                      <span className="text-sm text-muted-foreground">and</span>
                                      <Input
                                        type="number"
                                        value={Array.isArray(rule.conditions[0]?.value) ? rule.conditions[0].value[1] : ""}
                                        onChange={(e) => {
                                          const currentCondition = rule.conditions[0] || {
                                            field: "price",
                                            operator: "between",
                                            value: [0, 0],
                                          };
                                          const currentValue = Array.isArray(currentCondition.value) ? currentCondition.value : [0, 0];
                                          updateMarginRule(rule.id, {
                                            conditions: [
                                              {
                                                ...currentCondition,
                                                value: [currentValue[0] ?? 0, parseFloat(e.target.value) || 0],
                                              },
                                            ],
                                          });
                                        }}
                                        placeholder="Max"
                                        className="w-[100px]"
                                      />
                                    </div>
                                  ) : rule.conditions[0]?.field === "brand" ? (
                                    <Combobox
                                      options={brandOptions}
                                      value={String(rule.conditions[0]?.value || "")}
                                      onValueChange={(value) => {
                                        const currentCondition = rule.conditions[0] || {
                                          field: "brand",
                                          operator: "equals",
                                          value: "",
                                        };
                                        updateMarginRule(rule.id, {
                                          conditions: [{ ...currentCondition, value }],
                                        });
                                      }}
                                      placeholder={t("exclusionRules.selectBrand")}
                                      searchPlaceholder={t("exclusionRules.searchBrand")}
                                      emptyMessage={t("exclusionRules.noBrandsFound")}
                                      className="w-[200px]"
                                    />
                                  ) : rule.conditions[0]?.field === "productType" ? (
                                    <Combobox
                                      options={productTypeOptions}
                                      value={String(rule.conditions[0]?.value || "")}
                                      onValueChange={(value) => {
                                        const currentCondition = rule.conditions[0] || {
                                          field: "productType",
                                          operator: "equals",
                                          value: "",
                                        };
                                        updateMarginRule(rule.id, {
                                          conditions: [{ ...currentCondition, value }],
                                        });
                                      }}
                                      placeholder={t("exclusionRules.selectProductType")}
                                      searchPlaceholder={t("exclusionRules.searchProductType")}
                                      emptyMessage={t("exclusionRules.noProductTypesFound")}
                                      className="w-[200px]"
                                    />
                                  ) : rule.conditions[0]?.field === "tag" ? (
                                    <Combobox
                                      options={tagOptions}
                                      value={String(rule.conditions[0]?.value || "")}
                                      onValueChange={(value) => {
                                        const currentCondition = rule.conditions[0] || {
                                          field: "tag",
                                          operator: "equals",
                                          value: "",
                                        };
                                        updateMarginRule(rule.id, {
                                          conditions: [{ ...currentCondition, value }],
                                        });
                                      }}
                                      placeholder={t("exclusionRules.selectTag")}
                                      searchPlaceholder={t("exclusionRules.searchTag")}
                                      emptyMessage={t("exclusionRules.noTagsFound")}
                                      className="w-[200px]"
                                    />
                                  ) : (
                                    <Input
                                      value={String(rule.conditions[0]?.value || "")}
                                      onChange={(e) => {
                                        const currentCondition = rule.conditions[0] || {
                                          field: "sku",
                                          operator: "equals",
                                          value: "",
                                        };
                                        const isNumeric = ["price", "compareAtPrice", "costPrice"].includes(currentCondition.field);
                                        updateMarginRule(rule.id, {
                                          conditions: [
                                            {
                                              ...currentCondition,
                                              value: isNumeric
                                                ? parseFloat(e.target.value) || 0
                                                : e.target.value,
                                            },
                                          ],
                                        });
                                      }}
                                      placeholder={
                                        rule.conditions[0]?.field === "price"
                                          ? t("exclusionRules.pricePlaceholder")
                                          : t("exclusionRules.valuePlaceholder")
                                      }
                                      className="w-[200px]"
                                    />
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex justify-end pt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => removeMarginRule(rule.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {t("pricing.removeRule")}
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price Rounding */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                {t("pricing.rounding.title")}
              </CardTitle>
              <CardDescription>
                {t("pricing.rounding.description")}
              </CardDescription>
            </div>
            <Switch
              checked={pricingMargin.rounding?.enabled ?? false}
              onCheckedChange={(checked) => {
                setPricingMargin((prev) => ({
                  ...prev,
                  rounding: checked
                    ? {
                        enabled: true,
                        strategy: "nearest",
                        precision: 0,
                        endWith: 99,
                      }
                    : undefined,
                }));
                setIsDirty(true);
              }}
            />
          </div>
        </CardHeader>
        <AnimatePresence initial={false}>
          {pricingMargin.rounding?.enabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.2, ease: "easeOut" },
              }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 space-y-6">
                {/* Rounding Strategy */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("pricing.rounding.strategy")}</Label>
                  <Select
                    value={pricingMargin.rounding.strategy}
                    onValueChange={(value: "up" | "down" | "nearest") => {
                      setPricingMargin((prev) => ({
                        ...prev,
                        rounding: prev.rounding
                          ? { ...prev.rounding, strategy: value }
                          : undefined,
                      }));
                      setIsDirty(true);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="up">{t("pricing.rounding.strategies.up")}</SelectItem>
                      <SelectItem value="down">{t("pricing.rounding.strategies.down")}</SelectItem>
                      <SelectItem value="nearest">{t("pricing.rounding.strategies.nearest")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Ending */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">{t("pricing.rounding.endWith")}</Label>
                  <ToggleGroup
                    type="single"
                    value={String(pricingMargin.rounding?.endWith ?? 99)}
                    onValueChange={(value) => {
                      if (value) {
                        setPricingMargin((prev) => ({
                          ...prev,
                          rounding: prev.rounding
                            ? { ...prev.rounding, endWith: parseInt(value) }
                            : undefined,
                        }));
                        setIsDirty(true);
                      }
                    }}
                    className="justify-start"
                  >
                    {[
                      { value: "99", label: ".99" },
                      { value: "95", label: ".95" },
                      { value: "90", label: ".90" },
                      { value: "50", label: ".50" },
                      { value: "0", label: ".00" },
                    ].map((option) => (
                      <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        className={cn(
                          "px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
                          "font-mono"
                        )}
                      >
                        {option.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                {/* Example Calculation */}
                {examplePrice && (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground font-medium">{t("pricing.example")}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-muted-foreground">{currencySymbol}100</span>
                        <span className="text-muted-foreground">+</span>
                        <span className="text-muted-foreground">
                          {pricingMargin.defaultMargin?.value}
                          {pricingMargin.defaultMargin?.type === "percentage" ? "%" : currencySymbol}
                        </span>
                        <span className="text-muted-foreground">=</span>
                        <span className="text-muted-foreground">
                          {currencySymbol}{examplePrice.beforeRounding.toFixed(2)}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground font-semibold text-base">
                          {currencySymbol}{examplePrice.finalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Example calculation when rounding is off */}
      {examplePrice && !pricingMargin.rounding?.enabled && (
        <Card variant="flat">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground font-medium">{t("pricing.example")}</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted-foreground">{currencySymbol}100</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-muted-foreground">
                  {pricingMargin.defaultMargin?.value}
                  {pricingMargin.defaultMargin?.type === "percentage" ? "%" : currencySymbol}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground font-semibold text-base">
                  {currencySymbol}{examplePrice.finalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      {isDirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="shadow-lg">
            {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
            {t("pricing.savePricingSettings")}
          </Button>
        </div>
      )}
    </div>
  );
}
