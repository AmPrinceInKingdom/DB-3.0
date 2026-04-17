import { BrandsManager } from "@/components/admin/brands-manager";

export default function AdminBrandsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Brands Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage active/inactive brands used across product catalog and storefront filters.
        </p>
      </header>
      <BrandsManager />
    </div>
  );
}
