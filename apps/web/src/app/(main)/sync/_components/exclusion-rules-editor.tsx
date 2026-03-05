"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  RefreshCw,
  Filter,
  ChevronDown,
} from "lucide-react";
import type { SyncExclusionRule, FilterOptions } from "@/hooks/use-field-mappings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";

interface ExclusionRulesEditorProps {
  exclusionRules: SyncExclusionRule[];
  filterOptions?: FilterOptions;
  onSave: (rules: SyncExclusionRule[]) => Promise<void>;
  isSaving: boolean;
}

function generateRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Render an editor UI for managing a list of sync exclusion rules.
 *
 * The component allows adding, editing, enabling/disabling, collapsing/expanding,
 * and removing rules; changes are tracked locally and persisted via `onSave`.
 *
 * @param exclusionRules - Initial array of `SyncExclusionRule` objects to edit
 * @param filterOptions - Optional collections (brands, productTypes, tags) used to populate comboboxes
 * @param onSave - Callback invoked with the updated rules when the user saves changes
 * @param isSaving - Flag indicating whether a save operation is in progress (disables the save control)
 * @returns A React element containing the exclusion rules editor UI
 */
export function ExclusionRulesEditor({
  exclusionRules,
  filterOptions,
  onSave,
  isSaving,
}: ExclusionRulesEditorProps) {
  const { t } = useTranslation("sync");
  const [localRules, setLocalRules] = useState<SyncExclusionRule[]>(exclusionRules);
  const [isDirty, setIsDirty] = useState(false);
  const [openRules, setOpenRules] = useState<Set<string>>(new Set());

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

  const FIELD_OPTIONS = [
    { value: "brand", label: t("exclusionRules.fields.brand") },
    { value: "productType", label: t("exclusionRules.fields.productType") },
    { value: "tag", label: t("exclusionRules.fields.tag") },
    { value: "sku", label: t("exclusionRules.fields.sku") },
    { value: "price", label: t("exclusionRules.fields.price") },
    { value: "title", label: t("exclusionRules.fields.title") },
    { value: "stock", label: t("exclusionRules.fields.stock") },
  ] as const;

  const OPERATOR_OPTIONS = [
    { value: "equals", label: t("exclusionRules.operators.equals") },
    { value: "notEquals", label: t("exclusionRules.operators.notEquals") },
    { value: "contains", label: t("exclusionRules.operators.contains") },
    { value: "notContains", label: t("exclusionRules.operators.notContains") },
    { value: "startsWith", label: t("exclusionRules.operators.startsWith") },
    { value: "endsWith", label: t("exclusionRules.operators.endsWith") },
    { value: "greaterThan", label: t("exclusionRules.operators.greaterThan") },
    { value: "lessThan", label: t("exclusionRules.operators.lessThan") },
  ] as const;

  // Reset local state when prop changes
  useEffect(() => {
    setLocalRules(exclusionRules);
    setIsDirty(false);
  }, [exclusionRules]);

  const handleAddRule = useCallback(() => {
    const newRule: SyncExclusionRule = {
      id: generateRuleId(),
      name: `Rule ${localRules.length + 1}`,
      field: "brand",
      operator: "equals",
      value: "",
      enabled: true,
    };
    setLocalRules([...localRules, newRule]);
    setOpenRules((prev) => new Set([...prev, newRule.id]));
    setIsDirty(true);
  }, [localRules]);

  const handleRemoveRule = useCallback((id: string) => {
    setLocalRules((prev) => prev.filter((r) => r.id !== id));
    setOpenRules((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleUpdateRule = useCallback(
    (id: string, updates: Partial<SyncExclusionRule>) => {
      setLocalRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      setIsDirty(true);
    },
    []
  );

  const handleToggleRule = useCallback((id: string) => {
    setLocalRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    setIsDirty(true);
  }, []);

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

  const handleSave = useCallback(async () => {
    await onSave(localRules);
    setIsDirty(false);
  }, [localRules, onSave]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>{t("exclusionRules.title")}</CardTitle>
              <CardDescription>
                {t("exclusionRules.description")}
              </CardDescription>
            </div>
            <Button variant="default" size="sm" onClick={handleAddRule}>
              <Plus className="h-4 w-4" />
              {t("exclusionRules.addRule")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Filter className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">{t("exclusionRules.noRules")}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                {t("exclusionRules.noRulesDescription")}
              </p>
              <Button variant="outline" onClick={handleAddRule}>
                <Plus className="h-4 w-4" />
                {t("exclusionRules.addFirstRule")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
                {localRules.map((rule) => (
                  <Collapsible
                    key={rule.id}
                    open={openRules.has(rule.id)}
                    onOpenChange={() => toggleRuleOpen(rule.id)}
                  >
                    <div className="rounded-xl border bg-card overflow-hidden">
                      {/* Rule Header */}
                      <div className="flex items-center gap-3 p-4">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <CollapsibleTrigger asChild>
                          <button type="button" className="flex items-center gap-3 flex-1 text-left group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${!rule.enabled ? "text-muted-foreground" : ""}`}>
                                  {FIELD_OPTIONS.find((f) => f.value === rule.field)?.label}{" "}
                                  {OPERATOR_OPTIONS.find((o) => o.value === rule.operator)?.label}{" "}
                                  {rule.value ? (
                                    <span className="font-medium">&quot;{rule.value}&quot;</span>
                                  ) : (
                                    <span className="text-muted-foreground italic">{t("exclusionRules.noValue")}</span>
                                  )}
                                </span>
                                <Badge variant={rule.enabled ? "success" : "secondary"} size="sm">
                                  {rule.enabled ? t("exclusionRules.active") : t("exclusionRules.disabled")}
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
                            <div className="border-t bg-muted/30 px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={rule.field}
                                  onValueChange={(value) =>
                                    handleUpdateRule(rule.id, {
                                      field: value as SyncExclusionRule["field"],
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FIELD_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={rule.operator}
                                  onValueChange={(value) =>
                                    handleUpdateRule(rule.id, {
                                      operator: value as SyncExclusionRule["operator"],
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-auto min-w-[100px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {OPERATOR_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {rule.field === "brand" ? (
                                  <Combobox
                                    options={brandOptions}
                                    value={rule.value}
                                    onValueChange={(value) =>
                                      handleUpdateRule(rule.id, { value })
                                    }
                                    placeholder={t("exclusionRules.selectBrand")}
                                    searchPlaceholder={t("exclusionRules.searchBrand")}
                                    emptyMessage={t("exclusionRules.noBrandsFound")}
                                    className="w-[200px]"
                                  />
                                ) : rule.field === "productType" ? (
                                  <Combobox
                                    options={productTypeOptions}
                                    value={rule.value}
                                    onValueChange={(value) =>
                                      handleUpdateRule(rule.id, { value })
                                    }
                                    placeholder={t("exclusionRules.selectProductType")}
                                    searchPlaceholder={t("exclusionRules.searchProductType")}
                                    emptyMessage={t("exclusionRules.noProductTypesFound")}
                                    className="w-[200px]"
                                  />
                                ) : rule.field === "tag" ? (
                                  <Combobox
                                    options={tagOptions}
                                    value={rule.value}
                                    onValueChange={(value) =>
                                      handleUpdateRule(rule.id, { value })
                                    }
                                    placeholder={t("exclusionRules.selectTag")}
                                    searchPlaceholder={t("exclusionRules.searchTag")}
                                    emptyMessage={t("exclusionRules.noTagsFound")}
                                    className="w-[200px]"
                                  />
                                ) : (
                                  <Input
                                    value={rule.value}
                                    onChange={(e) =>
                                      handleUpdateRule(rule.id, { value: e.target.value })
                                    }
                                    placeholder={
                                      rule.field === "price"
                                        ? t("exclusionRules.pricePlaceholder")
                                        : t("exclusionRules.valuePlaceholder")
                                    }
                                    className="w-[200px]"
                                  />
                                )}
                                <div className="ml-auto">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleRemoveRule(rule.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
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
        </CardContent>
      </Card>

      {/* Save button */}
      {isDirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="shadow-lg">
            {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
            {t("exclusionRules.saveExclusionRules")}
          </Button>
        </div>
      )}
    </div>
  );
}