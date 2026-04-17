import { InventoryManager } from "@/components/admin/inventory-manager";

export default function AdminInventoryPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inventory Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor stock levels, fix low stock quickly, and track manual adjustments.
        </p>
      </header>
      <InventoryManager />
    </div>
  );
}
