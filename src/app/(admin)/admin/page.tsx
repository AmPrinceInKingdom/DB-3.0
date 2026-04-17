import { AdminDashboardManager } from "@/components/admin/admin-dashboard-manager";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor performance, verify payments, and manage marketplace operations.
        </p>
      </header>

      <AdminDashboardManager />
    </div>
  );
}
