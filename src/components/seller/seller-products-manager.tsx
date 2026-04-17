"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ProductStatus } from "@prisma/client";
import { Pencil, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type { SellerProductItem, SellerProductsWorkspace } from "@/types/seller-product";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type UploadedProductImage = {
  url: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
};

type ProductFormState = {
  name: string;
  sku: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  currentPrice: string;
  oldPrice: string;
  stockQuantity: string;
  minStockLevel: string;
  mainImageUrl: string;
  shortDescription: string;
  description: string;
};

const defaultForm: ProductFormState = {
  name: "",
  sku: "",
  categoryId: "",
  subcategoryId: "",
  brandId: "",
  status: "DRAFT",
  currentPrice: "",
  oldPrice: "",
  stockQuantity: "0",
  minStockLevel: "5",
  mainImageUrl: "",
  shortDescription: "",
  description: "",
};

const statusFilterOptions: Array<{ label: string; value: ProductStatus | "" }> = [
  { label: "All Statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Archived", value: "ARCHIVED" },
];

function mapProductToForm(product: SellerProductItem): ProductFormState {
  return {
    name: product.name,
    sku: product.sku,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId ?? "",
    brandId: product.brandId ?? "",
    status:
      product.status === "ACTIVE" || product.status === "INACTIVE" || product.status === "DRAFT"
        ? product.status
        : "DRAFT",
    currentPrice: String(product.currentPrice),
    oldPrice: product.oldPrice === null ? "" : String(product.oldPrice),
    stockQuantity: String(product.stockQuantity),
    minStockLevel: String(product.minStockLevel),
    mainImageUrl: product.mainImageUrl ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
  };
}

export function SellerProductsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [workspace, setWorkspace] = useState<SellerProductsWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(defaultForm);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [query, statusFilter]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/seller/products${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<SellerProductsWorkspace>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load seller products");
      }
      setWorkspace(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load seller products";
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
    setEditingProductId(null);
    setForm(defaultForm);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
  };

  const uploadMainImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("imageFile", file);

      const response = await fetch("/api/seller/products/upload-image", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ApiEnvelope<UploadedProductImage>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to upload product image");
      }

      setForm((current) => ({
        ...current,
        mainImageUrl: payload.data?.url ?? current.mainImageUrl,
      }));
      pushToast("Product image uploaded successfully", "success");
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload product image";
      setError(message);
      pushToast(message, "error");
    } finally {
      setUploadingImage(false);
      if (imageFileInputRef.current) {
        imageFileInputRef.current.value = "";
      }
    }
  };

  const submitProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (uploadingImage) {
      pushToast("Please wait until image upload is finished", "error");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        brandId: form.brandId,
        status: form.status,
        currentPrice: Number(form.currentPrice),
        oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
        stockQuantity: Number(form.stockQuantity),
        minStockLevel: Number(form.minStockLevel),
        mainImageUrl: form.mainImageUrl,
        shortDescription: form.shortDescription,
        description: form.description,
      };

      const response = await fetch(
        editingProductId ? `/api/seller/products/${editingProductId}` : "/api/seller/products",
        {
          method: editingProductId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as ApiEnvelope<SellerProductItem>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to save product");
      }

      pushToast(editingProductId ? "Product updated successfully" : "Product created successfully", "success");
      resetForm();
      await loadWorkspace();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to save product";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (product: SellerProductItem) => {
    setEditingProductId(product.id);
    setForm(mapProductToForm(product));
  };

  const archiveProduct = async (productId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/seller/products/${productId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to archive product");
      }
      pushToast("Product archived", "success");
      if (editingProductId === productId) {
        resetForm();
      }
      await loadWorkspace();
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : "Unable to archive product";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const subcategoryOptions = useMemo(() => {
    if (!workspace) return [];
    if (!form.categoryId) return workspace.options.subcategories;
    return workspace.options.subcategories.filter((item) => item.categoryId === form.categoryId);
  }, [form.categoryId, workspace]);

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{editingProductId ? "Edit Product" : "Add New Product"}</h2>
            <p className="text-sm text-muted-foreground">
              Create and manage your seller catalog with stock and pricing control.
            </p>
          </div>
          {editingProductId ? (
            <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
              <X className="mr-2 h-4 w-4" />
              Cancel Edit
            </Button>
          ) : null}
        </div>

        <form onSubmit={submitProduct} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Product Name</label>
            <Input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">SKU</label>
            <Input
              required
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Category</label>
            <Select
              required
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  categoryId: event.target.value,
                  subcategoryId: "",
                }))
              }
            >
              <option value="">Select Category</option>
              {workspace?.options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Subcategory (Optional)</label>
            <Select
              value={form.subcategoryId}
              onChange={(event) => setForm((current) => ({ ...current, subcategoryId: event.target.value }))}
            >
              <option value="">No Subcategory</option>
              {subcategoryOptions.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Brand (Optional)</label>
            <Select
              value={form.brandId}
              onChange={(event) => setForm((current) => ({ ...current, brandId: event.target.value }))}
            >
              <option value="">No Brand</option>
              {workspace?.options.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Status</label>
            <Select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as ProductFormState["status"],
                }))
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Current Price</label>
            <Input
              required
              type="number"
              min={0.01}
              step="0.01"
              value={form.currentPrice}
              onChange={(event) => setForm((current) => ({ ...current, currentPrice: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Old Price (Optional)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.oldPrice}
              onChange={(event) => setForm((current) => ({ ...current, oldPrice: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Stock Quantity</label>
            <Input
              required
              type="number"
              min={0}
              value={form.stockQuantity}
              onChange={(event) => setForm((current) => ({ ...current, stockQuantity: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Min Stock Level</label>
            <Input
              required
              type="number"
              min={1}
              value={form.minStockLevel}
              onChange={(event) => setForm((current) => ({ ...current, minStockLevel: event.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Main Image</label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                type="url"
                value={form.mainImageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mainImageUrl: event.target.value }))
                }
                placeholder="Paste image URL or upload using button"
                disabled={uploadingImage}
              />
              <div className="flex items-center gap-2">
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={uploadMainImage}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageFileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingImage ? "Uploading..." : "Upload Image"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB.</p>
            {form.mainImageUrl ? (
              <div
                className="h-24 w-24 rounded-lg border border-border bg-cover bg-center"
                style={{ backgroundImage: `url("${form.mainImageUrl}")` }}
              />
            ) : null}
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Short Description</label>
            <Input
              value={form.shortDescription}
              onChange={(event) => setForm((current) => ({ ...current, shortDescription: event.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Description</label>
            <textarea
              className="focus-ring min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <Button type="submit" disabled={submitting || uploadingImage} className="md:col-span-2">
            {uploadingImage
              ? "Uploading image..."
              : submitting
                ? "Saving..."
                : editingProductId
                  ? "Update Product"
                  : "Create Product"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Search name, slug, SKU"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ProductStatus | "")}
          >
            {statusFilterOptions.map((option) => (
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
          <p className="text-sm text-muted-foreground">Loading seller products...</p>
        ) : !workspace || workspace.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products found for selected filters.</p>
        ) : (
          <div className="space-y-3">
            {workspace.items.map((product) => (
              <article key={product.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="h-14 w-14 rounded-lg border border-border bg-cover bg-center"
                      style={{
                        backgroundImage: product.mainImageUrl
                          ? `url("${product.mainImageUrl}")`
                          : undefined,
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku} • Slug: {product.slug}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.categoryName}
                        {product.subcategoryName ? ` / ${product.subcategoryName}` : ""}
                        {product.brandName ? ` • ${product.brandName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={product.status} />
                    <StatusPill value={product.stockStatus} />
                  </div>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p className="text-muted-foreground">
                    Price: <span className="font-semibold text-foreground">{product.currentPrice.toFixed(2)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Old Price:{" "}
                    <span className="font-semibold text-foreground">
                      {product.oldPrice === null ? "-" : product.oldPrice.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Stock: <span className="font-semibold text-foreground">{product.stockQuantity}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Min Level: <span className="font-semibold text-foreground">{product.minStockLevel}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(product)} disabled={submitting}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void archiveProduct(product.id)}
                    disabled={submitting || product.status === "ARCHIVED"}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Archive
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/product/${product.slug}`}>View Product</Link>
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
