"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  PackageOpen,
  RefreshCcw,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import { useToastStore } from "@/store/toast-store";
import type { SellerDashboardPayload } from "@/types/seller-dashboard";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SellerDashboardManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [data, setData] = useState<SellerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/seller/dashboard", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<SellerDashboardPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load seller dashboard");
      }
      setData(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load seller dashboard";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const trendChartData = useMemo(
    () =>
      (data?.revenueTrend ?? []).map((item) => ({
        label: formatShortDate(item.date),
        revenueBase: item.revenueBase,
        orders: item.orders,
      })),
    [data?.revenueTrend],
  );

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "revenue",
        label: "Revenue (30 days)",
        value: formatCurrency(data.summary.revenueLast30DaysBase, data.currencyCode),
        helper: `${data.summary.paidOrdersLast30Days} paid orders`,
        icon: TrendingUp,
      },
      {
        key: "orders",
        label: "Orders (30 days)",
        value: String(data.summary.ordersLast30Days),
        helper: `Avg order value ${formatCurrency(data.summary.avgOrderValueLast30Base, data.currencyCode)}`,
        icon: ShoppingCart,
      },
      {
        key: "products",
        label: "Active products",
        value: String(data.summary.activeProducts),
        helper: `${data.summary.lowStockProducts} low stock, ${data.summary.outOfStockProducts} out of stock`,
        icon: PackageOpen,
      },
      {
        key: "payouts",
        label: "Pending payouts",
        value: String(data.summary.payoutPendingCount + data.summary.payoutProcessingCount),
        helper: data.summary.lastPayoutAt
          ? `Last paid ${new Date(data.summary.lastPayoutAt).toLocaleDateString()}`
          : "No paid payout yet",
        icon: Wallet,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Live Overview</h2>
            <p className="text-sm text-muted-foreground">
              Real-time widgets for orders, products, stock health, and payout pipeline.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadDashboard()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/seller/orders">Manage Orders</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/seller/products">Manage Products</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/seller/reports">Open Reports</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/seller/payouts">View Payouts</Link>
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Loading seller dashboard...</p>
        </section>
      ) : !data ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">No dashboard data available.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span>{card.label}</span>
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.helper}</p>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2 text-sm font-semibold">
                Revenue Trend (Last {data.rangeDays} days)
              </CardHeader>
              <CardContent className="h-[280px]">
                {trendChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No revenue trend data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenueBase"
                        stroke="#dc2626"
                        fill="#fecaca"
                        name={`Revenue (${data.currencyCode})`}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="orders"
                        stroke="#2563eb"
                        fill="#bfdbfe"
                        name="Orders"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Fulfillment Snapshot</CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">Pending / Confirmed</p>
                  <div className="flex items-center gap-2">
                    <StatusPill value="PENDING" />
                    <span className="font-semibold">{data.summary.pendingOrders}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">Processing</p>
                  <div className="flex items-center gap-2">
                    <StatusPill value="PROCESSING" />
                    <span className="font-semibold">{data.summary.processingOrders}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">Payout queue</p>
                  <div className="flex items-center gap-2">
                    <StatusPill value="PENDING" />
                    <span className="font-semibold">{data.summary.payoutPendingCount}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">Payout processing</p>
                  <div className="flex items-center gap-2">
                    <StatusPill value="PROCESSING" />
                    <span className="font-semibold">{data.summary.payoutProcessingCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Recent Orders</CardHeader>
              <CardContent className="space-y-2">
                {data.recentOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No seller orders yet.</p>
                ) : (
                  data.recentOrders.map((order) => (
                    <article key={order.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">#{order.orderNumber}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill value={order.status} />
                          <StatusPill value={order.paymentStatus} />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{order.customerEmail}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <p>
                          Seller total:{" "}
                          <span className="font-semibold text-foreground">
                            {formatCurrency(order.sellerSubtotal, order.currencyCode)}
                          </span>
                        </p>
                        <p>
                          Items: <span className="font-semibold text-foreground">{order.sellerItems}</span>
                        </p>
                        <p>
                          Units: <span className="font-semibold text-foreground">{order.sellerUnits}</span>
                        </p>
                        <p>{new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      {order.isMultiSellerOrder ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                          Multi-seller order. Admin fulfillment lock is active.
                        </p>
                      ) : null}
                    </article>
                  ))
                )}
                <Button asChild variant="ghost" className="w-full justify-between">
                  <Link href="/seller/orders">
                    Open all orders
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Low Stock Alerts</CardHeader>
              <CardContent className="space-y-2">
                {data.lowStockProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Great! No low stock alerts right now.</p>
                ) : (
                  data.lowStockProducts.map((product) => (
                    <article key={product.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{product.name}</p>
                        <StatusPill value={product.stockStatus} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">SKU: {product.sku}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stock {product.stockQuantity} / Min {product.minStockLevel}
                      </p>
                    </article>
                  ))
                )}
                <Button asChild variant="ghost" className="w-full justify-between">
                  <Link href="/seller/products">
                    Open product inventory
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Top Products (Last 30 days)</h2>
              <Button asChild size="sm" variant="outline">
                <Link href="/seller/products">Manage catalog</Link>
              </Button>
            </div>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid sales data available yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.topProducts.map((item) => (
                  <article key={item.productId ?? item.name} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex gap-3">
                      <div
                        className="h-14 w-14 shrink-0 rounded-lg border border-border bg-cover bg-center"
                        style={{
                          backgroundImage: item.mainImageUrl ? `url("${item.mainImageUrl}")` : undefined,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="truncate text-xs text-muted-foreground">SKU: {item.sku ?? "-"}</p>
                        {item.stockStatus ? <StatusPill className="mt-2" value={item.stockStatus} /> : null}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p>
                        Revenue:{" "}
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.revenueLast30DaysBase, data.currencyCode)}
                        </span>
                      </p>
                      <p>
                        Orders:{" "}
                        <span className="font-semibold text-foreground">{item.ordersLast30Days}</span>
                      </p>
                      <p>
                        Units:{" "}
                        <span className="font-semibold text-foreground">{item.unitsSoldLast30Days}</span>
                      </p>
                      <p>
                        Stock:{" "}
                        <span className="font-semibold text-foreground">
                          {item.stockQuantity === null ? "-" : item.stockQuantity}
                        </span>
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
