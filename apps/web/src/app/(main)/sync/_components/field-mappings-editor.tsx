"use client";

import { useState, useCallback } from "react";
import {
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import type {
  FieldMapping,
  FieldSyncMode,
  SourceFieldDefinition,
  ShopifyFieldDefinition,
} from "@/hooks/use-field-mappings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

interface FieldMappingsEditorProps {
  fieldMappings: FieldMapping[];
  sourceFields: SourceFieldDefinition[];
  shopifyFields: ShopifyFieldDefinition[];
  defaultMappings: FieldMapping[];
  onSave: (mappings: FieldMapping[]) => Promise<void>;
  isSaving: boolean;
}

export function FieldMappingsEditor({
  fieldMappings,
  sourceFields,
  shopifyFields,
  onSave,
  isSaving,
}: FieldMappingsEditorProps) {
  const { t } = useTranslation("sync");
  const [localMappings, setLocalMappings] = useState<FieldMapping[]>(fieldMappings);
  const [isDirty, setIsDirty] = useState(false);

  const SYNC_MODE_OPTIONS: { value: FieldSyncMode; label: string; description: string }[] = [
    { value: "always", label: t("fieldMappings.syncModes.always"), description: t("fieldMappings.syncModes.alwaysDescription") },
    { value: "createOnly", label: t("fieldMappings.syncModes.createOnly"), description: t("fieldMappings.syncModes.createOnlyDescription") },
    { value: "ifEmpty", label: t("fieldMappings.syncModes.ifEmpty"), description: t("fieldMappings.syncModes.ifEmptyDescription") },
  ];

  // Reset local state when prop changes
  useState(() => {
    setLocalMappings(fieldMappings);
    setIsDirty(false);
  });

  const handleToggleMapping = useCallback((id: string) => {
    setLocalMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
    setIsDirty(true);
  }, []);

  const handleChangeTargetField = useCallback((id: string, targetField: string) => {
    setLocalMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, targetField } : m))
    );
    setIsDirty(true);
  }, []);

  const handleChangeSyncMode = useCallback((id: string, syncMode: FieldSyncMode) => {
    setLocalMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, syncMode } : m))
    );
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    await onSave(localMappings);
    setIsDirty(false);
  }, [localMappings, onSave]);

  const getSourceFieldLabel = (field: string) => {
    const def = sourceFields.find((f) => f.field === field);
    return def?.label || field;
  };

  const getSourceFieldType = (field: string) => {
    const def = sourceFields.find((f) => f.field === field);
    return def?.type || "product";
  };

  // Group mappings by type
  const productMappings = localMappings.filter(
    (m) => getSourceFieldType(m.sourceField) === "product"
  );
  const variantMappings = localMappings.filter(
    (m) => getSourceFieldType(m.sourceField) === "variant"
  );

  const renderMappingRow = (mapping: FieldMapping, fieldType: "product" | "variant") => (
    <TableRow key={mapping.id}>
      <TableCell>
        <Switch
          checked={mapping.enabled}
          onCheckedChange={() => handleToggleMapping(mapping.id)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {getSourceFieldLabel(mapping.sourceField)}
          </span>
          <Badge variant={fieldType === "product" ? "outline" : "secondary"} className="text-xs">
            {fieldType === "product" ? t("fieldMappings.badges.product") : t("fieldMappings.badges.variant")}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {mapping.sourceField}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
      </TableCell>
      <TableCell>
        <Select
          value={mapping.targetField}
          onValueChange={(value) =>
            handleChangeTargetField(mapping.id, value)
          }
          disabled={!mapping.enabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shopifyFields
              .filter((f) => f.type === fieldType)
              .map((field) => (
                <SelectItem key={field.field} value={field.field}>
                  {field.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={mapping.syncMode || "always"}
                  onValueChange={(value) =>
                    handleChangeSyncMode(mapping.id, value as FieldSyncMode)
                  }
                  disabled={!mapping.enabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="font-medium mb-1">{t("fieldMappings.tableHeaders.syncMode")}</p>
              <ul className="text-xs space-y-1">
                <li><strong>{t("fieldMappings.syncModes.always")}:</strong> {t("fieldMappings.syncModes.alwaysDescription")}</li>
                <li><strong>{t("fieldMappings.syncModes.createOnly")}:</strong> {t("fieldMappings.syncModes.createOnlyDescription")}</li>
                <li><strong>{t("fieldMappings.syncModes.ifEmpty")}:</strong> {t("fieldMappings.syncModes.ifEmptyDescription")}</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("fieldMappings.productTitle")}</CardTitle>
          <CardDescription>
            {t("fieldMappings.productDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t("fieldMappings.tableHeaders.active")}</TableHead>
                <TableHead>{t("fieldMappings.tableHeaders.yourField")}</TableHead>
                <TableHead className="w-12 text-center">
                  <ArrowRight className="h-4 w-4 mx-auto" />
                </TableHead>
                <TableHead>{t("fieldMappings.tableHeaders.shopifyField")}</TableHead>
                <TableHead>{t("fieldMappings.tableHeaders.syncMode")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productMappings.map((mapping) => renderMappingRow(mapping, "product"))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("fieldMappings.variantTitle")}</CardTitle>
          <CardDescription>
            {t("fieldMappings.variantDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t("fieldMappings.tableHeaders.active")}</TableHead>
                <TableHead>{t("fieldMappings.tableHeaders.yourField")}</TableHead>
                <TableHead className="w-12 text-center">
                  <ArrowRight className="h-4 w-4 mx-auto" />
                </TableHead>
                <TableHead>{t("fieldMappings.tableHeaders.shopifyField")}</TableHead>
                <TableHead>{t("fieldMappings.tableHeaders.syncMode")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variantMappings.map((mapping) => renderMappingRow(mapping, "variant"))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Save button */}
      {isDirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {t("fieldMappings.saveFieldMappings")}
          </Button>
        </div>
      )}
    </div>
  );
}
