import { AdminPayoutsManager } from "@/components/admin/payouts-manager";

export default function AdminPayoutsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Seller Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, monitor, and settle seller payouts with status tracking and references.
        </p>
      </header>
      <AdminPayoutsManager />
    </div>
  );
}
