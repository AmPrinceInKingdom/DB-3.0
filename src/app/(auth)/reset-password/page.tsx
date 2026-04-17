import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type Props = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialToken = typeof params.token === "string" ? params.token : "";

  return (
    <div>
      <h1 className="text-2xl font-bold">Reset Password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your new password and confirm to continue.
      </p>
      <div className="mt-6">
        <ResetPasswordForm initialToken={initialToken} />
      </div>
    </div>
  );
}
