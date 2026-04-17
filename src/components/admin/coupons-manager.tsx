"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DiscountScope, DiscountType } from "@prisma/client";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type { CouponAdminPayload, CouponCatalogItem } from "@/types/coupon";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type CouponFormState = {
  code: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountScope: DiscountScope;
  discountValue: string;
  minPurchaseAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  usageLimitPerUser: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  applicableCategoryId: string;
  applicableProductId: string;
};

const initialFormState: CouponFormState = {
  code: "",
  title: "",
  description: "",
  discountType: "PERCENTAGE",
  discountScope: "ORDER",
  discountValue: "",
  minPurchaseAmount: "0",
  maxDiscountAmount: "",
  usageLimit: "",
  usageLimitPerUser: "1",
  startsAt: "",
  expiresAt: "",
  isActive: true,
  applicableCategoryId: "",
  applicableProductId: "",
};

const discountTypes: DiscountType[] = ["PERCENTAGE", "FIXED"];
const discountScopes: DiscountScope[] = ["ORDER", "PRODUCT", "CATEGORY"];

function formatDiscount(coupon: CouponCatalogItem) {
  if (coupon.discountType === "PERCENTAGE") {
    return `${coupon.discountValue}%`;
  }
  return formatCurrency(coupon.discountValue, "LKR");
}

export function CouponsManager() {
  const [coupons, setCoupons] = useState<CouponCatalogItem[]>([]);
  const [categories, setCategories] = useState<CouponAdminPayload["categories"]>([]);
  const [products, setProducts] = useState<CouponAdminPayload["products"]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(initialFormState);

  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<DiscountScope | "">("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (scopeFilter) params.set("scope", scopeFilter);
    if (activeFilter === "active") params.set("active", "true");
    if (activeFilter === "inactive") params.set("active", "false");
    return params.toString();
  }, [activeFilter, query, scopeFilter]);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/coupons${queryParams ? `?${queryParams}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<CouponAdminPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load coupons");
      }

      setCoupons(payload.data.coupons);
      setCategories(payload.data.categories);
      setProducts(payload.data.products);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load coupons");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const onCreateCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          title: form.title,
          description: form.description,
          discountType: form.discountType,
          discountScope: form.discountScope,
          discountValue: form.discountValue,
          minPurchaseAmount: form.minPurchaseAmount,
          maxDiscountAmount: form.maxDiscountAmount,
          usageLimit: form.usageLimit,
          usageLimitPerUser: form.usageLimitPerUser,
          startsAt: form.startsAt,
          expiresAt: form.expiresAt,
          isActive: form.isActive,
          applicableCategoryId: form.applicableCategoryId,
          applicableProductId: form.applicableProductId,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to create coupon");
      }

      setForm(initialFormState);
      await loadCoupons();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create coupon");
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleCoupon = async (coupon: CouponCatalogItem) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update coupon");
      }
      await loadCoupons();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update coupon");
    }
  };

  const onDeleteCoupon = async (coupon: CouponCatalogItem) => {
    const confirmed = window.confirm(`Delete coupon ${coupon.code}?`);
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete coupon");
      }
      await loadCoupons();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete coupon");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Create Coupon</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure order, category, or product promotions with usage rules.
        </p>

        <form onSubmit={onCreateCoupon} className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Coupon Code</label>
            <Input
              required
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="NEWUSER10"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Title</label>
            <Input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="New user launch discount"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Optional internal description"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Discount Type</label>
            <Select
              value={form.discountType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discountType: event.target.value as DiscountType,
                }))
              }
            >
              {discountTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Discount Scope</label>
            <Select
              value={form.discountScope}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discountScope: event.target.value as DiscountScope,
                  applicableCategoryId: "",
                  applicableProductId: "",
                }))
              }
            >
              {discountScopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Discount Value</label>
            <Input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.discountValue}
              onChange={(event) =>
                setForm((current) => ({ ...current, discountValue: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Minimum Purchase (LKR)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.minPurchaseAmount}
              onChange={(event) =>
                setForm((current) => ({ ...current, minPurchaseAmount: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Max Discount (Optional)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.maxDiscountAmount}
              onChange={(event) =>
                setForm((current) => ({ ...current, maxDiscountAmount: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Usage Limit (Optional)</label>
            <Input
              type="number"
              min="1"
              value={form.usageLimit}
              onChange={(event) =>
                setForm((current) => ({ ...current, usageLimit: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Usage Limit Per User</label>
            <Input
              required
              type="number"
              min="1"
              value={form.usageLimitPerUser}
              onChange={(event) =>
                setForm((current) => ({ ...current, usageLimitPerUser: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Starts At</label>
            <Input
              type="date"
              value={form.startsAt}
              onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Expires At</label>
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
            />
          </div>

          {form.discountScope === "CATEGORY" ? (
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium">Applicable Category</label>
              <Select
                required
                value={form.applicableCategoryId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, applicableCategoryId: event.target.value }))
                }
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {form.discountScope === "PRODUCT" ? (
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium">Applicable Product</label>
              <Select
                required
                value={form.applicableProductId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, applicableProductId: event.target.value }))
                }
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            Coupon active
          </label>

          <Button className="md:col-span-2" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Coupon"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <header className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Search code or title"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            value={scopeFilter}
            onChange={(event) => setScopeFilter(event.target.value as DiscountScope | "")}
          >
            <option value="">All Scopes</option>
            {discountScopes.map((scope) => (
              <option key={scope} value={scope}>
                {scope.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          <Select
            value={activeFilter}
            onChange={(event) =>
              setActiveFilter(event.target.value as "all" | "active" | "inactive")
            }
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Button variant="outline" onClick={() => void loadCoupons()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </header>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading coupons...</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coupons found for selected filters.</p>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => (
              <article
                key={coupon.id}
                className="space-y-3 rounded-xl border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {coupon.code} - {coupon.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Scope: {coupon.discountScope.replaceAll("_", " ")} | Type:{" "}
                      {coupon.discountType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <StatusPill value={coupon.isActive ? "ACTIVE" : "INACTIVE"} />
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p className="text-muted-foreground">
                    Discount: <span className="font-semibold text-foreground">{formatDiscount(coupon)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Min Purchase:{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(coupon.minPurchaseAmount, "LKR")}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Used:{" "}
                    <span className="font-semibold text-foreground">
                      {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Per User: <span className="font-semibold text-foreground">{coupon.usageLimitPerUser}</span>
                  </p>
                </div>

                {coupon.applicableCategory || coupon.applicableProduct ? (
                  <p className="text-xs text-muted-foreground">
                    Applies to: {coupon.applicableCategory?.name ?? coupon.applicableProduct?.name}
                  </p>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Active Window:{" "}
                  {coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString() : "Immediate"} -{" "}
                  {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "No expiry"}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onToggleCoupon(coupon)}
                  >
                    {coupon.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void onDeleteCoupon(coupon)}>
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
