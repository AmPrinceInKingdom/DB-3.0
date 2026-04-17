"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import type { SellerOrderListItem } from "@/types/seller-order";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type TrackingDraft = {
  trackingNumber: string;
  courierName: string;
  shipmentStatus: ShipmentStatus | "";
  note: string;
};

const orderStatuses: Array<OrderStatus | ""> = [
  "",
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const paymentStatuses: Array<PaymentStatus | ""> = [
  "",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "AWAITING_VERIFICATION",
];

const sellerUpdatableOrderStatuses: OrderStatus[] = ["PROCESSING", "SHIPPED", "DELIVERED"];
const sellerUpdatableShipmentStatuses: ShipmentStatus[] = ["PACKED", "IN_TRANSIT", "DELIVERED", "FAILED"];

function toLabel(value: string) {
  return value.replaceAll("_", " ");
}

function resolveInitialStatusDraft(status: OrderStatus): OrderStatus {
  if (status === "PROCESSING" || status === "SHIPPED" || status === "DELIVERED") {
    return status;
  }
  return "PROCESSING";
}

function createTrackingDraft(order: SellerOrderListItem): TrackingDraft {
  return {
    trackingNumber: order.shipment?.trackingNumber ?? order.trackingNumber ?? "",
    courierName: order.shipment?.courierName ?? "",
    shipmentStatus: order.shipment?.status ?? "",
    note: "",
  };
}

export function SellerOrdersManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [orders, setOrders] = useState<SellerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | "">("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, OrderStatus>>({});
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, TrackingDraft>>({});
  const [statusSubmittingId, setStatusSubmittingId] = useState<string | null>(null);
  const [trackingSubmittingId, setTrackingSubmittingId] = useState<string | null>(null);

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
      const response = await fetch(`/api/seller/orders${queryParams ? `?${queryParams}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<SellerOrderListItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load seller orders");
      }

      const list = payload.data ?? [];
      setOrders(list);
      setStatusDrafts((current) => {
        const next = { ...current };
        for (const order of list) {
          next[order.id] = next[order.id] ?? resolveInitialStatusDraft(order.status);
        }
        return next;
      });
      setTrackingDrafts((current) => {
        const next = { ...current };
        for (const order of list) {
          next[order.id] = next[order.id] ?? createTrackingDraft(order);
        }
        return next;
      });
      setStatusNotes((current) => {
        const next = { ...current };
        for (const order of list) {
          next[order.id] = next[order.id] ?? "";
        }
        return next;
      });
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load seller orders";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast, queryParams]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const updateOrderStatus = async (order: SellerOrderListItem) => {
    const nextStatus = statusDrafts[order.id] ?? order.status;
    const note = statusNotes[order.id]?.trim();

    if (nextStatus === order.status && !note) {
      pushToast("No status changes to save", "info");
      return;
    }

    setStatusSubmittingId(order.id);
    setError(null);

    try {
      const response = await fetch(`/api/seller/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(note ? { note } : {}),
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update order status");
      }

      setStatusNotes((current) => ({ ...current, [order.id]: "" }));
      pushToast("Order status updated", "success");
      await loadOrders();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update order status";
      setError(message);
      pushToast(message, "error");
    } finally {
      setStatusSubmittingId(null);
    }
  };

  const updateOrderTracking = async (order: SellerOrderListItem) => {
    const draft = trackingDrafts[order.id] ?? createTrackingDraft(order);
    const currentTracking = order.shipment?.trackingNumber ?? order.trackingNumber ?? "";
    const currentCourier = order.shipment?.courierName ?? "";
    const currentShipmentStatus = order.shipment?.status ?? "";

    const payload: Record<string, string> = {};

    if (draft.trackingNumber.trim() !== currentTracking) {
      payload.trackingNumber = draft.trackingNumber.trim();
    }
    if (draft.courierName.trim() !== currentCourier) {
      payload.courierName = draft.courierName.trim();
    }
    if (draft.shipmentStatus && draft.shipmentStatus !== currentShipmentStatus) {
      payload.shipmentStatus = draft.shipmentStatus;
    }
    if (draft.note.trim().length > 0) {
      payload.note = draft.note.trim();
    }

    if (Object.keys(payload).length === 0) {
      pushToast("No tracking changes to save", "info");
      return;
    }

    setTrackingSubmittingId(order.id);
    setError(null);

    try {
      const response = await fetch(`/api/seller/orders/${order.id}/tracking`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to update tracking");
      }

      setTrackingDrafts((current) => ({
        ...current,
        [order.id]: {
          ...createTrackingDraft(order),
          trackingNumber: payload.trackingNumber ?? draft.trackingNumber,
          courierName: payload.courierName ?? draft.courierName,
          shipmentStatus: (payload.shipmentStatus as ShipmentStatus | undefined) ?? draft.shipmentStatus,
          note: "",
        },
      }));
      pushToast("Tracking details updated", "success");
      await loadOrders();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update tracking";
      setError(message);
      pushToast(message, "error");
    } finally {
      setTrackingSubmittingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search order no, customer email, tracking"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "")}
        >
          {orderStatuses.map((status) => (
            <option key={status || "ALL"} value={status}>
              {status ? toLabel(status) : "All Order Statuses"}
            </option>
          ))}
        </Select>
        <Select
          value={paymentStatusFilter}
          onChange={(event) => setPaymentStatusFilter(event.target.value as PaymentStatus | "")}
        >
          {paymentStatuses.map((status) => (
            <option key={status || "ALL"} value={status}>
              {status ? toLabel(status) : "All Payment Statuses"}
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
          <p className="text-sm text-muted-foreground">Loading seller orders...</p>
        </section>
      ) : orders.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold">No seller orders yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders containing your products will appear here.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {orders.map((order) => {
            const trackingDraft = trackingDrafts[order.id] ?? createTrackingDraft(order);
            const isLocked = order.isMultiSellerOrder;
            const isStatusSubmitting = statusSubmittingId === order.id;
            const isTrackingSubmitting = trackingSubmittingId === order.id;
            const statusDraftValue = statusDrafts[order.id] ?? resolveInitialStatusDraft(order.status);

            return (
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
                    {order.shipment?.status ? <StatusPill value={order.shipment.status} /> : null}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p className="text-muted-foreground">
                    Seller Total:{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(order.sellerSubtotal, order.currencyCode)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Seller Items: <span className="font-semibold text-foreground">{order.sellerItemCount}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Units: <span className="font-semibold text-foreground">{order.sellerUnits}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Payment:{" "}
                    <span className="font-semibold text-foreground">{toLabel(order.paymentMethod)}</span>
                  </p>
                </div>

                <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Seller Line Items
                  </p>
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                          {item.variantName ? ` - ${item.variantName}` : ""}
                          {item.sku ? ` - SKU: ${item.sku}` : ""}
                        </p>
                      </div>
                      <span className="font-semibold">{formatCurrency(item.lineTotal, order.currencyCode)}</span>
                    </div>
                  ))}
                </div>

                {isLocked ? (
                  <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                    This is a multi-seller order. Fulfillment status updates are managed by admin.
                  </p>
                ) : null}

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <section className="space-y-2 rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-semibold">Order Status Update</p>
                    <Select
                      value={statusDraftValue}
                      onChange={(event) =>
                        setStatusDrafts((current) => ({
                          ...current,
                          [order.id]: event.target.value as OrderStatus,
                        }))
                      }
                      disabled={isLocked || isStatusSubmitting}
                    >
                      {sellerUpdatableOrderStatuses.map((status) => (
                        <option key={status} value={status}>
                          {toLabel(status)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      placeholder="Status note (optional)"
                      value={statusNotes[order.id] ?? ""}
                      onChange={(event) =>
                        setStatusNotes((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      disabled={isLocked || isStatusSubmitting}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void updateOrderStatus(order)}
                      disabled={isLocked || isStatusSubmitting}
                    >
                      {isStatusSubmitting ? "Saving..." : "Save Status"}
                    </Button>
                  </section>

                  <section className="space-y-2 rounded-xl border border-border bg-background p-3">
                    <p className="text-sm font-semibold">Tracking Update</p>
                    <Input
                      placeholder="Tracking number"
                      value={trackingDraft.trackingNumber}
                      onChange={(event) =>
                        setTrackingDrafts((current) => ({
                          ...current,
                          [order.id]: {
                            ...trackingDraft,
                            trackingNumber: event.target.value,
                          },
                        }))
                      }
                      disabled={isLocked || isTrackingSubmitting}
                    />
                    <Input
                      placeholder="Courier name"
                      value={trackingDraft.courierName}
                      onChange={(event) =>
                        setTrackingDrafts((current) => ({
                          ...current,
                          [order.id]: {
                            ...trackingDraft,
                            courierName: event.target.value,
                          },
                        }))
                      }
                      disabled={isLocked || isTrackingSubmitting}
                    />
                    <Select
                      value={trackingDraft.shipmentStatus}
                      onChange={(event) =>
                        setTrackingDrafts((current) => ({
                          ...current,
                          [order.id]: {
                            ...trackingDraft,
                            shipmentStatus: event.target.value as ShipmentStatus | "",
                          },
                        }))
                      }
                      disabled={isLocked || isTrackingSubmitting}
                    >
                      <option value="">Keep current shipment status</option>
                      {sellerUpdatableShipmentStatuses.map((status) => (
                        <option key={status} value={status}>
                          {toLabel(status)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      placeholder="Tracking note (optional)"
                      value={trackingDraft.note}
                      onChange={(event) =>
                        setTrackingDrafts((current) => ({
                          ...current,
                          [order.id]: {
                            ...trackingDraft,
                            note: event.target.value,
                          },
                        }))
                      }
                      disabled={isLocked || isTrackingSubmitting}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void updateOrderTracking(order)}
                      disabled={isLocked || isTrackingSubmitting}
                    >
                      {isTrackingSubmitting ? "Saving..." : "Save Tracking"}
                    </Button>
                  </section>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
