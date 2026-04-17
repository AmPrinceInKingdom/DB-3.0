import { AdminOrdersManager } from "@/components/admin/orders-manager";

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Orders Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search orders, monitor statuses, and update fulfillment workflow.
        </p>
      </header>
      <AdminOrdersManager />
    </div>
  );
}
