"use client";

import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "@workspace/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787/api";

interface SupplierInfo {
  name: string;
  logoUrl: string | null;
  description: string | null;
}

interface SupplierInviteBannerProps {
  supplierId: string;
}

export function SupplierInviteBanner({ supplierId }: SupplierInviteBannerProps) {
  const { t } = useTranslation("auth");
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSupplier() {
      try {
        const response = await fetch(`${API_URL}/public/suppliers/${supplierId}`);
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

  if (isLoading || !supplier) {
    return null;
  }

  return (
    <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
      <div className="flex items-center gap-4">
        {/* Supplier Logo */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-card border shadow-sm overflow-hidden">
          {supplier.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={supplier.logoUrl}
              alt={supplier.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {t("supplierInvite.joinWholesaleProgram", { supplierName: supplier.name })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {t("supplierInvite.supplierUsingPxm", { supplierName: supplier.name })}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Extracts supplier ID from a redirect URL if it points to a supplier page
 * @param redirectUrl - The full redirect URL
 * @returns The supplier ID or null if not a supplier page
 */
export function extractSupplierIdFromUrl(redirectUrl: string | null): string | null {
  if (!redirectUrl) return null;

  try {
    const url = new URL(redirectUrl);
    const pathname = url.pathname;

    // Match patterns like /suppliers/org_xxx or /retailer/suppliers/org_xxx
    const match = pathname.match(/\/suppliers\/(org_[a-z0-9]+)/i);

    if (match && match[1]) {
      return match[1];
    }

    return null;
  } catch {
    // If URL parsing fails, try a simple regex on the string
    const match = redirectUrl.match(/\/suppliers\/(org_[a-z0-9]+)/i);
    return match?.[1] || null;
  }
}
