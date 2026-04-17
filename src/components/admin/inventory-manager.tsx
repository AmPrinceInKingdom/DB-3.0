"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminInventoryPayload } from "@/types/inventory";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type AdjustmentMode = "ADJUST" | "SET";

type AdjustmentDraft = {
  mode: AdjustmentMode;
  amount: string;
  reason: string;
};

const initialDraft: AdjustmentDraft = {
  mode: "ADJUST",
  amount: "",
  reason: "",
};

function stockFilterLabel(value: StockFilter) {
  if (value === "in_stock") return "In Stock";
  if (value === "low_stock") return "Low Stock";
  if (value === "out_of_stock") return "Out of Stock";
  return "All Stock Levels";
}

export function InventoryManager() {
  const [dashboard, setDashboard] = useState<AdminInventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [adjustmentDrafts, setAdjustmentDrafts] = useState<Record<string, AdjustmentDraft>>({});
  const [submittingProductId, setSubmittingProductId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("stock", stockFilter);
    return params.toString();
  }, [query, stockFilter]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/inventory?${queryParams}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<AdminInventoryPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load inventory");
      }
      const data = payload.data;
      setDashboard(data);
      setAdjustmentDrafts((current) => {
        const next = { ...current };
        for (const item of data.items) {
          next[item.id] = next[item.id] ?? initialDraft;
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load inventory");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const updateDraft = (productId: string, patch: Partial<AdjustmentDraft>) => {
    setAdjustmentDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? initialDraft),
        ...patch,
      },
    }));
  };

  const submitAdjustment = async (productId: string) => {
    const draft = adjustmentDrafts[productId] ?? initialDraft;
    const amountNumber = Number(draft.amount);
    if (!Number.isFinite(amountNumber)) {
      setError("Enter a valid stock amount.");
      return;
    }

    setSubmittingProductId(productId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/inventory/${productId}/adjust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: draft.mode,
          amount: amountNumber,
          reason: draft.reason,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to adjust stock");
      }

      setAdjustmentDrafts((current) => ({
        ...current,
        [productId]: initialDraft,
      }));

      await loadDashboard();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to adjust stock");
    } finally {
      setSubmittingProductId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search product, SKU, category, brand"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={stockFilter}
          onChange={(event) => setStockFilter(event.target.value as StockFilter)}
        >
          {(["all", "in_stock", "low_stock", "out_of_stock"] as StockFilter[]).map((filter) => (
            <option key={filter} value={filter}>
              {stockFilterLabel(filter)}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadDashboard()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {dashboard ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Products</p>
            <p className="mt-2 text-2xl font-bold">{dashboard.stats.totalProducts}</p>
          </article>
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">In Stock</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {dashboard.stats.inStockCount}
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Low Stock</p>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {dashboard.stats.lowStockCount}
            </p>
          </article>
          <article className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Out of Stock</p>
            <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {dashboard.stats.outOfStockCount}
            </p>
          </article>
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loading inventory...</p>
        </section>
      ) : !dashboard || dashboard.items.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No products found for selected filters.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {dashboard.items.map((item) => {
            const draft = adjustmentDrafts[item.id] ?? initialDraft;
            return (
              <article key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {item.sku} - Category: {item.category.name}
                      {item.brand ? ` - Brand: ${item.brand.name}` : ""}
                    </p>
                  </div>
                  <StatusPill value={item.stockStatus} />
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p className="text-muted-foreground">
                    Current Stock: <span className="font-semibold text-foreground">{item.stockQuantity}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Min Level: <span className="font-semibold text-foreground">{item.minStockLevel}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Total Sold: <span className="font-semibold text-foreground">{item.totalSold}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Price:{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(item.currentPrice, "LKR")}
                    </span>
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  <Select
                    value={draft.mode}
                    onChange={(event) =>
                      updateDraft(item.id, { mode: event.target.value as AdjustmentMode })
                    }
                  >
                    <option value="ADJUST">Adjust (+/-)</option>
                    <option value="SET">Set Quantity</option>
                  </Select>
                  <Input
                    type="number"
                    placeholder={draft.mode === "ADJUST" ? "e.g. -5 or 20" : "e.g. 120"}
                    value={draft.amount}
                    onChange={(event) => updateDraft(item.id, { amount: event.target.value })}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Reason (optional)"
                    value={draft.reason}
                    onChange={(event) => updateDraft(item.id, { reason: event.target.value })}
                  />
                </div>

                <Button
                  size="sm"
                  type="button"
                  onClick={() => void submitAdjustment(item.id)}
                  disabled={submittingProductId === item.id || draft.amount.trim().length === 0}
                >
                  {submittingProductId === item.id ? "Updating..." : "Update Stock"}
                </Button>
              </article>
            );
          })}
        </section>
      )}

      {dashboard ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Recent Inventory Adjustments</h2>
          {dashboard.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inventory logs yet.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.recentLogs.map((log) => (
                <article key={log.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {log.product.name} ({log.product.sku})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {log.previousQuantity} {log.changeAmount >= 0 ? `+ ${log.changeAmount}` : `- ${Math.abs(log.changeAmount)}`}{" "}
                    = <span className="font-semibold text-foreground">{log.newQuantity}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    By: {log.actor?.email ?? "System"} | Source: {log.referenceType ?? "-"}
                  </p>
                  {log.reason ? <p className="mt-1 text-xs text-muted-foreground">{log.reason}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
