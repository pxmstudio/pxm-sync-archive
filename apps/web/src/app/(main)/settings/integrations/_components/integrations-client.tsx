"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, CheckCircle2, Link2, Loader2 } from "lucide-react";
import { useIntegrations } from "@/hooks/use-integrations";
import { ConnectShopifyDialog } from "./connect-shopify-dialog";
import { toast } from "sonner";
import { useTranslation, useLocale } from "@workspace/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ShopifyLogoIcon } from "@workspace/ui/icons/ShopifyLogoIcon";

export function IntegrationsClient() {
  const { t } = useTranslation("settings");
  const { locale } = useLocale();
  const {
    exportIntegrations,
    isLoading,
    error,
    fetchIntegrations,
    disconnectIntegration,
  } = useIntegrations();

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const integration = exportIntegrations[0];
  const isConnected = !!integration;
  const shopDomain = integration?.externalIdentifier;

  const handleDisconnect = useCallback(async () => {
    if (!integration) return;

    setIsDisconnecting(true);
    try {
      await disconnectIntegration(integration.id);
      toast.success(t("integrations.integrationDisconnected"));
    } catch {
      toast.error(t("integrations.failedToDisconnect"));
    } finally {
      setIsDisconnecting(false);
    }
  }, [integration, disconnectIntegration, t]);

  const handleConnected = useCallback(() => {
    setConnectDialogOpen(false);
    toast.success(t("integrations.storeConnected"));
    fetchIntegrations();
  }, [fetchIntegrations, t]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </div>
        <Skeleton className="h-24 w-full max-w-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive">{error.message}</p>
        <button
          onClick={fetchIntegrations}
          className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("integrations.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">{t("integrations.yourStore")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("integrations.yourStoreDescription")}
        </p>
      </div>

      {/* Store Card */}
      {isConnected ? (
        <Card className="max-w-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 p-5">
              {/* Left: Store info */}
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#96bf48]/10">
                  <ShopifyLogoIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{integration.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("integrations.connected")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <a
                      href={`https://${shopDomain}/admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {shopDomain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-sm text-muted-foreground">
                      {t("integrations.since")} {new Date(integration.createdAt).toLocaleDateString(locale, { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Disconnect */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    {t("integrations.disconnect")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("integrations.disconnectStore")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("integrations.disconnectStoreDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDisconnecting}>
                      {t("integrations.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("integrations.disconnect")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-xl border-dashed">
          <CardContent className="py-10">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Link2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">{t("integrations.connectYourStore")}</h3>
              <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                {t("integrations.connectYourStoreDescription")}
              </p>
              <Button className="mt-5" onClick={() => setConnectDialogOpen(true)}>
                <ShopifyLogoIcon className="mr-2 h-4 w-4" />
                {t("integrations.connectShopify")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConnectShopifyDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnected={handleConnected}
      />
    </div>
  );
}
