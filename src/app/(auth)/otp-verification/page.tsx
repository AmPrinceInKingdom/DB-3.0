import Link from "next/link";
import { OtpVerificationForm } from "@/components/auth/otp-verification-form";

type Props = {
  searchParams: Promise<{
    email?: string;
    sent?: string;
  }>;
};

export default async function OtpVerificationPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialEmail = typeof params.email === "string" ? params.email : "";
  const showSentNotice = params.sent === "1";

  return (
    <div>
      <h1 className="text-2xl font-bold">OTP Verification</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the one-time code sent to your email to verify your account.
      </p>
      <div className="mt-6">
        <OtpVerificationForm initialEmail={initialEmail} showSentNotice={showSentNotice} />
      </div>
      <p className="mt-4 text-right text-sm">
        Back to{" "}
        <Link href="/email-verification" className="text-primary hover:underline">
          email verification
        </Link>
      </p>
    </div>
  );
}
