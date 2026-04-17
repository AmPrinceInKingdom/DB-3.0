"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ProductStatus } from "@prisma/client";
import { ChevronDown, ChevronUp, Pencil, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type {
  AdminCatalogProductItem,
  AdminProductsWorkspace,
} from "@/types/admin-catalog";

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

type ProductVariantFormState = {
  id?: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  price: string;
  oldPrice: string;
  stockQuantity: string;
  imageUrl: string;
  isDefault: boolean;
  isActive: boolean;
};

type ProductFormState = {
  name: string;
  sku: string;
  sellerId: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  status: ProductStatus;
  currentPrice: string;
  oldPrice: string;
  stockQuantity: string;
  minStockLevel: string;
  mainImageUrl: string;
  galleryImageUrls: string[];
  variants: ProductVariantFormState[];
  shortDescription: string;
  description: string;
};

const defaultForm: ProductFormState = {
  name: "",
  sku: "",
  sellerId: "",
  categoryId: "",
  subcategoryId: "",
  brandId: "",
  status: "DRAFT",
  currentPrice: "",
  oldPrice: "",
  stockQuantity: "0",
  minStockLevel: "5",
  mainImageUrl: "",
  galleryImageUrls: [],
  variants: [],
  shortDescription: "",
  description: "",
};

const maxGalleryImageCount = 12;

const statusFilterOptions: Array<{ label: string; value: ProductStatus | "" }> = [
  { label: "All Statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Archived", value: "ARCHIVED" },
];

function mapProductToForm(product: AdminCatalogProductItem): ProductFormState {
  const mapVariantOption = (options: Record<string, string>, ...keys: string[]) => {
    for (const key of keys) {
      const match = Object.entries(options).find(
        ([optionKey]) => optionKey.trim().toLowerCase() === key.toLowerCase(),
      );
      if (match) {
        return match[1] ?? "";
      }
    }
    return "";
  };

  return {
    name: product.name,
    sku: product.sku,
    sellerId: product.sellerId ?? "",
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId ?? "",
    brandId: product.brandId ?? "",
    status: product.status,
    currentPrice: String(product.currentPrice),
    oldPrice: product.oldPrice === null ? "" : String(product.oldPrice),
    stockQuantity: String(product.stockQuantity),
    minStockLevel: String(product.minStockLevel),
    mainImageUrl: product.mainImageUrl ?? "",
    galleryImageUrls: product.galleryImageUrls,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name ?? "",
      size: mapVariantOption(variant.options, "size"),
      color: mapVariantOption(variant.options, "color", "colour"),
      price: String(variant.price),
      oldPrice: variant.oldPrice === null ? "" : String(variant.oldPrice),
      stockQuantity: String(variant.stockQuantity),
      imageUrl: variant.imageUrl ?? "",
      isDefault: variant.isDefault,
      isActive: variant.isActive,
    })),
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
  };
}

export function ProductsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const [workspace, setWorkspace] = useState<AdminProductsWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGalleryImages, setUploadingGalleryImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [galleryImageUrlDraft, setGalleryImageUrlDraft] = useState("");
  const mediaBusy = uploadingImage || uploadingGalleryImages;

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
      const response = await fetch(`/api/admin/products${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminProductsWorkspace>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load products");
      }
      setWorkspace(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load products";
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
    setGalleryImageUrlDraft("");
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
    if (galleryFileInputRef.current) {
      galleryFileInputRef.current.value = "";
    }
  };

  const subcategoryOptions = useMemo(() => {
    if (!workspace) return [];
    if (!form.categoryId) return workspace.options.subcategories;
    return workspace.options.subcategories.filter((item) => item.categoryId === form.categoryId);
  }, [form.categoryId, workspace]);

  const uploadSingleImageFile = async (file: File) => {
    const formData = new FormData();
    formData.append("imageFile", file);

    const response = await fetch("/api/admin/products/upload-image", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as ApiEnvelope<UploadedProductImage>;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to upload product image");
    }

    return payload.data.url;
  };

  const uploadMainImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const imageUrl = await uploadSingleImageFile(file);

      setForm((current) => ({
        ...current,
        mainImageUrl: imageUrl,
        galleryImageUrls: current.galleryImageUrls.filter((url) => url !== imageUrl),
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

  const addGalleryImageUrl = () => {
    const nextUrl = galleryImageUrlDraft.trim();
    if (!nextUrl) return;

    try {
      new URL(nextUrl);
    } catch {
      pushToast("Enter a valid image URL for gallery", "error");
      return;
    }

    setForm((current) => {
      if (current.galleryImageUrls.length >= maxGalleryImageCount) {
        pushToast(`Only ${maxGalleryImageCount} gallery images are allowed`, "error");
        return current;
      }
      if (nextUrl === current.mainImageUrl) {
        pushToast("This URL is already selected as main image", "error");
        return current;
      }
      if (current.galleryImageUrls.includes(nextUrl)) {
        pushToast("This gallery image already exists", "error");
        return current;
      }
      return {
        ...current,
        galleryImageUrls: [...current.galleryImageUrls, nextUrl],
      };
    });

    setGalleryImageUrlDraft("");
  };

  const removeGalleryImage = (index: number) => {
    setForm((current) => ({
      ...current,
      galleryImageUrls: current.galleryImageUrls.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const moveGalleryImage = (index: number, direction: "up" | "down") => {
    setForm((current) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.galleryImageUrls.length) {
        return current;
      }

      const nextGallery = [...current.galleryImageUrls];
      const [movedItem] = nextGallery.splice(index, 1);
      nextGallery.splice(nextIndex, 0, movedItem);
      return {
        ...current,
        galleryImageUrls: nextGallery,
      };
    });
  };

  const uploadGalleryImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const availableSlots = Math.max(0, maxGalleryImageCount - form.galleryImageUrls.length);
    if (availableSlots <= 0) {
      pushToast(`Only ${maxGalleryImageCount} gallery images are allowed`, "error");
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = "";
      }
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);

    setUploadingGalleryImages(true);
    setError(null);
    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        const imageUrl = await uploadSingleImageFile(file);
        uploadedUrls.push(imageUrl);
      }

      let addedCount = 0;
      setForm((current) => {
        const nextGallery = [...current.galleryImageUrls];
        const existing = new Set(nextGallery);

        for (const uploadedUrl of uploadedUrls) {
          if (uploadedUrl === current.mainImageUrl) continue;
          if (existing.has(uploadedUrl)) continue;
          if (nextGallery.length >= maxGalleryImageCount) break;
          nextGallery.push(uploadedUrl);
          existing.add(uploadedUrl);
          addedCount += 1;
        }

        return {
          ...current,
          galleryImageUrls: nextGallery,
        };
      });

      if (addedCount > 0) {
        pushToast(`${addedCount} gallery image(s) uploaded`, "success");
      } else {
        pushToast("Uploaded images were already in gallery", "error");
      }
      if (files.length > filesToUpload.length) {
        pushToast(
          `Only ${availableSlots} image(s) were uploaded due to gallery limit`,
          "error",
        );
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload gallery images";
      setError(message);
      pushToast(message, "error");
    } finally {
      setUploadingGalleryImages(false);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = "";
      }
    }
  };

  const addVariant = () => {
    setForm((current) => {
      if (current.variants.length >= 50) {
        pushToast("Maximum 50 variants allowed per product", "error");
        return current;
      }

      const nextIndex = current.variants.length + 1;
      const skuBase = current.sku.trim().toUpperCase() || "VARIANT";

      const nextVariant: ProductVariantFormState = {
        sku: `${skuBase}-V${nextIndex}`,
        name: "",
        size: "",
        color: "",
        price: current.currentPrice || "",
        oldPrice: current.oldPrice || "",
        stockQuantity: "0",
        imageUrl: "",
        isDefault: current.variants.length === 0,
        isActive: true,
      };

      return {
        ...current,
        variants: [...current.variants, nextVariant],
      };
    });
  };

  const updateVariant = (
    index: number,
    updater: (variant: ProductVariantFormState) => ProductVariantFormState,
  ) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? updater(variant) : variant,
      ),
    }));
  };

  const setVariantDefault = (index: number) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => ({
        ...variant,
        isDefault: variantIndex === index,
      })),
    }));
  };

  const removeVariant = (index: number) => {
    setForm((current) => {
      const removingDefault = current.variants[index]?.isDefault ?? false;
      const nextVariants = current.variants.filter((_, variantIndex) => variantIndex !== index);

      if (nextVariants.length === 0) {
        return {
          ...current,
          variants: [],
        };
      }

      if (removingDefault) {
        const nextDefaultIndex = nextVariants.findIndex((variant) => variant.isActive);
        const safeDefaultIndex = nextDefaultIndex >= 0 ? nextDefaultIndex : 0;
        return {
          ...current,
          variants: nextVariants.map((variant, variantIndex) => ({
            ...variant,
            isDefault: variantIndex === safeDefaultIndex,
          })),
        };
      }

      return {
        ...current,
        variants: nextVariants,
      };
    });
  };

  const submitProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mediaBusy) {
      pushToast("Please wait until image upload is finished", "error");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const normalizedVariants =
        form.variants.length > 0
          ? (() => {
              const withDefault = form.variants.some((variant) => variant.isDefault)
                ? form.variants
                : form.variants.map((variant, index) => ({
                    ...variant,
                    isDefault: index === 0,
                  }));

              return withDefault.map((variant) => {
                const options: Record<string, string> = {};
                if (variant.size.trim()) {
                  options.Size = variant.size.trim();
                }
                if (variant.color.trim()) {
                  options.Color = variant.color.trim();
                }

                return {
                  ...(variant.id ? { id: variant.id } : {}),
                  sku: variant.sku.trim().toUpperCase(),
                  name: variant.name.trim() || null,
                  options,
                  price: Number(variant.price),
                  oldPrice: variant.oldPrice ? Number(variant.oldPrice) : null,
                  stockQuantity: Number(variant.stockQuantity),
                  imageUrl: variant.imageUrl.trim() || null,
                  isDefault: variant.isDefault,
                  isActive: variant.isActive,
                };
              });
            })()
          : [];

      const payload = {
        name: form.name,
        sku: form.sku,
        sellerId: form.sellerId,
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        brandId: form.brandId,
        status: form.status,
        currentPrice: Number(form.currentPrice),
        oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
        stockQuantity: Number(form.stockQuantity),
        minStockLevel: Number(form.minStockLevel),
        mainImageUrl: form.mainImageUrl,
        galleryImageUrls: form.galleryImageUrls,
        variants: normalizedVariants,
        shortDescription: form.shortDescription,
        description: form.description,
      };

      const response = await fetch(
        editingProductId ? `/api/admin/products/${editingProductId}` : "/api/admin/products",
        {
          method: editingProductId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as ApiEnvelope<AdminCatalogProductItem>;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to save product");
      }

      pushToast(
        editingProductId ? "Product updated successfully" : "Product created successfully",
        "success",
      );
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

  const startEdit = (product: AdminCatalogProductItem) => {
    setEditingProductId(product.id);
    setForm(mapProductToForm(product));
    setGalleryImageUrlDraft("");
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
    if (galleryFileInputRef.current) {
      galleryFileInputRef.current.value = "";
    }
  };

  const archiveProduct = async (productId: string) => {
    const confirmed = window.confirm("Archive this product?");
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
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

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{editingProductId ? "Edit Product" : "Add Product"}</h2>
            <p className="text-sm text-muted-foreground">
              Manage full marketplace catalog across sellers, categories, and brands.
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
              disabled={mediaBusy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">SKU</label>
            <Input
              required
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
              disabled={mediaBusy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Seller (Optional)</label>
            <Select
              value={form.sellerId}
              onChange={(event) => setForm((current) => ({ ...current, sellerId: event.target.value }))}
              disabled={mediaBusy}
            >
              <option value="">Platform Product (No Seller)</option>
              {workspace?.options.sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Status</label>
            <Select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as ProductStatus }))
              }
              disabled={mediaBusy}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
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
              disabled={mediaBusy}
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
              disabled={mediaBusy}
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
              disabled={mediaBusy}
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
            <label className="text-xs font-medium">Current Price</label>
            <Input
              required
              type="number"
              min={0.01}
              step="0.01"
              value={form.currentPrice}
              onChange={(event) => setForm((current) => ({ ...current, currentPrice: event.target.value }))}
              disabled={mediaBusy}
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
              disabled={mediaBusy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Stock Quantity</label>
            <Input
              required
              type="number"
              min={0}
              value={form.stockQuantity}
              onChange={(event) =>
                setForm((current) => ({ ...current, stockQuantity: event.target.value }))
              }
              disabled={mediaBusy || form.variants.length > 0}
            />
            {form.variants.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Auto-calculated from variant stock quantities.
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Min Stock Level</label>
            <Input
              required
              type="number"
              min={1}
              value={form.minStockLevel}
              onChange={(event) =>
                setForm((current) => ({ ...current, minStockLevel: event.target.value }))
              }
              disabled={mediaBusy}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Product Variants
                </p>
                <p className="text-xs text-muted-foreground">
                  Add size/color variants with separate SKU, price, and stock.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariant}
                disabled={mediaBusy}
              >
                Add Variant
              </Button>
            </div>

            {form.variants.length > 0 ? (
              <div className="space-y-3">
                {form.variants.map((variant, index) => (
                  <article key={variant.id ?? `new-${index}`} className="space-y-3 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">Variant {index + 1}</p>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeVariant(index)}
                        disabled={mediaBusy}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Variant SKU</label>
                        <Input
                          required
                          value={variant.sku}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              sku: event.target.value,
                            }))
                          }
                          disabled={mediaBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Variant Name (Optional)</label>
                        <Input
                          value={variant.name}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Example: 16TB Silver Edition"
                          disabled={mediaBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Size (Optional)</label>
                        <Input
                          value={variant.size}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              size: event.target.value,
                            }))
                          }
                          placeholder="Example: 16TB"
                          disabled={mediaBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Color (Optional)</label>
                        <Input
                          value={variant.color}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              color: event.target.value,
                            }))
                          }
                          placeholder="Example: Silver"
                          disabled={mediaBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Variant Price</label>
                        <Input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={variant.price}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              price: event.target.value,
                            }))
                          }
                          disabled={mediaBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Variant Old Price (Optional)</label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={variant.oldPrice}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              oldPrice: event.target.value,
                            }))
                          }
                          disabled={mediaBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Variant Stock</label>
                        <Input
                          type="number"
                          min={0}
                          value={variant.stockQuantity}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              stockQuantity: event.target.value,
                            }))
                          }
                          disabled={mediaBusy}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Variant Image URL (Optional)</label>
                        <Input
                          type="url"
                          value={variant.imageUrl}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              imageUrl: event.target.value,
                            }))
                          }
                          placeholder="https://..."
                          disabled={mediaBusy}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={variant.isDefault}
                          onChange={() => setVariantDefault(index)}
                          disabled={mediaBusy}
                        />
                        Default variant
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={variant.isActive}
                          onChange={(event) =>
                            updateVariant(index, (current) => ({
                              ...current,
                              isActive: event.target.checked,
                            }))
                          }
                          disabled={mediaBusy}
                        />
                        Active
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No variants added. Product will use single price and stock.
              </p>
            )}
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
                disabled={mediaBusy}
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
                  disabled={mediaBusy}
                  onClick={() => imageFileInputRef.current?.click()}
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

          <div className="space-y-2 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium">
                Gallery Images ({form.galleryImageUrls.length}/{maxGalleryImageCount})
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={mediaBusy || form.galleryImageUrls.length >= maxGalleryImageCount}
                onClick={() => galleryFileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {uploadingGalleryImages ? "Uploading..." : "Upload Gallery"}
              </Button>
              <input
                ref={galleryFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={uploadGalleryImages}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                type="url"
                value={galleryImageUrlDraft}
                onChange={(event) => setGalleryImageUrlDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addGalleryImageUrl();
                  }
                }}
                placeholder="Paste additional gallery image URL"
                disabled={mediaBusy || form.galleryImageUrls.length >= maxGalleryImageCount}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addGalleryImageUrl}
                disabled={
                  mediaBusy ||
                  !galleryImageUrlDraft.trim() ||
                  form.galleryImageUrls.length >= maxGalleryImageCount
                }
              >
                Add URL
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Add up to {maxGalleryImageCount} gallery images. You can reorder the display priority.
            </p>

            {form.galleryImageUrls.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {form.galleryImageUrls.map((imageUrl, index) => (
                  <article key={`${imageUrl}-${index}`} className="rounded-xl border border-border p-2">
                    <div
                      className="h-24 w-full rounded-lg border border-border bg-cover bg-center"
                      style={{ backgroundImage: `url("${imageUrl}")` }}
                    />
                    <p className="mt-2 truncate text-xs text-muted-foreground">{imageUrl}</p>
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveGalleryImage(index, "up")}
                        disabled={mediaBusy || index === 0}
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveGalleryImage(index, "down")}
                        disabled={mediaBusy || index === form.galleryImageUrls.length - 1}
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => removeGalleryImage(index)}
                        disabled={mediaBusy}
                        className="ml-auto"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No gallery images added yet.</p>
            )}
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Short Description</label>
            <Input
              value={form.shortDescription}
              onChange={(event) =>
                setForm((current) => ({ ...current, shortDescription: event.target.value }))
              }
              disabled={mediaBusy}
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
              disabled={mediaBusy}
            />
          </div>

          <Button type="submit" disabled={submitting || mediaBusy} className="md:col-span-2">
            {mediaBusy
              ? "Uploading media..."
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
            placeholder="Search name, slug, SKU, seller"
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
          <p className="text-sm text-muted-foreground">Loading products...</p>
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
                        SKU: {product.sku} | Slug: {product.slug}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.categoryName}
                        {product.subcategoryName ? ` / ${product.subcategoryName}` : ""}
                        {product.brandName ? ` | ${product.brandName}` : ""}
                        {product.sellerName ? ` | Seller: ${product.sellerName}` : " | Platform"}
                        {` | Variants: ${product.variants.length}`}
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
                    Price:{" "}
                    <span className="font-semibold text-foreground">{product.currentPrice.toFixed(2)}</span>
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
