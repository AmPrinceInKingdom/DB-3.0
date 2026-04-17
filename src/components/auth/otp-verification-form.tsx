"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  otpVerificationRequestSchema,
  otpVerificationSchema,
} from "@/lib/validators/auth";

type OtpFormValues = z.infer<typeof otpVerificationSchema>;
type OtpRequestValues = z.infer<typeof otpVerificationRequestSchema>;

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

type OtpRequestResponse = {
  message: string;
  otpExpiresAt?: string;
};

type Props = {
  initialEmail?: string;
  showSentNotice?: boolean;
};

const otpResendCooldownSeconds = 60;

export function OtpVerificationForm({ initialEmail = "", showSentNotice = false }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    showSentNotice
      ? "If you just signed up, we attempted to send a verification code. If not received, use 'Send OTP code' below."
      : null,
  );
  const [requestResult, setRequestResult] = useState<OtpRequestResponse | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: {
      email: initialEmail.trim(),
      code: "",
    },
  });

  const requestForm = useForm<OtpRequestValues>({
    resolver: zodResolver(otpVerificationRequestSchema),
    defaultValues: {
      email: initialEmail.trim(),
    },
  });

  const trackedEmail = useWatch({
    control: otpForm.control,
    name: "email",
  });
  const emailVerificationPath = useMemo(() => {
    const email = (trackedEmail ?? "").trim();
    return email ? `/email-verification?email=${encodeURIComponent(email)}` : "/email-verification";
  }, [trackedEmail]);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldownSeconds]);

  const verifyOtp = otpForm.handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);

    const response = await fetch("/api/auth/otp-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as ApiResponse<{ message: string }>;

    if (!response.ok || !payload.success) {
      setServerError(payload.error ?? "Unable to verify OTP");
      return;
    }

    setSuccessMessage(payload.data?.message ?? "OTP verified successfully.");
    router.replace("/account");
    router.refresh();
  });

  const requestOtp = requestForm.handleSubmit(async (values) => {
    setServerError(null);
    setRequestResult(null);

    const response = await fetch("/api/auth/otp-verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as ApiResponse<OtpRequestResponse>;

    if (!response.ok || !payload.success || !payload.data) {
      setServerError(payload.error ?? "Unable to send OTP");
      return;
    }

    setRequestResult(payload.data);
    otpForm.setValue("email", values.email);
    setResendCooldownSeconds(otpResendCooldownSeconds);
  });

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

      <form onSubmit={verifyOtp} className="space-y-3 rounded-xl border border-border bg-background p-3">
        <p className="text-sm font-semibold">Verify your email with OTP</p>
        <div className="space-y-1.5">
          <label htmlFor="otp-email" className="text-xs font-medium">
            Account email
          </label>
          <Input id="otp-email" type="email" autoComplete="email" {...otpForm.register("email")} />
          {otpForm.formState.errors.email ? (
            <p className="text-xs text-red-600 dark:text-red-400">{otpForm.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="otp-code" className="text-xs font-medium">
            6-digit code
          </label>
          <Input
            id="otp-code"
            autoComplete="one-time-code"
            maxLength={6}
            inputMode="numeric"
            placeholder="123456"
            {...otpForm.register("code")}
          />
          {otpForm.formState.errors.code ? (
            <p className="text-xs text-red-600 dark:text-red-400">{otpForm.formState.errors.code.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={otpForm.formState.isSubmitting}>
          {otpForm.formState.isSubmitting ? "Verifying..." : "Verify OTP"}
        </Button>
      </form>

      <form onSubmit={requestOtp} className="space-y-3 rounded-xl border border-border bg-background p-3">
        <p className="text-sm font-semibold">Need a fresh code?</p>
        <div className="space-y-1.5">
          <label htmlFor="otp-request-email" className="text-xs font-medium">
            Account email
          </label>
          <Input id="otp-request-email" type="email" autoComplete="email" {...requestForm.register("email")} />
          {requestForm.formState.errors.email ? (
            <p className="text-xs text-red-600 dark:text-red-400">{requestForm.formState.errors.email.message}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={requestForm.formState.isSubmitting || resendCooldownSeconds > 0}
        >
          {requestForm.formState.isSubmitting
            ? "Sending..."
            : resendCooldownSeconds > 0
              ? `Send OTP code (${resendCooldownSeconds}s)`
              : "Send OTP code"}
        </Button>
      </form>

      {requestResult ? (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <p className="font-medium text-primary">{requestResult.message}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
        Prefer verification link?{" "}
        <Link href={emailVerificationPath} className="font-semibold text-primary underline">
          Use email verification link
        </Link>
      </div>
    </div>
  );
}
