"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import type { WebhookSubscription } from "@/hooks/use-webhooks";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

interface DeleteWebhookDialogProps {
  webhook: WebhookSubscription | null;
  onClose: () => void;
  onConfirm: (webhook: WebhookSubscription) => Promise<void>;
  isLoading: boolean;
}

export function DeleteWebhookDialog({
  webhook,
  onClose,
  onConfirm,
  isLoading,
}: DeleteWebhookDialogProps) {
  const { t } = useTranslation("settings");

  const handleConfirm = async () => {
    if (webhook) {
      await onConfirm(webhook);
    }
  };

  return (
    <Dialog open={!!webhook} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("webhooks.deleteDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("webhooks.deleteDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("webhooks.deleteDialog.description")}
            </AlertDescription>
          </Alert>

          {webhook && (
            <div className="mt-4 rounded-md bg-muted p-3">
              <code className="text-sm break-all">{webhook.url}</code>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t("webhooks.deleteDialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? t("webhooks.deleteDialog.deleting") : t("webhooks.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
