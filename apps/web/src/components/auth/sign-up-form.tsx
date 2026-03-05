"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { OAuthButton } from "./oauth-button";
import { VerifyEmailForm } from "./verify-email-form";
import { SupplierInviteBanner } from "./supplier-invite-banner";
import { extractSupplierIdFromUrl } from "./supplier-invite-banner";

export function SignUpForm() {
  const { t } = useTranslation("auth");
  const { signUp } = useSignUp();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const supplierId = extractSupplierIdFromUrl(redirectUrl);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showVerify, setShowVerify] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    try {
      setIsLoading(true);
      setError("");

      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setShowVerify(true);
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          t("signUp.signUpFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (showVerify) {
    return (
      <VerifyEmailForm
        emailAddress={email}
        onBack={() => setShowVerify(false)}
      />
    );
  }

  const signInHref = redirectUrl
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/sign-in";

  return (
    <div className="space-y-6">
      {supplierId && <SupplierInviteBanner supplierId={supplierId} />}

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("signUp.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {supplierId ? t("signUp.subtitleSupplier") : t("signUp.subtitle")}
        </p>
      </div>

      <OAuthButton mode="signUp" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("signUp.or")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first-name">{t("signUp.firstName")}</Label>
            <Input
              id="first-name"
              placeholder={t("signUp.firstNamePlaceholder")}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">{t("signUp.lastName")}</Label>
            <Input
              id="last-name"
              placeholder={t("signUp.lastNamePlaceholder")}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("signUp.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("signUp.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("signUp.password")}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("signUp.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t("signUp.hidePassword") : t("signUp.showPassword")}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("signUp.passwordRequirements")}
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("signUp.creatingAccount") : t("signUp.continue")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("signUp.haveAccount")}{" "}
        <Link href={signInHref} className="text-primary hover:underline">
          {t("signUp.signIn")}
        </Link>
      </p>
    </div>
  );
}
