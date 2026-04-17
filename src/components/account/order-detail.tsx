"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type { CustomerOrderDetail } from "@/types/order";

type Props = {
  orderId: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function AccountOrderDetail({ orderId }: Props) {
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/account/orders/${orderId}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<CustomerOrderDetail>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load order");
      }
      setOrder(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading order details...</p>
      </section>
    );
  }

  if (!order || error) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h1 className="text-2xl font-bold">Order not available</h1>
        <p className="text-sm text-red-600">{error ?? "Unable to load order details."}</p>
        <Button variant="outline" asChild>
          <Link href="/account/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Order Detail</p>
          <h1 className="text-2xl font-bold">#{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadOrder()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/account/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Orders
            </Link>
          </Button>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <StatusPill value={order.status} />
          <StatusPill value={order.paymentStatus} />
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-muted-foreground">
            Payment Method:{" "}
            <span className="font-semibold text-foreground">
              {order.paymentMethod.replaceAll("_", " ")}
            </span>
          </p>
          <p className="text-muted-foreground">
            Tracking: <span className="font-semibold text-foreground">{order.trackingNumber ?? "-"}</span>
          </p>
          <p className="text-muted-foreground">
            Email: <span className="font-semibold text-foreground">{order.customerEmail}</span>
          </p>
          <p className="text-muted-foreground">
            Phone: <span className="font-semibold text-foreground">{order.customerPhone ?? "-"}</span>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Items</h2>
        <div className="mt-3 space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <div>
                <p className="font-semibold">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  Qty: {item.quantity}
                  {item.variantName ? ` - ${item.variantName}` : ""}
                </p>
              </div>
              <span className="font-semibold">{formatCurrency(item.lineTotal, order.currencyCode)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Amount Summary</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.subtotal, order.currencyCode)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>{formatCurrency(order.shippingFee, order.currencyCode)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(order.taxTotal, order.currencyCode)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(order.grandTotal, order.currencyCode)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">Order Timeline</h2>
        <div className="mt-3 space-y-2">
          {order.statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status updates yet.</p>
          ) : (
            order.statusHistory.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-sm font-semibold">{entry.newStatus.replaceAll("_", " ")}</p>
                <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                {entry.note ? <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p> : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
