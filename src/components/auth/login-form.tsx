"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/validators/auth";

type FormValues = z.infer<typeof loginSchema>;

type LoginApiPayload = {
  success: boolean;
  data?: {
    role: string;
  };
  error?: string;
  code?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setPendingVerificationEmail(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as LoginApiPayload;

    if (!response.ok || !payload.success || !payload.data?.role) {
      if (payload.code === "EMAIL_NOT_VERIFIED") {
        setPendingVerificationEmail(values.email);
      }
      setServerError(payload.error ?? "Unable to log in");
      return;
    }

    const role = payload.data.role as string;
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      router.push("/admin");
      return;
    }

    router.push("/account");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}
      {pendingVerificationEmail ? (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-primary">
            Verify your email first to sign in.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" asChild>
              <Link href={`/email-verification?email=${encodeURIComponent(pendingVerificationEmail)}`}>
                Verify Email
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/otp-verification?email=${encodeURIComponent(pendingVerificationEmail)}`}>
                Verify with OTP
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
