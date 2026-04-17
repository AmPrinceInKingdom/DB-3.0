import { SellerAnalyticsManager } from "@/components/seller/seller-analytics-manager";

export default function SellerReportsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Seller Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track your revenue, order flow, product winners, and stock risks in one analytics panel.
        </p>
      </section>

      <SellerAnalyticsManager />
    </div>
  );
}
