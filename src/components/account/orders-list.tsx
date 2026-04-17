"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type { CustomerOrderListItem } from "@/types/order";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function AccountOrdersList() {
  const [orders, setOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/account/orders", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<CustomerOrderListItem[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load orders");
      }
      setOrders(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading your orders...</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Order History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review all your orders and open details for tracking updates.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadOrders()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold">No orders yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Once you place an order, it will appear here.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/shop">Start Shopping</Link>
          </Button>
        </section>
      ) : (
        <section className="space-y-3">
          {orders.map((order) => (
            <article
              key={order.id}
              className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Order #{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Placed on {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill value={order.status} />
                  <StatusPill value={order.paymentStatus} />
                </div>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p className="text-muted-foreground">
                  Items: <span className="font-semibold text-foreground">{order.items.length}</span>
                </p>
                <p className="text-muted-foreground">
                  Payment:{" "}
                  <span className="font-semibold text-foreground">
                    {order.paymentMethod.replaceAll("_", " ")}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(order.grandTotal, order.currencyCode)}
                  </span>
                </p>
              </div>

              <Button variant="outline" size="sm" asChild>
                <Link href={`/account/orders/${order.id}`}>View Details</Link>
              </Button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
