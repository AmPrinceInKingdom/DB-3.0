"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerSchema } from "@/lib/validators/auth";

type FormValues = z.infer<typeof registerSchema>;

type RegisterApiPayload = {
  success: boolean;
  data?: {
    requiresEmailVerification?: boolean;
  };
  error?: string;
};

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as RegisterApiPayload;

    if (!response.ok || !payload.success) {
      setServerError(payload.error ?? "Unable to register");
      return;
    }

    if (payload.data?.requiresEmailVerification) {
      router.push(`/otp-verification?email=${encodeURIComponent(values.email)}&sent=1`);
      return;
    }

    router.push("/account");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="text-sm font-medium">
            First Name
          </label>
          <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
          {errors.firstName ? (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last Name
          </label>
          <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          {errors.lastName ? (
            <p className="text-xs text-red-600 dark:text-red-400">{errors.lastName.message}</p>
          ) : null}
        </div>
      </div>

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
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        <p className="text-xs text-muted-foreground">
          Minimum 8 chars, with uppercase, lowercase, and number.
        </p>
        {errors.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
