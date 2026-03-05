"use client";

import { useState, useEffect } from "react";
import { Building2, ShoppingBag, Zap, Shield } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { Skeleton } from "@workspace/ui/components/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787/api";

interface SupplierInfo {
  name: string;
  logoUrl: string | null;
  description: string | null;
}

interface SupplierInvitePanelProps {
  supplierId: string;
}

export function SupplierInvitePanel({ supplierId }: SupplierInvitePanelProps) {
  const { t } = useTranslation("auth");
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSupplier() {
      try {
        const response = await fetch(
          `${API_URL}/public/suppliers/${supplierId}`
        );
        const data = (await response.json()) as {
          success: boolean;
          data?: SupplierInfo;
        };

        if (data.success && data.data) {
          setSupplier(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch supplier info:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (supplierId) {
      fetchSupplier();
    }
  }, [supplierId]);

  if (isLoading) {
    return (
      <div className="relative flex flex-col bg-muted overflow-hidden order-first md:order-last">
        {/* Loading skeleton */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <Skeleton className="h-24 w-24 rounded-2xl" />
          <div className="space-y-2 text-center">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return null;
  }

  return (
    <div className="relative flex flex-col bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 overflow-hidden order-first md:order-last min-h-[280px] md:min-h-0">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Gradient orbs for depth */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-6 md:p-8 text-white">
        {/* Supplier Logo */}
        <div className="relative mb-4 md:mb-6">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/30 rounded-xl md:rounded-2xl blur-xl scale-110" />

          {/* Logo container */}
          <div className="relative h-16 w-16 md:h-24 md:w-24 rounded-xl md:rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center overflow-hidden shadow-2xl">
            {supplier.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={supplier.logoUrl}
                alt={supplier.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-8 w-8 md:h-12 md:w-12 text-white/70" />
            )}
          </div>
        </div>

        {/* Supplier name and invitation */}
        <div className="text-center space-y-3 mb-8">
          <p className="text-primary/80 text-sm font-medium tracking-wide uppercase">
            {t("supplierInvite.youAreInvited")}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {supplier.name}
          </h2>
          <p className="text-white/60 text-sm md:max-w-[260px] leading-relaxed">
            {t("supplierInvite.joinWholesaleDescription")}
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-4 md:grid-cols-1 md:gap-3 w-full md:max-w-[240px]">
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-3 text-white/70">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="text-xs md:text-sm text-center md:text-left">
              {t("supplierInvite.benefitWholesalePricing")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-3 text-white/70">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-xs md:text-sm text-center md:text-left">
              {t("supplierInvite.benefitDirectOrdering")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-3 text-white/70">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-xs md:text-sm text-center md:text-left">
              {t("supplierInvite.benefitSecurePayments")}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-900/80 to-transparent pointer-events-none" />
    </div>
  );
}
