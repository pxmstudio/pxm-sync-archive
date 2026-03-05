"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, HelpCircle } from "lucide-react";
import { useIntegrations } from "@/hooks/use-integrations";
import { toast } from "sonner";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

type FormValues = {
  shopDomain: string;
  accessToken: string;
};

interface ConnectShopifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function ConnectShopifyDialog({
  open,
  onOpenChange,
  onConnected,
}: ConnectShopifyDialogProps) {
  const { t } = useTranslation("settings");
  const { connectShopify } = useIntegrations();
  const [isConnecting, setIsConnecting] = useState(false);

  const formSchema = useMemo(
    () =>
      z.object({
        shopDomain: z
          .string()
          .min(1, t("integrations.shopify.domainRequired"))
          .refine(
            (val) => {
              const domain = val.trim().toLowerCase();
              if (domain.includes(".myshopify.com")) {
                return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(domain);
              }
              return /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(domain);
            },
            { message: t("integrations.shopify.invalidDomain") }
          ),
        accessToken: z.string().min(1, t("integrations.shopify.tokenRequired")),
      }),
    [t]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      shopDomain: "",
      accessToken: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsConnecting(true);
    try {
      await connectShopify({
        shopDomain: values.shopDomain,
        accessToken: values.accessToken,
      });
      reset();
      onConnected();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("integrations.shopify.failedToConnect");
      toast.error(message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("integrations.shopify.connectTitle")}</DialogTitle>
          <DialogDescription>
            {t("integrations.shopify.connectDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shopDomain">{t("integrations.shopify.shopDomain")}</Label>
            <div className="flex items-center">
              <Input
                id="shopDomain"
                placeholder={t("integrations.shopify.shopDomainPlaceholder")}
                {...register("shopDomain")}
                className="rounded-r-none"
              />
              <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                .myshopify.com
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("integrations.shopify.shopDomainHelp")}
            </p>
            {errors.shopDomain && (
              <p className="text-sm text-destructive">{errors.shopDomain.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessToken" className="flex items-center gap-1.5">
              {t("integrations.shopify.accessToken")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      {t("integrations.shopify.accessTokenTooltip")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              id="accessToken"
              type="password"
              placeholder={t("integrations.shopify.accessTokenPlaceholder")}
              {...register("accessToken")}
            />
            {errors.accessToken && (
              <p className="text-sm text-destructive">{errors.accessToken.message}</p>
            )}
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">{t("integrations.shopify.requiredScopes")}</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              <li>write_products</li>
              <li>write_inventory</li>
              <li>read_locations</li>
              <li>read_shipping</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isConnecting}
            >
              {t("integrations.cancel")}
            </Button>
            <Button type="submit" disabled={isConnecting}>
              {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("integrations.connectStore")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
