"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  Filter,
  ChevronDown,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useSyncSettingsContext } from "./context";
import { generateRuleId } from "./types";
import type { SyncExclusionRule } from "./types";
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
import { Switch } from "@workspace/ui/components/switch";

const FIELD_OPTIONS = [
  { value: "brand", label: "Brand" },
  { value: "productType", label: "Product Type" },
  { value: "tag", label: "Tag" },
  { value: "sku", label: "SKU" },
  { value: "price", label: "Price" },
  { value: "title", label: "Title" },
  { value: "stock", label: "Stock" },
] as const;

const OPERATOR_OPTIONS = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "notContains", label: "does not contain" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "greaterThan", label: "greater than" },
  { value: "lessThan", label: "less than" },
] as const;

/**
 * Render a card UI for viewing and editing exclusion rules for a feed, with the ability to override or fall back to global settings.
 *
 * Displays a summary of active global exclusion rules when not overriding. When overriding is enabled, provides an editor to add, remove, enable/disable, and configure per-feed exclusion rules with field-, operator-, and value-specific controls.
 *
 * @returns The ExclusionRulesCard React element
 */
export function ExclusionRulesCard() {
  const {
    filterOptions,
    exclusionRules,
    setExclusionRules,
    useExclusionRulesOverride,
    setUseExclusionRulesOverride,
    globalSyncSettings,
    setIsDirty,
  } = useSyncSettingsContext();

  const [openRules, setOpenRules] = useState<Set<string>>(new Set());

  // Memoize combobox options
  const brandOptions = useMemo(
    () => (filterOptions.brands || []).map((b) => ({ value: b, label: b })),
    [filterOptions.brands]
  );
  const productTypeOptions = useMemo(
    () => (filterOptions.productTypes || []).map((p) => ({ value: p, label: p })),
    [filterOptions.productTypes]
  );
  const tagOptions = useMemo(
    () => (filterOptions.tags || []).map((t) => ({ value: t, label: t })),
    [filterOptions.tags]
  );

  const handleAddRule = useCallback(() => {
    const newRule: SyncExclusionRule = {
      id: generateRuleId(),
      name: `Rule ${exclusionRules.length + 1}`,
      field: "brand",
      operator: "equals",
      value: "",
      enabled: true,
    };
    setExclusionRules([...exclusionRules, newRule]);
    setOpenRules((prev) => new Set([...prev, newRule.id]));
  }, [exclusionRules, setExclusionRules]);

  const handleRemoveRule = useCallback((id: string) => {
    setExclusionRules((prev) => prev.filter((r) => r.id !== id));
    setOpenRules((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [setExclusionRules]);

  const handleUpdateRule = useCallback(
    (id: string, updates: Partial<SyncExclusionRule>) => {
      setExclusionRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    },
    [setExclusionRules]
  );

  const handleToggleRule = useCallback((id: string) => {
    setExclusionRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }, [setExclusionRules]);

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

  const globalExclusionRules = globalSyncSettings?.exclusionRules || [];
  const activeGlobalRulesCount = globalExclusionRules.filter(r => r.enabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Exclusion Rules</CardTitle>
              {useExclusionRulesOverride && (
                <Badge variant="secondary">Override</Badge>
              )}
            </div>
            <CardDescription>
              {useExclusionRulesOverride
                ? "Using custom exclusion rules for this feed"
                : "Using global exclusion rules"}
              {!useExclusionRulesOverride && (
                <Link
                  href="/sync"
                  className="ml-1 text-primary hover:underline"
                >
                  Edit global settings
                </Link>
              )}
            </CardDescription>
          </div>
          <Switch
            checked={useExclusionRulesOverride}
            onCheckedChange={(checked) => {
              setUseExclusionRulesOverride(checked);
              if (!checked) {
                setExclusionRules(globalExclusionRules);
              }
              setIsDirty(true);
            }}
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Show global settings info when not overriding */}
        {!useExclusionRulesOverride && (
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span>
                <strong>Global setting:</strong>{" "}
                {activeGlobalRulesCount > 0
                  ? `${activeGlobalRulesCount} active rule${activeGlobalRulesCount === 1 ? "" : "s"}`
                  : "No exclusion rules configured"}
              </span>
            </div>
            {activeGlobalRulesCount > 0 && (
              <div className="mt-2 space-y-1">
                {globalExclusionRules.filter(r => r.enabled).slice(0, 3).map((rule) => (
                  <div key={rule.id} className="text-xs text-muted-foreground pl-6">
                    {FIELD_OPTIONS.find(f => f.value === rule.field)?.label}{" "}
                    {OPERATOR_OPTIONS.find(o => o.value === rule.operator)?.label}{" "}
                    &quot;{rule.value}&quot;
                  </div>
                ))}
                {activeGlobalRulesCount > 3 && (
                  <div className="text-xs text-muted-foreground pl-6">
                    +{activeGlobalRulesCount - 3} more...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Exclusion Rules Editor when using override */}
        {useExclusionRulesOverride && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Products matching ANY of these rules will be excluded from sync.
              </p>
              <Button variant="outline" size="sm" onClick={handleAddRule}>
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </div>

            {exclusionRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Filter className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="font-medium text-sm mb-1">No exclusion rules</h4>
                <p className="text-xs text-muted-foreground max-w-xs mb-3">
                  All products will be synced. Add rules to exclude specific products.
                </p>
                <Button variant="outline" size="sm" onClick={handleAddRule}>
                  <Plus className="h-4 w-4" />
                  Add First Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {exclusionRules.map((rule) => (
                  <Collapsible
                    key={rule.id}
                    open={openRules.has(rule.id)}
                    onOpenChange={() => toggleRuleOpen(rule.id)}
                  >
                    <div className="rounded-xl border bg-card overflow-hidden">
                      {/* Rule Header */}
                      <div className="flex items-center gap-3 p-3">
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
                                    <span className="text-muted-foreground italic">no value set</span>
                                  )}
                                </span>
                                <Badge variant={rule.enabled ? "success" : "secondary"} size="sm">
                                  {rule.enabled ? "Active" : "Disabled"}
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
                            <div className="border-t bg-muted/30 px-3 py-3">
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
                                    placeholder="Select brand..."
                                    searchPlaceholder="Search brands..."
                                    emptyMessage="No brands found"
                                    className="w-[200px]"
                                  />
                                ) : rule.field === "productType" ? (
                                  <Combobox
                                    options={productTypeOptions}
                                    value={rule.value}
                                    onValueChange={(value) =>
                                      handleUpdateRule(rule.id, { value })
                                    }
                                    placeholder="Select product type..."
                                    searchPlaceholder="Search product types..."
                                    emptyMessage="No product types found"
                                    className="w-[200px]"
                                  />
                                ) : rule.field === "tag" ? (
                                  <Combobox
                                    options={tagOptions}
                                    value={rule.value}
                                    onValueChange={(value) =>
                                      handleUpdateRule(rule.id, { value })
                                    }
                                    placeholder="Select tag..."
                                    searchPlaceholder="Search tags..."
                                    emptyMessage="No tags found"
                                    className="w-[200px]"
                                  />
                                ) : (
                                  <Input
                                    value={rule.value}
                                    onChange={(e) =>
                                      handleUpdateRule(rule.id, { value: e.target.value })
                                    }
                                    placeholder={
                                      rule.field === "price" || rule.field === "stock"
                                        ? "e.g., 10.00"
                                        : "e.g., value"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}