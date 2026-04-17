import { OrderStatus, PaymentStatus, Prisma, ProductStatus, StockStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { SellerAnalyticsPayload } from "@/types/analytics";

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

function toBaseAmount(amount: number, exchangeRateToBase: number) {
  if (!Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0) return amount;
  return amount / exchangeRateToBase;
}

function clampRangeDays(rangeDays: number) {
  if (!Number.isFinite(rangeDays)) return 30;
  return Math.min(180, Math.max(7, Math.floor(rangeDays)));
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(date: Date) {
  const copy = new Date(date);
  copy.setDate(1);
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

async function requireActiveSellerProfile(sellerUserId: string) {
  const seller = await db.seller.findUnique({
    where: { userId: sellerUserId },
    select: {
      userId: true,
      status: true,
    },
  });

  if (!seller || seller.status !== "ACTIVE") {
    throw new AppError("Active seller profile required", 403, "SELLER_PROFILE_INACTIVE");
  }
}

export async function getSellerAnalyticsDashboard(
  sellerUserId: string,
  inputRangeDays = 30,
): Promise<SellerAnalyticsPayload> {
  await requireActiveSellerProfile(sellerUserId);

  const rangeDays = clampRangeDays(inputRangeDays);
  const now = new Date();
  const rangeStart = startOfDay(addDays(now, -(rangeDays - 1)));
  const previousRangeStart = startOfDay(addDays(rangeStart, -rangeDays));
  const previousRangeEnd = rangeStart;
  const monthStart = startOfMonth(addMonths(now, -5));

  const [
    activeProducts,
    lowStockCount,
    outOfStockCount,
    lowStockAlerts,
    orderRowsInRange,
    orderRowsPreviousRange,
    paymentMethodUsage,
    orderStatusBreakdown,
    paidProductRows,
    monthlyOrderRows,
  ] = await Promise.all([
    db.product.count({
      where: {
        sellerId: sellerUserId,
        status: ProductStatus.ACTIVE,
      },
    }),
    db.product.count({
      where: {
        sellerId: sellerUserId,
        stockStatus: StockStatus.LOW_STOCK,
        status: {
          in: [ProductStatus.DRAFT, ProductStatus.ACTIVE, ProductStatus.INACTIVE],
        },
      },
    }),
    db.product.count({
      where: {
        sellerId: sellerUserId,
        stockStatus: StockStatus.OUT_OF_STOCK,
        status: {
          in: [ProductStatus.DRAFT, ProductStatus.ACTIVE, ProductStatus.INACTIVE],
        },
      },
    }),
    db.product.findMany({
      where: {
        sellerId: sellerUserId,
        stockStatus: {
          in: [StockStatus.LOW_STOCK, StockStatus.OUT_OF_STOCK],
        },
        status: {
          in: [ProductStatus.DRAFT, ProductStatus.ACTIVE, ProductStatus.INACTIVE],
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
    db.order.findMany({
      where: {
        createdAt: { gte: rangeStart },
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        exchangeRateToBase: true,
        items: {
          where: {
            sellerId: sellerUserId,
          },
          select: {
            quantity: true,
            lineTotal: true,
          },
        },
      },
    }),
    db.order.findMany({
      where: {
        createdAt: { gte: previousRangeStart, lt: previousRangeEnd },
        paymentStatus: PaymentStatus.PAID,
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
      select: {
        exchangeRateToBase: true,
        items: {
          where: {
            sellerId: sellerUserId,
          },
          select: {
            lineTotal: true,
          },
        },
      },
    }),
    db.order.groupBy({
      by: ["paymentMethod"],
      where: {
        createdAt: { gte: rangeStart },
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    }),
    db.order.groupBy({
      by: ["status"],
      where: {
        createdAt: { gte: rangeStart },
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    }),
    db.orderItem.findMany({
      where: {
        sellerId: sellerUserId,
        order: {
          paymentStatus: PaymentStatus.PAID,
          createdAt: { gte: rangeStart },
        },
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        lineTotal: true,
        orderId: true,
        order: {
          select: {
            exchangeRateToBase: true,
          },
        },
      },
      take: 6000,
    }),
    db.order.findMany({
      where: {
        createdAt: { gte: monthStart },
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        paymentStatus: true,
        exchangeRateToBase: true,
        items: {
          where: {
            sellerId: sellerUserId,
          },
          select: {
            lineTotal: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  const trendMap = new Map<
    string,
    {
      revenueBase: number;
      orders: number;
      units: number;
    }
  >();

  for (let day = 0; day < rangeDays; day += 1) {
    const date = addDays(rangeStart, day);
    trendMap.set(toDateKey(date), { revenueBase: 0, orders: 0, units: 0 });
  }

  let totalRevenueBase = 0;
  let totalOrders = 0;
  let paidOrders = 0;
  let processingOrders = 0;
  let shippedOrders = 0;
  let deliveredOrders = 0;

  for (const order of orderRowsInRange) {
    totalOrders += 1;

    if (order.status === OrderStatus.PROCESSING) processingOrders += 1;
    if (order.status === OrderStatus.SHIPPED) shippedOrders += 1;
    if (order.status === OrderStatus.DELIVERED) deliveredOrders += 1;
    if (order.paymentStatus === PaymentStatus.PAID) paidOrders += 1;

    const orderRevenueBase = order.items.reduce((sum, item) => {
      return sum + toBaseAmount(toNumber(item.lineTotal), toNumber(order.exchangeRateToBase, 1));
    }, 0);

    const orderUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const key = toDateKey(order.createdAt);
    const bucket = trendMap.get(key);
    if (bucket) {
      bucket.orders += 1;
      bucket.units += orderUnits;
      if (order.paymentStatus === PaymentStatus.PAID) {
        bucket.revenueBase += orderRevenueBase;
      }
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      totalRevenueBase += orderRevenueBase;
    }
  }

  const previousPeriodRevenueBase = orderRowsPreviousRange.reduce((orderSum, order) => {
    const orderRevenueBase = order.items.reduce((lineSum, item) => {
      return lineSum + toBaseAmount(toNumber(item.lineTotal), toNumber(order.exchangeRateToBase, 1));
    }, 0);
    return orderSum + orderRevenueBase;
  }, 0);

  const revenueChangePercent =
    previousPeriodRevenueBase > 0
      ? ((totalRevenueBase - previousPeriodRevenueBase) / previousPeriodRevenueBase) * 100
      : null;

  const trends = Array.from(trendMap.entries()).map(([date, value]) => ({
    date,
    revenueBase: Number(value.revenueBase.toFixed(2)),
    orders: value.orders,
    units: value.units,
  }));

  const paymentUsage = paymentMethodUsage.map((entry) => ({
    method: entry.paymentMethod,
    count: entry._count.id,
  }));

  const statusBreakdown = orderStatusBreakdown.map((entry) => ({
    status: entry.status,
    count: entry._count.id,
  }));

  const productMap = new Map<
    string,
    {
      productId: string | null;
      name: string;
      unitsSold: number;
      orders: Set<string>;
      revenueBase: number;
    }
  >();

  for (const row of paidProductRows) {
    const key = row.productId ?? `name:${row.productName}`;
    const current = productMap.get(key) ?? {
      productId: row.productId,
      name: row.productName,
      unitsSold: 0,
      orders: new Set<string>(),
      revenueBase: 0,
    };

    current.unitsSold += row.quantity;
    current.orders.add(row.orderId);
    current.revenueBase += toBaseAmount(
      toNumber(row.lineTotal),
      toNumber(row.order.exchangeRateToBase, 1),
    );
    productMap.set(key, current);
  }

  const productIds = Array.from(productMap.values())
    .map((item) => item.productId)
    .filter((productId): productId is string => Boolean(productId));

  const productStocks = productIds.length
    ? await db.product.findMany({
        where: {
          id: { in: productIds },
        },
        select: {
          id: true,
          stockQuantity: true,
          stockStatus: true,
        },
      })
    : [];

  const stockByProductId = new Map(
    productStocks.map((product) => [product.id, product]),
  );

  const topProducts = Array.from(productMap.values())
    .map((item) => ({
      productId: item.productId,
      name: item.name,
      unitsSold: item.unitsSold,
      ordersCount: item.orders.size,
      revenueBase: Number(item.revenueBase.toFixed(2)),
      stockQuantity:
        item.productId && stockByProductId.get(item.productId)
          ? stockByProductId.get(item.productId)!.stockQuantity
          : null,
      stockStatus:
        item.productId && stockByProductId.get(item.productId)
          ? stockByProductId.get(item.productId)!.stockStatus
          : null,
    }))
    .sort((a, b) => b.revenueBase - a.revenueBase)
    .slice(0, 8);

  const monthlyMap = new Map<
    string,
    {
      revenueBase: number;
      orders: number;
    }
  >();

  for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    const date = addMonths(now, -monthOffset);
    monthlyMap.set(formatMonthKey(date), {
      revenueBase: 0,
      orders: 0,
    });
  }

  for (const order of monthlyOrderRows) {
    const monthKey = formatMonthKey(order.createdAt);
    const bucket = monthlyMap.get(monthKey);
    if (!bucket) continue;
    bucket.orders += 1;
    if (order.paymentStatus === PaymentStatus.PAID) {
      const orderRevenueBase = order.items.reduce((sum, item) => {
        return sum + toBaseAmount(toNumber(item.lineTotal), toNumber(order.exchangeRateToBase, 1));
      }, 0);
      bucket.revenueBase += orderRevenueBase;
    }
  }

  const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, value]) => ({
    month,
    revenueBase: Number(value.revenueBase.toFixed(2)),
    orders: value.orders,
  }));

  return {
    rangeDays,
    currencyCode: "LKR",
    summary: {
      totalRevenueBase: Number(totalRevenueBase.toFixed(2)),
      previousPeriodRevenueBase: Number(previousPeriodRevenueBase.toFixed(2)),
      revenueChangePercent:
        revenueChangePercent === null ? null : Number(revenueChangePercent.toFixed(2)),
      totalOrders,
      paidOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      avgOrderValueBase: Number((paidOrders > 0 ? totalRevenueBase / paidOrders : 0).toFixed(2)),
      activeProducts,
      lowStockCount,
      outOfStockCount,
    },
    trends,
    paymentMethodUsage: paymentUsage,
    orderStatusBreakdown: statusBreakdown,
    topProducts,
    monthlyRevenue,
    lowStockAlerts: lowStockAlerts.map((product) => ({
      ...product,
      stockStatus: product.stockStatus,
    })),
  };
}
