import { SellerOrdersManager } from "@/components/seller/seller-orders-manager";

export default function SellerOrdersPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Seller Orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your fulfillment queue, update shipment details, and keep customers informed.
        </p>
      </section>

      <SellerOrdersManager />
    </div>
  );
}
