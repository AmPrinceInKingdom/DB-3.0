import {
  AccountStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  StockStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { AdminAnalyticsPayload } from "@/types/analytics";

type DecimalLike = Prisma.Decimal | number | string | null;

function toNumber(value: DecimalLike, fallback = 0) {
  if (value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number(value.toString());
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function clampRangeDays(rangeDays: number) {
  if (!Number.isFinite(rangeDays)) return 30;
  return Math.min(365, Math.max(7, Math.floor(rangeDays)));
}

function createEmptyAdminAnalyticsPayload(rangeDays: number, now = new Date()): AdminAnalyticsPayload {
  const safeRangeDays = clampRangeDays(rangeDays);
  const rangeStart = startOfDay(addDays(now, -(safeRangeDays - 1)));
  const trends = Array.from({ length: safeRangeDays }, (_, index) => ({
    date: toDateKey(addDays(rangeStart, index)),
    revenue: 0,
    orders: 0,
    paidOrders: 0,
  }));

  const customerGrowth = Array.from({ length: 6 }, (_, index) => {
    const monthDate = addMonths(now, -(5 - index));
    return {
      month: formatMonthKey(monthDate),
      customers: 0,
    };
  });

  return {
    rangeDays: safeRangeDays,
    summary: {
      totalRevenue: 0,
      previousPeriodRevenue: 0,
      revenueChangePercent: null,
      totalOrders: 0,
      paidOrders: 0,
      paymentSuccessCount: 0,
      paymentPendingCount: 0,
      paymentFailedCount: 0,
      paymentAwaitingVerificationCount: 0,
      paymentSuccessRatePercent: null,
      pendingOrders: 0,
      totalCustomers: 0,
      totalProducts: 0,
      pendingPaymentVerifications: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
    trends,
    paymentMethodUsage: [],
    topProducts: [],
    topCategories: [],
    customerGrowth,
    lowStockAlerts: [],
  };
}

async function runSafeQuery<T>(label: string, query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(`[admin.analytics] ${label} failed`, error);
    }
    return fallback;
  }
}

export async function getAdminAnalyticsDashboard(
  inputRangeDays = 30,
): Promise<AdminAnalyticsPayload> {
  const rangeDays = clampRangeDays(inputRangeDays);
  const now = new Date();
  try {
  const rangeStart = startOfDay(addDays(now, -(rangeDays - 1)));
  const previousRangeStart = startOfDay(addDays(rangeStart, -rangeDays));
  const previousRangeEnd = rangeStart;

  const revenueCurrent = await runSafeQuery(
    "revenueCurrent",
    () =>
      db.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: rangeStart },
        },
        _sum: { grandTotal: true },
      }),
    {
      _sum: {
        grandTotal: null,
      },
    },
  );

  const revenuePrevious = await runSafeQuery(
    "revenuePrevious",
    () =>
      db.order.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: previousRangeStart, lt: previousRangeEnd },
        },
        _sum: { grandTotal: true },
      }),
    {
      _sum: {
        grandTotal: null,
      },
    },
  );

  const totalOrders = await runSafeQuery("totalOrders", () => db.order.count(), 0);

  const pendingOrders = await runSafeQuery("pendingOrders", () =>
    db.order.count({
      where: {
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
          ],
        },
      },
    }),
    0,
  );

  const totalCustomers = await runSafeQuery("totalCustomers", () =>
    db.user.count({
      where: {
        role: UserRole.CUSTOMER,
        status: { not: AccountStatus.DELETED },
      },
    }),
    0,
  );

  const totalProducts = await runSafeQuery("totalProducts", () =>
    db.product.count({
      where: {
        status: { in: [ProductStatus.ACTIVE, ProductStatus.DRAFT, ProductStatus.INACTIVE] },
      },
    }),
    0,
  );

  const pendingPaymentVerifications = await runSafeQuery("pendingPaymentVerifications", () =>
    db.paymentProof.count({
      where: {
        verificationStatus: PaymentStatus.AWAITING_VERIFICATION,
      },
    }),
    0,
  );

  const lowStockCount = await runSafeQuery("lowStockCount", () =>
    db.product.count({
      where: {
        stockStatus: StockStatus.LOW_STOCK,
      },
    }),
    0,
  );

  const outOfStockCount = await runSafeQuery("outOfStockCount", () =>
    db.product.count({
      where: {
        stockStatus: StockStatus.OUT_OF_STOCK,
      },
    }),
    0,
  );

  const ordersInRange = await runSafeQuery(
    "ordersInRange",
    () =>
      db.order.findMany({
        where: {
          createdAt: { gte: rangeStart },
        },
        select: {
          createdAt: true,
          paymentStatus: true,
          grandTotal: true,
          paymentMethod: true,
        },
      }),
    [] as Array<{
      createdAt: Date;
      paymentStatus: PaymentStatus;
      grandTotal: DecimalLike;
      paymentMethod: string;
    }>,
  );

  const topProductRows = await runSafeQuery(
    "topProductRows",
    () =>
      db.orderItem.groupBy({
        by: ["productId", "productName"],
        where: {
          productId: { not: null },
          order: {
            paymentStatus: PaymentStatus.PAID,
            createdAt: { gte: rangeStart },
          },
        },
        _sum: {
          quantity: true,
          lineTotal: true,
        },
        orderBy: {
          _sum: {
            lineTotal: "desc",
          },
        },
        take: 40,
      }),
    [] as Array<{
      productId: string | null;
      productName: string;
      _sum: {
        quantity: number | null;
        lineTotal: DecimalLike;
      };
    }>,
  );

  const customerRows = await runSafeQuery(
    "customerRows",
    () =>
      db.user.findMany({
        where: {
          role: UserRole.CUSTOMER,
          status: { not: AccountStatus.DELETED },
          createdAt: { gte: startOfDay(addMonths(now, -5)) },
        },
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    [] as Array<{
      createdAt: Date;
    }>,
  );

  const stockAlerts = await runSafeQuery(
    "stockAlerts",
    () =>
      db.product.findMany({
        where: {
          stockStatus: {
            in: [StockStatus.LOW_STOCK, StockStatus.OUT_OF_STOCK],
          },
        },
        orderBy: [{ stockStatus: "desc" }, { stockQuantity: "asc" }],
        take: 10,
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          minStockLevel: true,
          stockStatus: true,
        },
      }),
    [] as Array<{
      id: string;
      name: string;
      sku: string;
      stockQuantity: number;
      minStockLevel: number;
      stockStatus: StockStatus;
    }>,
  );

  const currentRevenue = toNumber(revenueCurrent._sum.grandTotal);
  const previousRevenue = toNumber(revenuePrevious._sum.grandTotal);
  const revenueChangePercent =
    previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : null;

  const trendMap = new Map<
    string,
    {
      revenue: number;
      orders: number;
      paidOrders: number;
    }
  >();
  const paymentMethodCountMap = new Map<string, number>();
  let paidOrdersInRange = 0;
  let paymentSuccessCount = 0;
  let paymentPendingCount = 0;
  let paymentFailedCount = 0;
  let paymentAwaitingVerificationCount = 0;

  for (let day = 0; day < rangeDays; day += 1) {
    const date = addDays(rangeStart, day);
    trendMap.set(toDateKey(date), { revenue: 0, orders: 0, paidOrders: 0 });
  }

  for (const order of ordersInRange) {
    const key = toDateKey(order.createdAt);
    const bucket = trendMap.get(key);
    if (!bucket) continue;

    const paymentMethodKey = String(order.paymentMethod);
    paymentMethodCountMap.set(paymentMethodKey, (paymentMethodCountMap.get(paymentMethodKey) ?? 0) + 1);

    bucket.orders += 1;
    switch (order.paymentStatus) {
      case PaymentStatus.PAID: {
        paymentSuccessCount += 1;
        paidOrdersInRange += 1;
        bucket.paidOrders += 1;
        bucket.revenue += toNumber(order.grandTotal);
        break;
      }
      case PaymentStatus.FAILED: {
        paymentFailedCount += 1;
        break;
      }
      case PaymentStatus.PENDING: {
        paymentPendingCount += 1;
        break;
      }
      case PaymentStatus.AWAITING_VERIFICATION: {
        paymentPendingCount += 1;
        paymentAwaitingVerificationCount += 1;
        break;
      }
      default: {
        break;
      }
    }
  }

  const paymentSuccessRatePercent =
    ordersInRange.length > 0
      ? Number(((paymentSuccessCount / ordersInRange.length) * 100).toFixed(2))
      : null;

  const trends = Array.from(trendMap.entries()).map(([date, value]) => ({
    date,
    revenue: Number(value.revenue.toFixed(2)),
    orders: value.orders,
    paidOrders: value.paidOrders,
  }));

  const paymentMethodUsage = Array.from(paymentMethodCountMap.entries())
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count);

  const topProducts = topProductRows.slice(0, 8).map((entry) => ({
    productId: entry.productId,
    name: entry.productName,
    unitsSold: entry._sum.quantity ?? 0,
    revenue: toNumber(entry._sum.lineTotal),
  }));

  const categoryRevenueMap = new Map<string, number>();
  const topCategoryProductIds = topProductRows
    .map((entry) => entry.productId)
    .filter((value): value is string => Boolean(value));

  if (topCategoryProductIds.length > 0) {
    const categoryProducts = await runSafeQuery(
      "categoryProducts",
      () =>
        db.product.findMany({
          where: {
            id: {
              in: topCategoryProductIds,
            },
          },
          select: {
            id: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        }),
      [] as Array<{
        id: string;
        category: {
          name: string;
        };
      }>,
    );

    const categoryByProduct = new Map(categoryProducts.map((item) => [item.id, item.category.name]));

    for (const entry of topProductRows) {
      const productId = entry.productId;
      if (!productId) continue;
      const categoryName = categoryByProduct.get(productId) ?? "Uncategorized";
      const current = categoryRevenueMap.get(categoryName) ?? 0;
      categoryRevenueMap.set(categoryName, current + toNumber(entry._sum.lineTotal));
    }
  }

  const topCategories = Array.from(categoryRevenueMap.entries())
    .map(([category, revenue]) => ({ category, revenue: Number(revenue.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const growthMap = new Map<string, number>();
  for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    const monthDate = addMonths(now, -monthOffset);
    growthMap.set(formatMonthKey(monthDate), 0);
  }

  for (const customer of customerRows) {
    const monthKey = formatMonthKey(customer.createdAt);
    if (!growthMap.has(monthKey)) continue;
    growthMap.set(monthKey, (growthMap.get(monthKey) ?? 0) + 1);
  }

  const customerGrowth = Array.from(growthMap.entries()).map(([month, customers]) => ({
    month,
    customers,
  }));

  return {
    rangeDays,
    summary: {
      totalRevenue: Number(currentRevenue.toFixed(2)),
      previousPeriodRevenue: Number(previousRevenue.toFixed(2)),
      revenueChangePercent:
        revenueChangePercent === null ? null : Number(revenueChangePercent.toFixed(2)),
      totalOrders,
      paidOrders: paidOrdersInRange,
      paymentSuccessCount,
      paymentPendingCount,
      paymentFailedCount,
      paymentAwaitingVerificationCount,
      paymentSuccessRatePercent,
      pendingOrders,
      totalCustomers,
      totalProducts,
      pendingPaymentVerifications,
      lowStockCount,
      outOfStockCount,
    },
    trends,
    paymentMethodUsage,
    topProducts,
    topCategories,
    customerGrowth,
    lowStockAlerts: stockAlerts,
  };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin.analytics] dashboard fallback used", error);
    }
    return createEmptyAdminAnalyticsPayload(rangeDays, now);
  }
}
