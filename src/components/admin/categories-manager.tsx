"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, RefreshCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type {
  AdminCategoriesWorkspace,
  AdminCategoryItem,
  AdminSubcategoryItem,
} from "@/types/admin-catalog";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type CategoryFormState = {
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isActive: "true" | "false";
};

type SubcategoryFormState = {
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isActive: "true" | "false";
};

const defaultCategoryForm: CategoryFormState = {
  name: "",
  description: "",
  imageUrl: "",
  sortOrder: "0",
  isActive: "true",
};

const defaultSubcategoryForm: SubcategoryFormState = {
  categoryId: "",
  name: "",
  description: "",
  imageUrl: "",
  sortOrder: "0",
  isActive: "true",
};

const activeFilterOptions: Array<{ label: string; value: "" | "true" | "false" }> = [
  { label: "All Statuses", value: "" },
  { label: "Active Only", value: "true" },
  { label: "Inactive Only", value: "false" },
];

function mapCategoryToForm(category: AdminCategoryItem): CategoryFormState {
  return {
    name: category.name,
    description: category.description ?? "",
    imageUrl: category.imageUrl ?? "",
    sortOrder: String(category.sortOrder),
    isActive: category.isActive ? "true" : "false",
  };
}

function mapSubcategoryToForm(subcategory: AdminSubcategoryItem): SubcategoryFormState {
  return {
    categoryId: subcategory.categoryId,
    name: subcategory.name,
    description: subcategory.description ?? "",
    imageUrl: subcategory.imageUrl ?? "",
    sortOrder: String(subcategory.sortOrder),
    isActive: subcategory.isActive ? "true" : "false",
  };
}

export function CategoriesManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [workspace, setWorkspace] = useState<AdminCategoriesWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(defaultCategoryForm);
  const [subcategoryForm, setSubcategoryForm] =
    useState<SubcategoryFormState>(defaultSubcategoryForm);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (activeFilter) params.set("active", activeFilter);
    return params.toString();
  }, [activeFilter, query]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminCategoriesWorkspace>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load categories");
      }

      setWorkspace(payload.data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load categories";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast, queryString]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm(defaultCategoryForm);
  };

  const resetSubcategoryForm = () => {
    setEditingSubcategoryId(null);
    setSubcategoryForm((current) => ({ ...defaultSubcategoryForm, categoryId: current.categoryId }));
  };

  const submitCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: categoryForm.name,
        description: categoryForm.description,
        imageUrl: categoryForm.imageUrl,
        sortOrder: Number(categoryForm.sortOrder || 0),
        isActive: categoryForm.isActive === "true",
      };

      const response = await fetch(
        editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : "/api/admin/categories",
        {
          method: editingCategoryId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as ApiEnvelope<{ id: string; name: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to save category");
      }

      pushToast(
        editingCategoryId ? "Category updated successfully" : "Category created successfully",
        "success",
      );

      if (!editingCategoryId && result.data) {
        setSubcategoryForm((current) => ({ ...current, categoryId: result.data?.id ?? "" }));
      }

      resetCategoryForm();
      await loadWorkspace();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to save category";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSubcategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        categoryId: subcategoryForm.categoryId,
        name: subcategoryForm.name,
        description: subcategoryForm.description,
        imageUrl: subcategoryForm.imageUrl,
        sortOrder: Number(subcategoryForm.sortOrder || 0),
        isActive: subcategoryForm.isActive === "true",
      };

      const response = await fetch(
        editingSubcategoryId
          ? `/api/admin/subcategories/${editingSubcategoryId}`
          : "/api/admin/subcategories",
        {
          method: editingSubcategoryId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as ApiEnvelope<{ id: string; name: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to save subcategory");
      }

      pushToast(
        editingSubcategoryId
          ? "Subcategory updated successfully"
          : "Subcategory created successfully",
        "success",
      );
      resetSubcategoryForm();
      await loadWorkspace();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to save subcategory";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const startCategoryEdit = (category: AdminCategoryItem) => {
    setEditingCategoryId(category.id);
    setCategoryForm(mapCategoryToForm(category));
  };

  const startSubcategoryEdit = (subcategory: AdminSubcategoryItem) => {
    setEditingSubcategoryId(subcategory.id);
    setSubcategoryForm(mapSubcategoryToForm(subcategory));
  };

  const toggleCategoryActive = async (category: AdminCategoryItem) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !category.isActive }),
      });

      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update category status");
      }

      pushToast(
        `Category ${category.isActive ? "deactivated" : "activated"} successfully`,
        "success",
      );
      await loadWorkspace();
    } catch (toggleError) {
      const message =
        toggleError instanceof Error ? toggleError.message : "Unable to update category status";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSubcategoryActive = async (subcategory: AdminSubcategoryItem) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/subcategories/${subcategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !subcategory.isActive }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update subcategory status");
      }

      pushToast(
        `Subcategory ${subcategory.isActive ? "deactivated" : "activated"} successfully`,
        "success",
      );
      await loadWorkspace();
    } catch (toggleError) {
      const message =
        toggleError instanceof Error ? toggleError.message : "Unable to update subcategory status";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    const confirmed = window.confirm("Delete this category? This cannot be undone.");
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete category");
      }

      pushToast("Category deleted", "success");
      if (editingCategoryId === categoryId) {
        resetCategoryForm();
      }
      await loadWorkspace();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete category";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSubcategory = async (subcategoryId: string) => {
    const confirmed = window.confirm("Delete this subcategory? This cannot be undone.");
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/subcategories/${subcategoryId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete subcategory");
      }

      pushToast("Subcategory deleted", "success");
      if (editingSubcategoryId === subcategoryId) {
        resetSubcategoryForm();
      }
      await loadWorkspace();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete subcategory";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                {editingCategoryId ? "Edit Category" : "Add Category"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure top-level product groups for the store.
              </p>
            </div>
            {editingCategoryId ? (
              <Button type="button" variant="outline" onClick={resetCategoryForm} disabled={submitting}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            ) : null}
          </div>

          <form onSubmit={submitCategory} className="grid gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Category Name</label>
              <Input
                required
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Image URL (Optional)</label>
              <Input
                type="url"
                value={categoryForm.imageUrl}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Sort Order</label>
                <Input
                  type="number"
                  min={0}
                  value={categoryForm.sortOrder}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Status</label>
                <Select
                  value={categoryForm.isActive}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      isActive: event.target.value as "true" | "false",
                    }))
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Description</label>
              <textarea
                className="focus-ring min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingCategoryId ? "Update Category" : "Create Category"}
            </Button>
          </form>
        </article>

        <article className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                {editingSubcategoryId ? "Edit Subcategory" : "Add Subcategory"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Build second-level groups under each category for better discovery.
              </p>
            </div>
            {editingSubcategoryId ? (
              <Button type="button" variant="outline" onClick={resetSubcategoryForm} disabled={submitting}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            ) : null}
          </div>

          <form onSubmit={submitSubcategory} className="grid gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Parent Category</label>
              <Select
                required
                value={subcategoryForm.categoryId}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">Select Category</option>
                {workspace?.categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Subcategory Name</label>
              <Input
                required
                value={subcategoryForm.name}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Image URL (Optional)</label>
              <Input
                type="url"
                value={subcategoryForm.imageUrl}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    imageUrl: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Sort Order</label>
                <Input
                  type="number"
                  min={0}
                  value={subcategoryForm.sortOrder}
                  onChange={(event) =>
                    setSubcategoryForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Status</label>
                <Select
                  value={subcategoryForm.isActive}
                  onChange={(event) =>
                    setSubcategoryForm((current) => ({
                      ...current,
                      isActive: event.target.value as "true" | "false",
                    }))
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Description</label>
              <textarea
                className="focus-ring min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
                value={subcategoryForm.description}
                onChange={(event) =>
                  setSubcategoryForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving..."
                : editingSubcategoryId
                  ? "Update Subcategory"
                  : "Create Subcategory"}
            </Button>
          </form>
        </article>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Search category, subcategory, slug"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as "" | "true" | "false")}
          >
            {activeFilterOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" onClick={() => void loadWorkspace()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading categories...</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="space-y-3 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Categories ({workspace?.categories.length ?? 0})</h3>
              </div>

              {workspace?.categories.length ? (
                workspace.categories.map((category) => (
                  <div key={category.id} className="space-y-3 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{category.name}</p>
                        <p className="text-xs text-muted-foreground">Slug: {category.slug}</p>
                      </div>
                      <StatusPill value={category.isActive ? "ACTIVE" : "INACTIVE"} />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Products: {category.productCount} | Subcategories: {category.subcategoryCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Sort Order: {category.sortOrder}</p>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startCategoryEdit(category)}
                        disabled={submitting}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void toggleCategoryActive(category)}
                        disabled={submitting}
                      >
                        {category.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => void deleteCategory(category.id)}
                        disabled={submitting}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No categories found.</p>
              )}
            </article>

            <article className="space-y-3 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Subcategories ({workspace?.subcategories.length ?? 0})
                </h3>
              </div>

              {workspace?.subcategories.length ? (
                workspace.subcategories.map((subcategory) => (
                  <div key={subcategory.id} className="space-y-3 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{subcategory.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {subcategory.categoryName} | Slug: {subcategory.slug}
                        </p>
                      </div>
                      <StatusPill value={subcategory.isActive ? "ACTIVE" : "INACTIVE"} />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Products: {subcategory.productCount} | Sort Order: {subcategory.sortOrder}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startSubcategoryEdit(subcategory)}
                        disabled={submitting}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void toggleSubcategoryActive(subcategory)}
                        disabled={submitting}
                      >
                        {subcategory.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => void deleteSubcategory(subcategory.id)}
                        disabled={submitting}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No subcategories found.</p>
              )}
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
