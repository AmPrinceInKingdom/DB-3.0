"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  CreditCard,
  LayoutDashboard,
  RefreshCcw,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import type { AdminAnalyticsPayload } from "@/types/analytics";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const rangeOptions = [30, 90, 180];

function formatPercent(value: number | null) {
  if (value === null) return "N/A";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AdminDashboardManager() {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/analytics?days=${rangeDays}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiEnvelope<AdminAnalyticsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load admin dashboard");
      }
      setData(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const trendChartData = useMemo(
    () =>
      (data?.trends ?? []).map((item) => ({
        label: formatShortDate(item.date),
        revenue: item.revenue,
        orders: item.orders,
      })),
    [data?.trends],
  );

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "revenue",
        title: `Revenue (${data.rangeDays}d)`,
        value: formatCurrency(data.summary.totalRevenue, "LKR"),
        helper: `${formatPercent(data.summary.revenueChangePercent)} vs previous`,
        icon: LayoutDashboard,
      },
      {
        key: "orders",
        title: "Total Orders",
        value: String(data.summary.totalOrders),
        helper: `${data.summary.paidOrders} paid in selected range`,
        icon: ShoppingCart,
      },
      {
        key: "customers",
        title: "Customers",
        value: String(data.summary.totalCustomers),
        helper: `${data.summary.totalProducts} active/draft/inactive products`,
        icon: Users,
      },
      {
        key: "risk",
        title: "Stock Alerts",
        value: String(data.summary.lowStockCount + data.summary.outOfStockCount),
        helper: `${data.summary.lowStockCount} low, ${data.summary.outOfStockCount} out of stock`,
        icon: Box,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Live Admin Overview</h2>
            <p className="text-sm text-muted-foreground">
              Monitor sales, queues, and operational alerts in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="w-[170px]"
              value={String(rangeDays)}
              onChange={(event) => setRangeDays(Number(event.target.value))}
            >
              {rangeOptions.map((days) => (
                <option key={days} value={days}>
                  Last {days} days
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => void loadDashboard()} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/orders">Orders Queue</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/payments">Payment Verifications</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/inventory">Inventory Alerts</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/settings">Platform Settings</Link>
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
          <p className="text-sm text-muted-foreground">Loading admin dashboard...</p>
        </section>
      ) : !data ? (
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">No admin dashboard data available.</p>
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
                      <span>{card.title}</span>
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

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Successful Payments</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {data.summary.paymentSuccessCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPercent(data.summary.paymentSuccessRatePercent)} success rate ({data.rangeDays}d)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Pending Payments</span>
                  <Clock3 className="h-4 w-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {data.summary.paymentPendingCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.summary.paymentAwaitingVerificationCount} awaiting manual verification
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Failed Payments</span>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.summary.paymentFailedCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  Follow up from payment management for retry and support.
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2 text-sm font-semibold">
                Revenue & Orders Trend ({data.rangeDays} days)
              </CardHeader>
              <CardContent className="h-[280px]">
                {trendChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trend data available.</p>
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
                        dataKey="revenue"
                        stroke="#dc2626"
                        fill="#fecaca"
                        name="Revenue (LKR)"
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
              <CardHeader className="pb-2 text-sm font-semibold">Operational Queue</CardHeader>
              <CardContent className="space-y-3 text-sm">
                <article className="rounded-xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">Pending fulfillment</p>
                  <p className="mt-1 text-xl font-bold">{data.summary.pendingOrders}</p>
                  <Button asChild variant="ghost" size="sm" className="mt-2 w-full justify-between px-0">
                    <Link href="/admin/orders">
                      Go to orders
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </article>

                <article className="rounded-xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">Payment proofs to verify</p>
                  <p className="mt-1 text-xl font-bold">{data.summary.pendingPaymentVerifications}</p>
                  <Button asChild variant="ghost" size="sm" className="mt-2 w-full justify-between px-0">
                    <Link href="/admin/payments">
                      Review payments
                      <CreditCard className="h-4 w-4" />
                    </Link>
                  </Button>
                </article>

                <article className="rounded-xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">Stock risk products</p>
                  <p className="mt-1 text-xl font-bold">
                    {data.summary.lowStockCount + data.summary.outOfStockCount}
                  </p>
                  <Button asChild variant="ghost" size="sm" className="mt-2 w-full justify-between px-0">
                    <Link href="/admin/inventory">
                      Open inventory
                      <Box className="h-4 w-4" />
                    </Link>
                  </Button>
                </article>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Top Products (Revenue)</CardHeader>
              <CardContent className="space-y-2">
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No top product data yet.</p>
                ) : (
                  data.topProducts.slice(0, 6).map((item) => (
                    <article key={`${item.productId ?? item.name}`} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{item.name}</p>
                        <span className="text-sm font-semibold">{formatCurrency(item.revenue, "LKR")}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Units sold: {item.unitsSold} | Product ID: {item.productId ?? "N/A"}
                      </p>
                    </article>
                  ))
                )}
                <Button asChild variant="ghost" className="w-full justify-between">
                  <Link href="/admin/analytics">
                    Open full analytics
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 text-sm font-semibold">Quick Admin Shortcuts</CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Users
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/admin/sellers">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Sellers
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/admin/coupons">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Coupons
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/admin/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start sm:col-span-2">
                  <Link href="/admin/notifications">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Notification Center
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
