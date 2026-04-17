"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema } from "@/lib/validators/auth";

type FormValues = z.infer<typeof resetPasswordSchema>;

type ResetPasswordResponse = {
  message: string;
};

type Props = {
  initialToken?: string;
};

export function ResetPasswordForm({ initialToken = "" }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetPasswordResponse | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: initialToken.trim(),
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      setServerError(payload.error ?? "Unable to reset password");
      return;
    }

    setResult(payload.data ?? { message: "Password has been reset successfully." });
  };

  if (result) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted p-3 text-sm">
        <p className="text-muted-foreground">{result.message}</p>
        <Button asChild className="w-full">
          <Link href="/login">Go to Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1.5">
        <label htmlFor="reset-token" className="text-sm font-medium">
          Reset token
        </label>
        <Input
          id="reset-token"
          autoComplete="off"
          placeholder="Paste reset token"
          {...register("token")}
        />
        {errors.token ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.token.message}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="text-sm font-medium">
          New password
        </label>
        <Input id="new-password" type="password" autoComplete="new-password" {...register("password")} />
        {errors.password ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          Confirm password
        </label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errors.confirmPassword.message}</p>
        ) : null}
      </div>
      {serverError ? <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p> : null}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}
