"use client";

import { useState, useRef } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateOrganizationForm() {
  const { t } = useTranslation("auth");
  const { createOrganization, setActive } = useOrganizationList();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(slugify(value));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("organization.selectImageFile"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(t("organization.imageTooLarge"));
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOrganization) return;

    if (!name.trim()) {
      setError(t("organization.organizationNameRequired"));
      return;
    }

    if (!slug.trim()) {
      setError(t("organization.organizationSlugRequired"));
      return;
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      setError(t("organization.slugInvalidFormat"));
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const org = await createOrganization({ name, slug });

      if (logoFile && org.id) {
        try {
          await org.setLogo({ file: logoFile });
        } catch {
          // Logo upload failed but org was created, continue
        }
      }

      await setActive?.({ organization: org });
      router.push("/");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string; code?: string }[] };
      const errorCode = clerkErr?.errors?.[0]?.code;
      if (errorCode === "form_identifier_exists") {
        setError(t("organization.slugAlreadyTaken"));
      } else {
        setError(
          clerkErr?.errors?.[0]?.longMessage ||
            clerkErr?.errors?.[0]?.message ||
            t("organization.failedToCreate")
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("organization.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("organization.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Logo upload */}
        <div className="space-y-2">
          <Label>{t("organization.logoOptional")}</Label>
          {logoPreview ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview}
                alt={t("organization.logoPreview")}
                className="h-16 w-16 rounded-lg object-cover border"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveLogo}
              >
                <X className="mr-1 h-3 w-3" />
                {t("organization.removeLogo")}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <Upload className="h-4 w-4" />
              <div>
                <p>{t("organization.uploadLogo")}</p>
                <p className="text-xs">{t("organization.logoFormats")}</p>
              </div>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-name">{t("organization.organizationName")}</Label>
          <Input
            id="org-name"
            placeholder={t("organization.organizationNamePlaceholder")}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-slug">{t("organization.organizationSlug")}</Label>
          <Input
            id="org-slug"
            placeholder={t("organization.organizationSlugPlaceholder")}
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t("organization.slugDescription")}
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading
            ? t("organization.creatingOrganization")
            : t("organization.continue")}
        </Button>
      </form>
    </div>
  );
}
