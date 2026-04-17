"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type Props = {
  label?: string;
  redirectTo?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

type ApiEnvelope = {
  success: boolean;
  error?: string;
};

export function LogoutButton({
  label = "Logout",
  redirectTo = "/login",
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      let payload: ApiEnvelope | null = null;
      try {
        payload = (await response.json()) as ApiEnvelope;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to log out");
      }

      router.replace(redirectTo);
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => void handleLogout()}
      disabled={isLoggingOut}
      aria-busy={isLoggingOut}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isLoggingOut ? "Logging out..." : label}
    </Button>
  );
}
