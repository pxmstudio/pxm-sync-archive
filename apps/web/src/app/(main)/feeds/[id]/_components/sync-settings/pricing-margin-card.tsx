"use client";

import { DollarSign, Percent, Info, Plus, Trash2, ArrowRight, ChevronDown, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useSyncSettingsContext } from "./context";
import { useStore } from "@/hooks/use-store";
import type { MarginCondition } from "./types";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
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

/**
 * Render a settings card for configuring pricing margins, including an optional feed-level override, a default margin, and conditional margin rules.
 *
 * When the override is enabled the card exposes controls to enable and edit a default margin and to add, edit, or remove conditional rules; when disabled it shows the active global margin summary.
 *
 * @returns A JSX element containing the Pricing Margin settings UI
 */
export function PricingMarginCard() {
  const {
    pricingMargin,
    setPricingMargin,
    usePricingOverride,
    setUsePricingOverride,
    globalSyncSettings,
    openMarginRules,
    addMarginRule,
    removeMarginRule,
    updateMarginRule,
    toggleMarginRuleOpen,
    setIsDirty,
  } = useSyncSettingsContext();

  // Get currency symbol from store data (cached via React Query)
  const { currencySymbol } = useStore();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing Margin
              {usePricingOverride && (
                <Badge variant="secondary" className="ml-2">Override</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Apply markup on supplier prices when syncing to your store.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Override Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Override Global Settings</Label>
            <p className="text-sm text-muted-foreground">
              {usePricingOverride
                ? "Using custom margin for this feed"
                : "Using global margin settings"}
              {!usePricingOverride && (
                <Link
                  href="/sync"
                  className="ml-1 text-primary hover:underline"
                >
                  Edit global settings
                </Link>
              )}
            </p>
          </div>
          <Switch
            checked={usePricingOverride}
            onCheckedChange={(checked) => {
              setUsePricingOverride(checked);
              if (!checked) {
                // Reset to global settings
                setPricingMargin(
                  globalSyncSettings?.pricingMargin || {
                    defaultMargin: null,
                    rules: [],
                  }
                );
              }
              setIsDirty(true);
            }}
          />
        </div>

        {/* Show global settings info when not overriding */}
        {!usePricingOverride && globalSyncSettings?.pricingMargin?.defaultMargin && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <strong>Global margin active:</strong>{" "}
                {globalSyncSettings.pricingMargin.defaultMargin.type === "percentage"
                  ? `+${globalSyncSettings.pricingMargin.defaultMargin.value}%`
                  : `+${currencySymbol}${globalSyncSettings.pricingMargin.defaultMargin.value}`}
                {globalSyncSettings.pricingMargin.rules.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({globalSyncSettings.pricingMargin.rules.length} conditional rules)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Only show margin editing when using override */}
        {usePricingOverride && (
          <>
            {/* Default Margin Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Enable Default Margin</Label>
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
                              Percentage
                            </span>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <span className="flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5" />
                              Fixed
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

            {/* Margin Rules */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Conditional Margin Rules</Label>
                  <p className="text-sm text-muted-foreground">
                    Set different margins based on brand, type, or price
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addMarginRule}>
                  <Plus className="h-4 w-4" />
                  Add Rule
                </Button>
              </div>

              {pricingMargin.rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Layers className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No margin rules. All products will use the default margin.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pricingMargin.rules.map((rule, index) => (
                    <Collapsible
                      key={rule.id}
                      open={openMarginRules.has(rule.id)}
                      onOpenChange={() => toggleMarginRuleOpen(rule.id)}
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
                                      <span className="text-muted-foreground italic">no value</span>
                                    )}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <Badge variant="secondary">
                                    {rule.marginType === "percentage"
                                      ? `+${rule.marginValue}%`
                                      : `+${currencySymbol}${rule.marginValue}`}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Priority {index + 1}
                                  </Badge>
                                </div>
                              </div>
                              <motion.div
                                animate={{ rotate: openMarginRules.has(rule.id) ? 180 : 0 }}
                                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                              >
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </motion.div>
                            </button>
                          </CollapsibleTrigger>
                        </div>

                        {/* Rule Content */}
                        <AnimatePresence initial={false}>
                          {openMarginRules.has(rule.id) && (
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
                                    Margin
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
                                        <SelectItem value="percentage">Percentage</SelectItem>
                                        <SelectItem value="fixed">Fixed</SelectItem>
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
                                    Condition
                                  </Label>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm">When</span>
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
                                        <SelectItem value="brand">Brand</SelectItem>
                                        <SelectItem value="productType">Product Type</SelectItem>
                                        <SelectItem value="tag">Tag</SelectItem>
                                        <SelectItem value="sku">SKU</SelectItem>
                                        <SelectItem value="price">Price</SelectItem>
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
                                        <SelectItem value="equals">equals</SelectItem>
                                        <SelectItem value="notEquals">not equals</SelectItem>
                                        <SelectItem value="contains">contains</SelectItem>
                                        <SelectItem value="greaterThan">greater than</SelectItem>
                                        <SelectItem value="lessThan">less than</SelectItem>
                                        {["price", "compareAtPrice", "costPrice"].includes(rule.conditions[0]?.field || "") && (
                                          <SelectItem value="between">between</SelectItem>
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
                                    ) : (
                                      <Input
                                        value={String(rule.conditions[0]?.value || "")}
                                        onChange={(e) => {
                                          const currentCondition = rule.conditions[0] || {
                                            field: "brand",
                                            operator: "equals",
                                            value: "",
                                          };
                                          const isNumeric = ["price", "compareAtPrice", "costPrice"].includes(
                                            currentCondition.field
                                          );
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
                                        placeholder="Value"
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
                                    Remove Rule
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

            {/* Example calculation */}
            {pricingMargin.defaultMargin && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground font-medium">Example:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-muted-foreground">{currencySymbol}100</span>
                    <span className="text-muted-foreground">+</span>
                    <span className="text-muted-foreground">
                      {pricingMargin.defaultMargin.value}
                      {pricingMargin.defaultMargin.type === "percentage" ? "%" : currencySymbol}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-semibold text-base">
                      {currencySymbol}
                      {pricingMargin.defaultMargin.type === "percentage"
                        ? (100 * (1 + pricingMargin.defaultMargin.value / 100)).toFixed(2)
                        : (100 + pricingMargin.defaultMargin.value).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}