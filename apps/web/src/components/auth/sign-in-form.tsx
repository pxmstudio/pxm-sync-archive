"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { OAuthButton } from "./oauth-button";
import { TwoFactorForm } from "./two-factor-form";
import { SupplierInviteBanner } from "./supplier-invite-banner";
import { extractSupplierIdFromUrl } from "./supplier-invite-banner";

export function SignInForm() {
  const { t } = useTranslation("auth");
  const { signIn, setActive } = useSignIn();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const supplierId = extractSupplierIdFromUrl(redirectUrl);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;

    try {
      setIsLoading(true);
      setError("");

      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        router.push("/");
      } else if (result.status === "needs_second_factor") {
        setShowTwoFactor(true);
      } else {
        setError(t("signIn.signInIncomplete"));
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          t("signIn.signInFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (showTwoFactor) {
    return <TwoFactorForm onBack={() => setShowTwoFactor(false)} />;
  }

  const signUpHref = redirectUrl
    ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/sign-up";

  return (
    <div className="space-y-6">
      {supplierId && <SupplierInviteBanner supplierId={supplierId} />}

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("signIn.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {supplierId ? t("signIn.subtitleSupplier") : t("signIn.subtitle")}
        </p>
      </div>

      <OAuthButton mode="signIn" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("signIn.orContinueWith")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{t("signIn.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("signIn.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("signIn.password")}</Label>
            <Link
              href="/sign-in/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("signIn.forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("signIn.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t("signIn.hidePassword") : t("signIn.showPassword")}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("signIn.signingIn") : t("signIn.signIn")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("signIn.noAccount")}{" "}
        <Link href={signUpHref} className="text-primary hover:underline">
          {t("signIn.signUp")}
        </Link>
      </p>
    </div>
  );
}
