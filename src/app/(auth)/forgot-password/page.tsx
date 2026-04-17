import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Forgot Password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we will send a secure reset link.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
