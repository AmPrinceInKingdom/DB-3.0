"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  emailVerificationRequestSchema,
  emailVerificationTokenSchema,
} from "@/lib/validators/auth";

type TokenFormValues = z.infer<typeof emailVerificationTokenSchema>;
type RequestFormValues = z.infer<typeof emailVerificationRequestSchema>;

type VerificationRequestPayload = {
  message: string;
  debugVerificationUrl?: string;
  debugOtpCode?: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

type Props = {
  initialEmail?: string;
  initialToken?: string;
};

function normalizeTokenInput(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      const tokenFromQuery = parsed.searchParams.get("token")?.trim() ?? "";
      if (tokenFromQuery) return tokenFromQuery;
    } catch {
      return raw;
    }
  }

  return raw;
}

export function EmailVerificationForm({ initialEmail = "", initialToken = "" }: Props) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [requestResult, setRequestResult] = useState<VerificationRequestPayload | null>(null);
  const autoVerificationTriggeredRef = useRef(false);

  const tokenForm = useForm<TokenFormValues>({
    resolver: zodResolver(emailVerificationTokenSchema),
    defaultValues: {
      token: normalizeTokenInput(initialToken),
    },
  });

  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(emailVerificationRequestSchema),
    defaultValues: {
      email: initialEmail.trim(),
    },
  });

  const trackedEmail = useWatch({
    control: requestForm.control,
    name: "email",
  });
  const otpPath = useMemo(() => {
    const email = (trackedEmail ?? "").trim();
    return email ? `/otp-verification?email=${encodeURIComponent(email)}` : "/otp-verification";
  }, [trackedEmail]);

  const verifyByToken = tokenForm.handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    const normalizedToken = normalizeTokenInput(values.token);
    tokenForm.setValue("token", normalizedToken, { shouldValidate: true });

    const response = await fetch("/api/auth/email-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: normalizedToken }),
    });
    const payload = (await response.json()) as ApiResponse<{ message: string }>;

    if (!response.ok || !payload.success) {
      setServerError(payload.error ?? "Unable to verify email");
      return;
    }

    setSuccessMessage(payload.data?.message ?? "Email verified successfully.");
    router.push("/account");
  });

  const requestVerification = requestForm.handleSubmit(async (values) => {
    setServerError(null);
    setRequestResult(null);

    const response = await fetch("/api/auth/email-verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as ApiResponse<VerificationRequestPayload>;

    if (!response.ok || !payload.success || !payload.data) {
      setServerError(payload.error ?? "Unable to send verification message");
      return;
    }

    setRequestResult(payload.data);
  });

  useEffect(() => {
    if (!initialToken.trim()) return;
    if (autoVerificationTriggeredRef.current) return;

    autoVerificationTriggeredRef.current = true;
    void verifyByToken();
  }, [initialToken, verifyByToken]);

  return (
    <div className="space-y-4">
      {successMessage ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}
      {serverError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {serverError}
        </div>
      ) : null}

      <form onSubmit={verifyByToken} className="space-y-3 rounded-xl border border-border bg-background p-3">
        <p className="text-sm font-semibold">Verify with token link</p>
        <div className="space-y-1.5">
          <label htmlFor="email-verification-token" className="text-xs font-medium">
            Verification token
          </label>
          <Input
            id="email-verification-token"
            placeholder="Paste token from verification URL"
            autoComplete="off"
            {...tokenForm.register("token")}
          />
          {tokenForm.formState.errors.token ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {tokenForm.formState.errors.token.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={tokenForm.formState.isSubmitting}>
          {tokenForm.formState.isSubmitting ? "Verifying..." : "Verify Email"}
        </Button>
      </form>

      <form onSubmit={requestVerification} className="space-y-3 rounded-xl border border-border bg-background p-3">
        <p className="text-sm font-semibold">Did not get the email?</p>
        <div className="space-y-1.5">
          <label htmlFor="email-verification-request-email" className="text-xs font-medium">
            Account email
          </label>
          <Input
            id="email-verification-request-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...requestForm.register("email")}
          />
          {requestForm.formState.errors.email ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {requestForm.formState.errors.email.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={requestForm.formState.isSubmitting}>
          {requestForm.formState.isSubmitting ? "Sending..." : "Resend verification"}
        </Button>
      </form>

      {requestResult ? (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <p className="font-medium text-primary">{requestResult.message}</p>
          {requestResult.debugVerificationUrl ? (
            <p className="break-all text-primary">
              Dev link:{" "}
              <Link href={requestResult.debugVerificationUrl} className="underline">
                {requestResult.debugVerificationUrl}
              </Link>
            </p>
          ) : null}
          {requestResult.debugOtpCode ? (
            <p className="text-primary">Dev OTP: {requestResult.debugOtpCode}</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
        Prefer code verification?{" "}
        <Link href={otpPath} className="font-semibold text-primary underline">
          Use OTP verification
        </Link>
      </div>
    </div>
  );
}
