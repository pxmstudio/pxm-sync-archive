"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import type { ApiKey } from "@/hooks/use-api-keys";
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

interface RevokeApiKeyDialogProps {
  apiKey: ApiKey | null;
  onClose: () => void;
  onConfirm: (key: ApiKey) => Promise<void>;
  isLoading: boolean;
}

export function RevokeApiKeyDialog({
  apiKey,
  onClose,
  onConfirm,
  isLoading,
}: RevokeApiKeyDialogProps) {
  const { t } = useTranslation("settings");

  const handleConfirm = async () => {
    if (apiKey) {
      await onConfirm(apiKey);
    }
  };

  return (
    <Dialog open={!!apiKey} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("apiKeys.revokeDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("apiKeys.revokeDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("apiKeys.revokeDialog.description")}
            </AlertDescription>
          </Alert>

          {apiKey && (
            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-sm font-medium">{apiKey.name}</p>
              <code className="text-xs text-muted-foreground">
                {apiKey.prefix}...
              </code>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t("apiKeys.revokeDialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? t("apiKeys.revokeDialog.revoking") : t("apiKeys.revokeKey")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
