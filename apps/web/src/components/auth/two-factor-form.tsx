"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslation } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";

interface TwoFactorFormProps {
  onBack: () => void;
}

export function TwoFactorForm({ onBack }: TwoFactorFormProps) {
  const { t } = useTranslation("auth");
  const { signIn, setActive } = useSignIn();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;

    try {
      setIsLoading(true);
      setError("");

      const result = await signIn.attemptSecondFactor({
        strategy: "totp",
        code,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        router.push("/");
      } else {
        setError(t("twoFactor.verificationIncomplete"));
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(
        clerkErr?.errors?.[0]?.longMessage ||
          clerkErr?.errors?.[0]?.message ||
          t("twoFactor.verificationFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("twoFactor.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("twoFactor.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          {isLoading ? t("twoFactor.verifying") : t("twoFactor.verify")}
        </Button>
      </form>

      <div className="text-center">
        <Button type="button" variant="link" onClick={onBack}>
          {t("twoFactor.backToSignIn")}
        </Button>
      </div>
    </div>
  );
}
