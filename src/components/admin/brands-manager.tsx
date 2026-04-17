"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, RefreshCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type { AdminBrandItem, AdminBrandsWorkspace } from "@/types/admin-catalog";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type BrandFormState = {
  name: string;
  logoUrl: string;
  description: string;
  isActive: "true" | "false";
};

const defaultForm: BrandFormState = {
  name: "",
  logoUrl: "",
  description: "",
  isActive: "true",
};

const activeFilterOptions: Array<{ label: string; value: "" | "true" | "false" }> = [
  { label: "All Statuses", value: "" },
  { label: "Active Only", value: "true" },
  { label: "Inactive Only", value: "false" },
];

function mapBrandToForm(brand: AdminBrandItem): BrandFormState {
  return {
    name: brand.name,
    logoUrl: brand.logoUrl ?? "",
    description: brand.description ?? "",
    isActive: brand.isActive ? "true" : "false",
  };
}

export function BrandsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [workspace, setWorkspace] = useState<AdminBrandsWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandFormState>(defaultForm);

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
      const response = await fetch(`/api/admin/brands${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminBrandsWorkspace>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load brands");
      }
      setWorkspace(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load brands";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast, queryString]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const resetForm = () => {
    setEditingBrandId(null);
    setForm(defaultForm);
  };

  const submitBrand = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        logoUrl: form.logoUrl,
        description: form.description,
        isActive: form.isActive === "true",
      };

      const response = await fetch(
        editingBrandId ? `/api/admin/brands/${editingBrandId}` : "/api/admin/brands",
        {
          method: editingBrandId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to save brand");
      }

      pushToast(editingBrandId ? "Brand updated successfully" : "Brand created successfully", "success");
      resetForm();
      await loadWorkspace();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to save brand";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (brand: AdminBrandItem) => {
    setEditingBrandId(brand.id);
    setForm(mapBrandToForm(brand));
  };

  const toggleBrandActive = async (brand: AdminBrandItem) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !brand.isActive }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update brand status");
      }

      pushToast(`Brand ${brand.isActive ? "deactivated" : "activated"} successfully`, "success");
      await loadWorkspace();
    } catch (toggleError) {
      const message =
        toggleError instanceof Error ? toggleError.message : "Unable to update brand status";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBrand = async (brandId: string) => {
    const confirmed = window.confirm("Delete this brand? This cannot be undone.");
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/brands/${brandId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete brand");
      }
      pushToast("Brand deleted", "success");
      if (editingBrandId === brandId) {
        resetForm();
      }
      await loadWorkspace();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete brand";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{editingBrandId ? "Edit Brand" : "Add Brand"}</h2>
            <p className="text-sm text-muted-foreground">
              Maintain product brand identities and keep catalog filtering clean.
            </p>
          </div>
          {editingBrandId ? (
            <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
              <X className="mr-2 h-4 w-4" />
              Cancel Edit
            </Button>
          ) : null}
        </div>

        <form onSubmit={submitBrand} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Brand Name</label>
            <Input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Status</label>
            <Select
              value={form.isActive}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.value as "true" | "false" }))
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Logo URL (Optional)</label>
            <Input
              type="url"
              value={form.logoUrl}
              onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Description</label>
            <textarea
              className="focus-ring min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>

          <Button type="submit" disabled={submitting} className="md:col-span-2">
            {submitting ? "Saving..." : editingBrandId ? "Update Brand" : "Create Brand"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Search brand by name or slug"
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
          <Button variant="outline" onClick={() => void loadWorkspace()}>
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
          <p className="text-sm text-muted-foreground">Loading brands...</p>
        ) : !workspace || workspace.brands.length === 0 ? (
          <p className="text-sm text-muted-foreground">No brands found for selected filters.</p>
        ) : (
          <div className="space-y-3">
            {workspace.brands.map((brand) => (
              <article key={brand.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="h-12 w-12 rounded-lg border border-border bg-cover bg-center"
                      style={{
                        backgroundImage: brand.logoUrl ? `url("${brand.logoUrl}")` : undefined,
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold">{brand.name}</p>
                      <p className="text-xs text-muted-foreground">Slug: {brand.slug}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Linked Products: {brand.productCount}
                      </p>
                    </div>
                  </div>
                  <StatusPill value={brand.isActive ? "ACTIVE" : "INACTIVE"} />
                </div>

                {brand.description ? (
                  <p className="text-sm text-muted-foreground">{brand.description}</p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(brand)} disabled={submitting}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void toggleBrandActive(brand)}
                    disabled={submitting}
                  >
                    {brand.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void deleteBrand(brand.id)}
                    disabled={submitting}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
