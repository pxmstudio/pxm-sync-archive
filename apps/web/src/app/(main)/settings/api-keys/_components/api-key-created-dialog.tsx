"use client";

import { useState, useCallback } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import type { ApiKeyCreated } from "@/hooks/use-api-keys";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

interface ApiKeyCreatedDialogProps {
  apiKey: ApiKeyCreated | null;
  onClose: () => void;
}

export function ApiKeyCreatedDialog({ apiKey, onClose }: ApiKeyCreatedDialogProps) {
  const { t } = useTranslation("settings");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!apiKey) return;

    try {
      await navigator.clipboard.writeText(apiKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [apiKey]);

  const handleClose = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={!!apiKey} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("apiKeys.created.title")}</DialogTitle>
          <DialogDescription>
            {t("apiKeys.created.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              {t("apiKeys.created.copyWarning")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("apiKeys.created.yourKey")}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted p-3 text-sm font-mono break-all">
                {apiKey?.key}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">{t("apiKeys.created.usageExample")}</p>
            <code className="mt-2 block text-xs text-muted-foreground">
              curl -H &quot;Authorization: Bearer {apiKey?.prefix}...&quot; \<br />
              &nbsp;&nbsp;https://api.example.com/v1/products
            </code>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>{t("apiKeys.created.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
