"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { BrandingPanel } from "@/components/auth/branding-panel";
import { SupplierInvitePanel } from "@/components/auth/supplier-invite-panel";
import { extractSupplierIdFromUrl } from "@/components/auth/supplier-invite-banner";

function AuthLayoutInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const supplierId = extractSupplierIdFromUrl(redirectUrl);

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <AuthCard>{children}</AuthCard>
      {supplierId ? (
        <SupplierInvitePanel supplierId={supplierId} />
      ) : (
        <BrandingPanel />
      )}
    </div>
  );
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense>
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </Suspense>
  );
}
