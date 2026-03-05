"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp";

type Step = "email" | "code" | "password";

export function ForgotPasswordForm() {
  const { t } = useTranslation("auth");
  const { signIn } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;

    try {
      setIsLoading(true);
      setError("");

      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });

      setStep("code");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          t("forgotPassword.failedToSend")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;

    try {
      setIsLoading(true);
      setError("");

      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });

      if (result.status === "needs_new_password") {
        setStep("password");
      } else {
        setError(t("forgotPassword.verificationIncomplete"));
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          t("forgotPassword.verificationFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;

    if (password !== confirmPassword) {
      setError(t("forgotPassword.passwordsDoNotMatch"));
      return;
    }

    if (password.length < 8) {
      setError(t("forgotPassword.passwordTooShort"));
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const result = await signIn.resetPassword({ password });

      if (result.status === "complete") {
        router.push("/sign-in");
      } else {
        setError(t("forgotPassword.passwordResetIncomplete"));
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          t("forgotPassword.passwordResetFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "code") {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("forgotPassword.checkEmail")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("forgotPassword.enterCodeSentTo")}{" "}
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || code.length < 6}>
            {isLoading ? t("forgotPassword.verifying") : t("forgotPassword.verifyCode")}
          </Button>
        </form>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
          >
            {t("forgotPassword.useDifferentEmail")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "password") {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("forgotPassword.setNewPassword")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("forgotPassword.enterNewPassword")}
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">{t("forgotPassword.newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              {t("forgotPassword.passwordRequirements")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("forgotPassword.confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? t("forgotPassword.resettingPassword")
              : t("forgotPassword.resetPassword")}
          </Button>
        </form>
      </div>
    );
  }

  // Step: email (default)
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("forgotPassword.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("forgotPassword.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSendCode} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{t("forgotPassword.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("forgotPassword.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading
            ? t("forgotPassword.sendingCode")
            : t("forgotPassword.sendResetCode")}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/sign-in"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("forgotPassword.backToSignIn")}
        </Link>
      </div>
    </div>
  );
}
