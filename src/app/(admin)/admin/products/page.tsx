import { ProductsManager } from "@/components/admin/products-manager";

export default function AdminProductsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Products Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, edit, and archive products across platform and seller inventory.
        </p>
      </header>
      <ProductsManager />
    </div>
  );
}
