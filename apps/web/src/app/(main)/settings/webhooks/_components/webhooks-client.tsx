"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Webhook,
  MoreHorizontal,
  Trash2,
  Edit,
  Play,
  History,
  AlertTriangle,
} from "lucide-react";
import {
  useWebhooks,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  type WebhookSubscription,
  type WebhookSubscriptionCreated,
} from "@/hooks/use-webhooks";
import { CreateWebhookDialog } from "./create-webhook-dialog";
import { WebhookCreatedDialog } from "./webhook-created-dialog";
import { EditWebhookDialog } from "./edit-webhook-dialog";
import { DeleteWebhookDialog } from "./delete-webhook-dialog";
import { WebhookDeliveriesDialog } from "./webhook-deliveries-dialog";
import { toast } from "sonner";
import { useTranslation, useLocale } from "@workspace/i18n";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Switch } from "@workspace/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

function truncateUrl(url: string, maxLength = 40) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + "...";
}

function formatDate(dateString: string, locale: string) {
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Render the Webhooks settings UI for viewing, creating, editing, testing, and deleting webhook subscriptions.
 *
 * Shows loading skeletons while webhooks load; displays an upgrade prompt when webhooks are unavailable; shows an error message with a retry action on failure; lists existing webhooks with controls to toggle active state, send a test, view deliveries, edit, and delete; and manages the related create/edit/delete/deliveries dialogs and success/error toasts for operations.
 *
 * @returns A JSX.Element containing the webhooks management interface.
 */
export function WebhooksClient() {
  const { t } = useTranslation("settings");
  const { locale } = useLocale();

  const { webhooks, isLoading: isLoadingWebhooks, error, fetchWebhooks } = useWebhooks();
  const { updateWebhook, isLoading: isUpdating } = useUpdateWebhook();
  const { deleteWebhook, isLoading: isDeleting } = useDeleteWebhook();
  const { testWebhook, isLoading: isTesting } = useTestWebhook();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<WebhookSubscriptionCreated | null>(null);
  const [webhookToEdit, setWebhookToEdit] = useState<WebhookSubscription | null>(null);
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookSubscription | null>(null);
  const [webhookForDeliveries, setWebhookForDeliveries] = useState<WebhookSubscription | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreated = useCallback(
    (webhook: WebhookSubscriptionCreated) => {
      setCreatedWebhook(webhook);
      setCreateDialogOpen(false);
      fetchWebhooks();
    },
    [fetchWebhooks]
  );

  const handleToggleActive = useCallback(
    async (webhook: WebhookSubscription) => {
      try {
        await updateWebhook(webhook.id, { isActive: !webhook.isActive });
        fetchWebhooks();
        toast.success(webhook.isActive ? t("webhooks.webhookDisabled") : t("webhooks.webhookEnabled"));
      } catch {
        toast.error(t("webhooks.failedToUpdate"));
      }
    },
    [updateWebhook, fetchWebhooks, t]
  );

  const handleEdit = useCallback(
    async (id: string, data: { url?: string; eventTypes?: string[] }) => {
      await updateWebhook(id, data as Parameters<typeof updateWebhook>[1]);
      setWebhookToEdit(null);
      fetchWebhooks();
      toast.success(t("webhooks.webhookUpdated"));
    },
    [updateWebhook, fetchWebhooks, t]
  );

  const handleDelete = useCallback(
    async (webhook: WebhookSubscription) => {
      await deleteWebhook(webhook.id);
      setWebhookToDelete(null);
      fetchWebhooks();
      toast.success(t("webhooks.webhookDeleted"));
    },
    [deleteWebhook, fetchWebhooks, t]
  );

  const handleTest = useCallback(
    async (webhook: WebhookSubscription) => {
      setTestingId(webhook.id);
      try {
        const result = await testWebhook(webhook.id);
        if (result.delivered) {
          toast.success(t("webhooks.testDelivered", { statusCode: result.statusCode ?? 0, responseTime: result.responseTimeMs }));
        } else {
          toast.error(t("webhooks.testFailed"));
        }
      } catch {
        toast.error(t("webhooks.failedToSendTest"));
      } finally {
        setTestingId(null);
      }
    },
    [testWebhook, t]
  );

  // Show loading state while loading webhooks
  if (isLoadingWebhooks) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive">{error.message}</p>
        <button
          onClick={fetchWebhooks}
          className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("webhooks.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("webhooks.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("webhooks.upgrade.subtitle")}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("webhooks.addWebhook")}
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <Webhook className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-semibold">{t("webhooks.noWebhooks")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("webhooks.noWebhooksDescription")}
          </p>
          <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("webhooks.addWebhook")}
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("webhooks.urlColumn")}</TableHead>
                <TableHead>{t("webhooks.eventsColumn")}</TableHead>
                <TableHead>{t("webhooks.statusColumn")}</TableHead>
                <TableHead>{t("webhooks.createdColumn")}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm">{truncateUrl(webhook.url)}</code>
                      {Number(webhook.failureCount) > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">{t("webhooks.failures", { count: webhook.failureCount ?? 0 })}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {webhook.eventTypes.slice(0, 2).map((type) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                      {webhook.eventTypes.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{webhook.eventTypes.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={webhook.isActive}
                        onCheckedChange={() => handleToggleActive(webhook)}
                        disabled={isUpdating}
                      />
                      <span className="text-sm text-muted-foreground">
                        {webhook.isActive ? t("webhooks.active") : t("webhooks.inactive")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(webhook.createdAt, locale)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setWebhookToEdit(webhook)}>
                          <Edit className="mr-2 h-4 w-4" />
                          {t("webhooks.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTest(webhook)}
                          disabled={testingId === webhook.id || isTesting}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          {testingId === webhook.id ? t("webhooks.sending") : t("webhooks.sendTest")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setWebhookForDeliveries(webhook)}>
                          <History className="mr-2 h-4 w-4" />
                          {t("webhooks.viewDeliveries")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setWebhookToDelete(webhook)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("webhooks.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateWebhookDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleCreated}
      />

      <WebhookCreatedDialog
        webhook={createdWebhook}
        onClose={() => setCreatedWebhook(null)}
      />

      <EditWebhookDialog
        webhook={webhookToEdit}
        onClose={() => setWebhookToEdit(null)}
        onSave={handleEdit}
        isLoading={isUpdating}
      />

      <DeleteWebhookDialog
        webhook={webhookToDelete}
        onClose={() => setWebhookToDelete(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      <WebhookDeliveriesDialog
        webhook={webhookForDeliveries}
        onClose={() => setWebhookForDeliveries(null)}
      />
    </div>
  );
}