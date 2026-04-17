"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrency } from "@/lib/utils";
import type { SellerAnalyticsPayload } from "@/types/analytics";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const rangeOptions = [7, 30, 90, 180];
const pieColors = ["#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#0ea5e9", "#7c3aed"];

function formatPercent(value: number | null) {
  if (value === null) return "N/A";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function shortLabel(value: string, maxLength = 18) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

export function SellerAnalyticsManager() {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState<SellerAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/seller/analytics?days=${rangeDays}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<SellerAnalyticsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load seller analytics");
      }
      setData(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load seller analytics");
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const topProductChartData = useMemo(
    () =>
      (data?.topProducts ?? []).map((item) => ({
        name: shortLabel(item.name, 16),
        revenue: Number(item.revenueBase.toFixed(2)),
      })),
    [data?.topProducts],
  );

  const orderStatusChartData = useMemo(
    () =>
      (data?.orderStatusBreakdown ?? []).map((item) => ({
        status: item.status.replaceAll("_", " "),
        count: item.count,
      })),
    [data?.orderStatusBreakdown],
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Select
          className="w-full max-w-[220px]"
          value={String(rangeDays)}
          onChange={(event) => setRangeDays(Number(event.target.value))}
        >
          {rangeOptions.map((days) => (
            <option key={days} value={days}>
              Last {days} days
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void loadAnalytics()}>
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
          <p className="text-sm text-muted-foreground">Loading seller analytics...</p>
        </section>
      ) : !data ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">No analytics data available.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2 text-sm text-muted-foreground">
                Revenue ({data.rangeDays}d)
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">
                  {formatCurrency(data.summary.totalRevenueBase, data.currencyCode)}
                </p>
                <p
                  className={`text-xs ${
                    data.summary.revenueChangePercent !== null &&
                    data.summary.revenueChangePercent < 0
                      ? "text-red-600 dark:text-red-300"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatPercent(data.summary.revenueChangePercent)} vs previous period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 text-sm text-muted-foreground">Orders ({data.rangeDays}d)</CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">{data.summary.totalOrders}</p>
                <p className="text-xs text-muted-foreground">
                  Paid: {data.summary.paidOrders} | Processing: {data.summary.processingOrders}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 text-sm text-muted-foreground">Average Order Value</CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">
                  {formatCurrency(data.summary.avgOrderValueBase, data.currencyCode)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Delivered: {data.summary.deliveredOrders} | Shipped: {data.summary.shippedOrders}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 text-sm text-muted-foreground">Product Health</CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">{data.summary.activeProducts}</p>
                <p className="text-xs text-muted-foreground">
                  {data.summary.lowStockCount} low stock, {data.summary.outOfStockCount} out of stock
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">
                Revenue, Orders & Units Trend ({data.rangeDays} days)
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
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
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="units"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                      name="Units"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Payment Method Usage</CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.paymentMethodUsage}
                      dataKey="count"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label
                    >
                      {data.paymentMethodUsage.map((entry, index) => (
                        <Cell
                          key={`${entry.method}-${index}`}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Top Products by Revenue</CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Order Status Breakdown</CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderStatusChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Monthly Revenue (6 months)</CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="revenueBase"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={`Revenue (${data.currencyCode})`}
                    />
                    <Line
                      type="monotone"
                      dataKey="orders"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Orders"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Low Stock Alerts</CardHeader>
              <CardContent className="space-y-2">
                {data.lowStockAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No low stock alerts right now.</p>
                ) : (
                  data.lowStockAlerts.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{item.name}</p>
                        <span className="text-xs text-muted-foreground">{item.sku}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Qty: {item.stockQuantity} | Min: {item.minStockLevel}
                      </p>
                      <div className="mt-2">
                        <StatusPill value={item.stockStatus} />
                      </div>
                    </article>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Top Product Details</h2>
            <div className="mt-3 space-y-2">
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No paid-product performance data available.</p>
              ) : (
                data.topProducts.map((item) => (
                  <article
                    key={`${item.productId ?? item.name}`}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{item.name}</p>
                      <span className="font-semibold">
                        {formatCurrency(item.revenueBase, data.currencyCode)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Units: {item.unitsSold} | Orders: {item.ordersCount}
                      {item.stockQuantity !== null ? ` | Stock: ${item.stockQuantity}` : ""}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
