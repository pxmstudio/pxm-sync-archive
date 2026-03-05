"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp";

interface VerifyEmailFormProps {
  emailAddress: string;
  onBack: () => void;
}

export function VerifyEmailForm({ emailAddress, onBack }: VerifyEmailFormProps) {
  const { t } = useTranslation("auth");
  const { signUp, setActive } = useSignUp();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;

    try {
      setIsLoading(true);
      setError("");

      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        router.push("/");
      } else {
        setError(t("verify.verificationFailed"));
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          t("verify.verificationFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUp) return;

    try {
      setIsResending(true);
      setError("");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch {
      setError(t("verify.failedToResend"));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("verify.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("verify.subtitle")}{" "}
          <span className="font-medium text-foreground">{emailAddress}</span>
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
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
          {isLoading ? t("verify.verifying") : t("verify.verifyEmail")}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-4">
        <Button type="button" variant="link" onClick={onBack}>
          {t("verify.back")}
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={handleResend}
          disabled={isResending}
        >
          {isResending ? t("verify.sending") : t("verify.resendCode")}
        </Button>
      </div>
    </div>
  );
}
