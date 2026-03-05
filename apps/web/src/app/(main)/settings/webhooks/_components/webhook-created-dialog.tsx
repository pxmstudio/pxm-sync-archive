"use client";

import { useState, useCallback } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import type { WebhookSubscriptionCreated } from "@/hooks/use-webhooks";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

interface WebhookCreatedDialogProps {
  webhook: WebhookSubscriptionCreated | null;
  onClose: () => void;
}

export function WebhookCreatedDialog({ webhook, onClose }: WebhookCreatedDialogProps) {
  const { t } = useTranslation("settings");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!webhook) return;

    try {
      await navigator.clipboard.writeText(webhook.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [webhook]);

  const handleClose = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={!!webhook} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("webhooks.created.title")}</DialogTitle>
          <DialogDescription>
            {t("webhooks.created.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              {t("webhooks.created.secretWarning")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("webhooks.create.secret")}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted p-3 text-sm font-mono break-all">
                {webhook?.secret}
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

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("webhooks.urlColumn")}</label>
            <code className="block rounded-md bg-muted p-3 text-sm font-mono break-all">
              {webhook?.url}
            </code>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">{t("webhooks.created.verifyingTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("webhooks.created.verifyingDescription")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>{t("webhooks.created.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
