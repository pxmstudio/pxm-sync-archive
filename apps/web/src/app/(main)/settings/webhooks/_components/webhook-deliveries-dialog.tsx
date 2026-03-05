"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  useWebhookDeliveries,
  type WebhookSubscription,
} from "@/hooks/use-webhooks";
import { useTranslation, useLocale } from "@workspace/i18n";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

function formatDateTime(dateString: string, locale: string) {
  return new Date(dateString).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WebhookDeliveriesDialog({
  webhook,
  onClose,
}: {
  webhook: WebhookSubscription | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("settings");
  const { locale } = useLocale();
  const { deliveries, isLoading, fetchDeliveries } = useWebhookDeliveries();

  useEffect(() => {
    if (webhook) {
      fetchDeliveries(webhook.id);
    }
  }, [webhook, fetchDeliveries]);

  return (
    <Dialog open={!!webhook} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("webhooks.deliveries.title")}</DialogTitle>
          <DialogDescription>
            {t("webhooks.deliveries.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {t("webhooks.deliveries.noDeliveries")}
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("webhooks.deliveries.statusColumn")}</TableHead>
                    <TableHead>{t("webhooks.deliveries.event")}</TableHead>
                    <TableHead>{t("webhooks.statusColumn")}</TableHead>
                    <TableHead>{t("webhooks.deliveries.responseTime")}</TableHead>
                    <TableHead>{t("webhooks.deliveries.timestamp")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>
                        {delivery.success ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">{t("webhooks.deliveries.succeeded")}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">{t("webhooks.deliveries.failed")}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {delivery.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {delivery.statusCode ? (
                          <code className="text-xs">{delivery.statusCode}</code>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        {delivery.errorMessage && (
                          <p className="text-xs text-red-600 mt-0.5">
                            {delivery.errorMessage}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {delivery.responseTimeMs ? (
                          <span className="text-xs text-muted-foreground">
                            {delivery.responseTimeMs}{t("webhooks.deliveries.ms")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(delivery.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t("webhooks.deliveries.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
