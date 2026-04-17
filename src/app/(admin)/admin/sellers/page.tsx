import { SellersManager } from "@/components/admin/sellers-manager";

export default function AdminSellersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Sellers Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review seller applications, approve onboarding, and suspend storefront access when needed.
        </p>
      </header>
      <SellersManager />
    </div>
  );
}
