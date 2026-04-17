import { PaymentStatus, Prisma, ProductStatus, StockStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { SellerDashboardPayload } from "@/types/seller-dashboard";

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

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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

export async function getSellerDashboardData(sellerUserId: string): Promise<SellerDashboardPayload> {
  await requireActiveSellerProfile(sellerUserId);

  const rangeDays = 30;
  const now = new Date();
  const rangeStart = startOfDay(addDays(now, -(rangeDays - 1)));

  const [
    activeProducts,
    lowStockProductsCount,
    outOfStockProductsCount,
    lowStockProducts,
    pendingOrders,
    processingOrders,
    payoutPendingCount,
    payoutProcessingCount,
    lastPaidPayout,
    ordersLast30Rows,
    recentOrdersRows,
    topProductRows,
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
      orderBy: [{ stockQuantity: "asc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        name: true,
        sku: true,
        stockStatus: true,
        stockQuantity: true,
        minStockLevel: true,
        updatedAt: true,
      },
    }),
    db.order.count({
      where: {
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
    }),
    db.order.count({
      where: {
        status: "PROCESSING",
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
    }),
    db.sellerPayout.count({
      where: {
        sellerId: sellerUserId,
        status: "PENDING",
      },
    }),
    db.sellerPayout.count({
      where: {
        sellerId: sellerUserId,
        status: "PROCESSING",
      },
    }),
    db.sellerPayout.findFirst({
      where: {
        sellerId: sellerUserId,
        status: "PAID",
        paidAt: {
          not: null,
        },
      },
      orderBy: {
        paidAt: "desc",
      },
      select: {
        paidAt: true,
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
        items: {
          some: {
            sellerId: sellerUserId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        currencyCode: true,
        customerEmail: true,
        items: {
          where: {
            sellerId: sellerUserId,
          },
          select: {
            quantity: true,
            lineTotal: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
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
        sku: true,
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
  ]);

  const revenueTrendMap = new Map<
    string,
    {
      orders: number;
      revenueBase: number;
    }
  >();

  for (let day = 0; day < rangeDays; day += 1) {
    const date = addDays(rangeStart, day);
    revenueTrendMap.set(toDateKey(date), { orders: 0, revenueBase: 0 });
  }

  let ordersLast30Days = 0;
  let paidOrdersLast30Days = 0;
  let revenueLast30DaysBase = 0;

  for (const order of ordersLast30Rows) {
    ordersLast30Days += 1;
    const bucket = revenueTrendMap.get(toDateKey(order.createdAt));

    const sellerRevenueBase = order.items.reduce((sum, item) => {
      return sum + toBaseAmount(toNumber(item.lineTotal), toNumber(order.exchangeRateToBase, 1));
    }, 0);

    if (bucket) {
      bucket.orders += 1;
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      paidOrdersLast30Days += 1;
      revenueLast30DaysBase += sellerRevenueBase;
      if (bucket) {
        bucket.revenueBase += sellerRevenueBase;
      }
    }
  }

  const revenueTrend = Array.from(revenueTrendMap.entries()).map(([date, value]) => ({
    date,
    orders: value.orders,
    revenueBase: Number(value.revenueBase.toFixed(2)),
  }));

  const recentOrders = recentOrdersRows.map((order) => {
    const sellerSubtotal = order.items.reduce((sum, item) => sum + toNumber(item.lineTotal), 0);
    const sellerUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      currencyCode: order.currencyCode,
      customerEmail: order.customerEmail,
      sellerSubtotal: Number(sellerSubtotal.toFixed(2)),
      sellerUnits,
      sellerItems: order.items.length,
      totalOrderItems: order._count.items,
      isMultiSellerOrder: order._count.items > order.items.length,
    };
  });

  const productPerformanceMap = new Map<
    string,
    {
      productId: string | null;
      name: string;
      sku: string | null;
      unitsSold: number;
      orders: Set<string>;
      revenueBase: number;
    }
  >();

  for (const item of topProductRows) {
    const key = item.productId ?? `name:${item.productName}`;
    const current = productPerformanceMap.get(key) ?? {
      productId: item.productId,
      name: item.productName,
      sku: item.sku,
      unitsSold: 0,
      orders: new Set<string>(),
      revenueBase: 0,
    };

    current.unitsSold += item.quantity;
    current.orders.add(item.orderId);
    current.revenueBase += toBaseAmount(
      toNumber(item.lineTotal),
      toNumber(item.order.exchangeRateToBase, 1),
    );

    productPerformanceMap.set(key, current);
  }

  const productIds = Array.from(productPerformanceMap.values())
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));

  const productDetails = productIds.length
    ? await db.product.findMany({
        where: {
          id: { in: productIds },
        },
        select: {
          id: true,
          sku: true,
          stockStatus: true,
          stockQuantity: true,
          images: {
            where: { isMain: true },
            take: 1,
            select: {
              imageUrl: true,
            },
          },
        },
      })
    : [];

  const productDetailsById = new Map(productDetails.map((item) => [item.id, item]));

  const topProducts = Array.from(productPerformanceMap.values())
    .map((item) => {
      const detail = item.productId ? productDetailsById.get(item.productId) : null;
      return {
        productId: item.productId,
        name: item.name,
        sku: detail?.sku ?? item.sku,
        stockStatus: detail?.stockStatus ?? null,
        stockQuantity: detail?.stockQuantity ?? null,
        mainImageUrl: detail?.images[0]?.imageUrl ?? null,
        unitsSoldLast30Days: item.unitsSold,
        ordersLast30Days: item.orders.size,
        revenueLast30DaysBase: Number(item.revenueBase.toFixed(2)),
      };
    })
    .sort((a, b) => b.revenueLast30DaysBase - a.revenueLast30DaysBase)
    .slice(0, 6);

  return {
    generatedAt: now.toISOString(),
    rangeDays,
    currencyCode: "LKR",
    summary: {
      revenueLast30DaysBase: Number(revenueLast30DaysBase.toFixed(2)),
      ordersLast30Days,
      paidOrdersLast30Days,
      avgOrderValueLast30Base: Number(
        (paidOrdersLast30Days > 0 ? revenueLast30DaysBase / paidOrdersLast30Days : 0).toFixed(2),
      ),
      pendingOrders,
      processingOrders,
      activeProducts,
      lowStockProducts: lowStockProductsCount,
      outOfStockProducts: outOfStockProductsCount,
      payoutPendingCount,
      payoutProcessingCount,
      lastPayoutAt: lastPaidPayout?.paidAt ? lastPaidPayout.paidAt.toISOString() : null,
    },
    revenueTrend,
    recentOrders,
    topProducts,
    lowStockProducts: lowStockProducts.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      stockStatus: item.stockStatus,
      stockQuantity: item.stockQuantity,
      minStockLevel: item.minStockLevel,
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}
