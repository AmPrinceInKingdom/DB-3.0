"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { ExternalLink, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type { AdminOrderListItem } from "@/types/order";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const orderStatuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const paymentStatuses: PaymentStatus[] = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "AWAITING_VERIFICATION",
];

export function AdminOrdersManager() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, OrderStatus>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (paymentStatusFilter) params.set("paymentStatus", paymentStatusFilter);
    return params.toString();
  }, [paymentStatusFilter, query, statusFilter]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders${queryParams ? `?${queryParams}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminOrderListItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load orders");
      }

      const list = payload.data ?? [];
      setOrders(list);
      setStatusDrafts((current) => {
        const next = { ...current };
        for (const order of list) {
          next[order.id] = next[order.id] ?? order.status;
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load orders");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const updateStatus = async (orderId: string) => {
    const status = statusDrafts[orderId];
    if (!status) return;

    setUpdatingOrderId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update order status");
      }
      await loadOrders();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search by order no or customer email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All Order Statuses</option>
          {orderStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Select
          value={paymentStatusFilter}
          onChange={(event) => setPaymentStatusFilter(event.target.value)}
        >
          <option value="">All Payment Statuses</option>
          {paymentStatuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadOrders()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </section>
      ) : orders.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No orders found for selected filters.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">#{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customerEmail} - {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill value={order.status} />
                  <StatusPill value={order.paymentStatus} />
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <p className="text-muted-foreground">
                  Payment:{" "}
                  <span className="font-semibold text-foreground">
                    {order.paymentMethod.replaceAll("_", " ")}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Items: <span className="font-semibold text-foreground">{order.items.length}</span>
                </p>
                <p className="text-muted-foreground">
                  Total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(order.grandTotal, order.currencyCode)}
                  </span>
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  className="min-w-[180px]"
                  value={statusDrafts[order.id] ?? order.status}
                  onChange={(event) =>
                    setStatusDrafts((current) => ({
                      ...current,
                      [order.id]: event.target.value as OrderStatus,
                    }))
                  }
                >
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void updateStatus(order.id)}
                  disabled={updatingOrderId === order.id}
                >
                  {updatingOrderId === order.id ? "Updating..." : "Update Status"}
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/admin/orders/${order.id}`}>
                    View Details
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
