import { CategoriesManager } from "@/components/admin/categories-manager";

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Categories Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize category and subcategory structure for better product discovery.
        </p>
      </header>
      <CategoriesManager />
    </div>
  );
}
