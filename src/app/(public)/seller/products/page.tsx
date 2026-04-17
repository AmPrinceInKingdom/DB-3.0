import { SellerProductsManager } from "@/components/seller/seller-products-manager";

export default function SellerProductsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Seller Products</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add, update, and archive your own catalog items with seller-scoped access controls.
        </p>
      </section>

      <SellerProductsManager />
    </div>
  );
}
