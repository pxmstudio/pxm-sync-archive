"use client";

import { useState, useCallback, useMemo } from "react";
import { Lock } from "lucide-react";
import { useCreateApiKey, type ApiKeyCreated } from "@/hooks/use-api-keys";
import { useTranslation } from "@workspace/i18n";
import type { ApiScope } from "@workspace/validators/api-keys";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: ApiKeyCreated) => void;
  hasFullAccess: boolean;
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreated,
  hasFullAccess,
}: CreateApiKeyDialogProps) {
  const { t } = useTranslation("settings");
  const { createKey, isLoading, error } = useCreateApiKey();
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([]);

  const AVAILABLE_SCOPES = useMemo(
    () => [
      { scope: "catalog:read" as ApiScope, label: t("apiKeys.scopes.catalog"), description: t("apiKeys.scopes.catalogDesc") },
      { scope: "products:read" as ApiScope, label: t("apiKeys.scopes.products"), description: t("apiKeys.scopes.productsDesc"), proOnly: true },
      { scope: "inventory:read" as ApiScope, label: t("apiKeys.scopes.inventory"), description: t("apiKeys.scopes.inventoryDesc"), proOnly: true },
      { scope: "orders:read" as ApiScope, label: t("apiKeys.scopes.ordersRead"), description: t("apiKeys.scopes.ordersReadDesc"), proOnly: true },
      { scope: "orders:write" as ApiScope, label: t("apiKeys.scopes.ordersWrite"), description: t("apiKeys.scopes.ordersWriteDesc"), proOnly: true },
      { scope: "connections:read" as ApiScope, label: t("apiKeys.scopes.connections"), description: t("apiKeys.scopes.connectionsDesc"), proOnly: true },
      { scope: "webhooks:read" as ApiScope, label: t("apiKeys.scopes.webhooksRead"), description: t("apiKeys.scopes.webhooksReadDesc"), proOnly: true },
      { scope: "webhooks:write" as ApiScope, label: t("apiKeys.scopes.webhooksWrite"), description: t("apiKeys.scopes.webhooksWriteDesc"), proOnly: true },
    ],
    [t]
  );

  const handleScopeToggle = useCallback((scope: ApiScope, checked: boolean) => {
    setSelectedScopes((prev) =>
      checked ? [...prev, scope] : prev.filter((s) => s !== scope)
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim() || selectedScopes.length === 0) return;

      try {
        const key = await createKey({
          name: name.trim(),
          scopes: selectedScopes,
        });
        onCreated(key);
        setName("");
        setSelectedScopes([]);
      } catch {
        // Error is handled by the hook
      }
    },
    [name, selectedScopes, createKey, onCreated]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setName("");
        setSelectedScopes([]);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.create.title")}</DialogTitle>
            <DialogDescription>
              {t("apiKeys.create.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("apiKeys.create.name")}</Label>
              <Input
                id="name"
                placeholder={t("apiKeys.create.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("apiKeys.create.scopes")}</Label>
              <div className="space-y-3 rounded-md border p-3">
                {AVAILABLE_SCOPES.map(({ scope, label, description, proOnly }) => {
                  const isDisabled = isLoading || (proOnly && !hasFullAccess);
                  return (
                    <div key={scope} className={`flex items-start space-x-3 ${isDisabled && !isLoading ? "opacity-60" : ""}`}>
                      <Checkbox
                        id={scope}
                        checked={selectedScopes.includes(scope)}
                        onCheckedChange={(checked) =>
                          handleScopeToggle(scope, checked === true)
                        }
                        disabled={isDisabled}
                      />
                      <div className="grid gap-1 leading-none">
                        <label
                          htmlFor={scope}
                          className={`text-sm font-medium ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {label}
                          {proOnly && !hasFullAccess && (
                            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                              <Lock className="h-2.5 w-2.5 mr-1" />
                              Growth+
                            </Badge>
                          )}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {t("apiKeys.create.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim() || selectedScopes.length === 0}
            >
              {isLoading ? t("apiKeys.create.creating") : t("apiKeys.createKey")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
