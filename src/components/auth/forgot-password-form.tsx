"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/validators/auth";

type FormValues = z.infer<typeof forgotPasswordSchema>;

type ForgotPasswordResponse = {
  message: string;
  debugResetUrl?: string;
  expiresAt?: string;
};

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      setServerError(payload.error ?? "Unable to request password reset");
      return;
    }

    setResult(payload.data ?? { message: "Password reset request sent." });
  };

  if (result) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted p-3 text-sm">
        <p className="text-muted-foreground">{result.message}</p>
        {result.debugResetUrl ? (
          <div className="space-y-1 rounded-lg border border-primary/30 bg-primary/5 p-2">
            <p className="text-xs font-semibold text-primary">Development reset link</p>
            <Link href={result.debugResetUrl} className="break-all text-xs font-medium text-primary underline">
              {result.debugResetUrl}
            </Link>
          </div>
        ) : null}
        <Button type="button" variant="outline" className="w-full" onClick={() => setResult(null)}>
          Send another request
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium">
          Account email
        </label>
        <Input id="forgot-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>
        ) : null}
      </div>
      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
