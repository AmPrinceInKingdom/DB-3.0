import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

type Props = {
  children: ReactNode;
};

export default function AuthLayout({ children }: Props) {
  return (
    <main className="min-h-screen bg-background">
      <div className="container-app py-6">
        <Logo />
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          {children}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-foreground underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
