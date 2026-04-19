import { AuthDiagnosticsManager } from "@/components/admin/auth-diagnostics-manager";

export default function AdminAuthDiagnosticsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Auth Diagnostics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify production readiness for login, register, OTP, and email verification flows.
        </p>
      </header>
      <AuthDiagnosticsManager />
    </div>
  );
}
