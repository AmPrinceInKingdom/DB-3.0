import { SellerDashboardManager } from "@/components/seller/seller-dashboard-manager";

export default function SellerDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Seller Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track storefront performance, fulfillment queue, and payout health from one live workspace.
        </p>
      </section>

      <SellerDashboardManager />
    </div>
  );
}
