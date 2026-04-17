import Link from "next/link";
import { EmailVerificationForm } from "@/components/auth/email-verification-form";

type Props = {
  searchParams: Promise<{
    email?: string;
    token?: string;
  }>;
};

export default async function EmailVerificationPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialEmail = typeof params.email === "string" ? params.email : "";
  const initialToken = typeof params.token === "string" ? params.token : "";

  return (
    <div>
      <h1 className="text-2xl font-bold">Verify your email</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Confirm your Deal Bazaar account before signing in and placing orders.
      </p>
      <div className="mt-6">
        <EmailVerificationForm initialEmail={initialEmail} initialToken={initialToken} />
      </div>
      <p className="mt-4 text-right text-sm">
        Already verified?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
