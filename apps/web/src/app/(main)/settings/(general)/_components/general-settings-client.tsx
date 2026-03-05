"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useOrganization as useClerkOrganization } from "@clerk/nextjs";
import {
  AlertCircle,
  Building2,
  Check,
  Upload,
  X,
  Copy,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { useOrganization } from "@/hooks/use-organization";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";

export function GeneralSettingsClient() {
  const { t } = useTranslation("settings");

  // Clerk organization for name/logo (synced with sidebar)
  const { organization: clerkOrg, isLoaded: clerkLoaded } = useClerkOrganization();

  // Database organization for ID and other fields
  const { organization: dbOrg, isLoading: dbLoading, isSaving, error, updateOrganization } =
    useOrganization();

  const logoUpload = useFileUpload({
    purpose: "organization-logo",
    maxSizeMb: 2,
    allowedTypes: ["image/*"],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Organization details
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isSavingClerk, setIsSavingClerk] = useState(false);
  const [clerkError, setClerkError] = useState<string | null>(null);

  // Initialize from Clerk organization (source of truth for name/logo)
  useEffect(() => {
    if (clerkOrg) {
      setName(clerkOrg.name || "");
      setSlug(clerkOrg.slug || "");
      setLogoUrl(clerkOrg.imageUrl || null);
    }
  }, [clerkOrg]);

  useEffect(() => {
    if (clerkOrg) {
      const changed =
        name !== (clerkOrg.name || "") ||
        logoUrl !== (clerkOrg.imageUrl || null);
      setHasChanges(changed);
    }
  }, [name, logoUrl, clerkOrg]);

  const handleSave = async () => {
    if (!clerkOrg) return;

    setSaveSuccess(false);
    setClerkError(null);
    setIsSavingClerk(true);

    try {
      // Update Clerk organization (this updates the sidebar)
      await clerkOrg.update({
        name: name,
      });

      // If logo changed, update it in Clerk
      if (logoUrl !== clerkOrg.imageUrl) {
        if (logoUrl) {
          // Fetch the image and upload to Clerk
          const response = await fetch(logoUrl);
          const blob = await response.blob();
          const file = new File([blob], "logo.png", { type: blob.type });
          await clerkOrg.setLogo({ file });
        } else {
          // Remove logo
          await clerkOrg.setLogo({ file: null });
        }
      }

      // Also update in database for consistency
      await updateOrganization({
        name: name || undefined,
        logoUrl: logoUrl,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setClerkError(err instanceof Error ? err.message : t("general.failedToUpdate"));
    } finally {
      setIsSavingClerk(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await logoUpload.upload(file);
    if (result) {
      setLogoUrl(result.url);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
  };

  const handleCopyId = async () => {
    if (!dbOrg?.id) return;
    await navigator.clipboard.writeText(dbOrg.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isLoading = !clerkLoaded || dbLoading;
  const isSavingAny = isSaving || isSavingClerk;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo upload skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="flex items-start gap-4">
                <Skeleton className="h-24 w-24 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </div>
            {/* Name and slug inputs skeleton */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            {/* Organization ID skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-10" />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Save button skeleton */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{t("general.organizationDetails")}</CardTitle>
              <CardDescription>
                {t("general.basicInfo")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>{t("general.organizationLogo")}</Label>
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "relative flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 overflow-hidden",
                  logoUpload.isUploading && "opacity-50"
                )}
              >
                {logoUrl ? (
                  <>
                    <Image
                      src={logoUrl}
                      alt="Organization logo"
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
                {logoUpload.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUpload.isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t("general.uploadLogo")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("general.logoRecommendation")}
                </p>
                {logoUpload.error && (
                  <p className="text-xs text-destructive">{logoUpload.error}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("general.organizationName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t("general.slug")}</Label>
              <Input
                id="slug"
                value={slug}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
          </div>

          {/* Organization ID */}
          <div className="space-y-2">
            <Label htmlFor="orgId">{t("general.organizationId")}</Label>
            <div className="flex gap-2">
              <Input
                id="orgId"
                value={dbOrg?.id || ""}
                disabled
                className="bg-muted cursor-not-allowed font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyId}
                className="shrink-0"
              >
                {copiedId ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {(error || clerkError) && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {clerkError || error?.message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {saveSuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t("general.settingsSaved")}
            </p>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSavingAny || !hasChanges}>
          {isSavingAny ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("general.saving")}
            </>
          ) : (
            t("general.saveChanges")
          )}
        </Button>
      </div>
    </div>
  );
}
