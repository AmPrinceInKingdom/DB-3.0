import { SellerPayoutsManager } from "@/components/seller/seller-payouts-manager";

export default function SellerPayoutsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Seller Payouts</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage payout accounts and track payout lifecycle from pending to paid.
        </p>
      </section>

      <SellerPayoutsManager />
    </div>
  );
}
