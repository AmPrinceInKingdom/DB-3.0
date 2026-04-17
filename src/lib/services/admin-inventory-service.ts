import { Prisma, StockStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import { emitLowStockAdminAlerts } from "@/lib/services/stock-alert-service";

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

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function resolveStockStatus(quantity: number, minStockLevel: number): StockStatus {
  if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
  if (quantity <= minStockLevel) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

type AdminInventoryFilters = {
  query?: string;
  stockFilter?: "all" | "in_stock" | "low_stock" | "out_of_stock";
};

export async function getAdminInventoryDashboard(filters: AdminInventoryFilters = {}) {
  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.ProductWhereInput = {
    ...(queryText
      ? {
          OR: [
            { name: { contains: queryText, mode: "insensitive" } },
            { sku: { contains: queryText, mode: "insensitive" } },
            { category: { name: { contains: queryText, mode: "insensitive" } } },
            { brand: { name: { contains: queryText, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(filters.stockFilter === "in_stock" ? { stockQuantity: { gt: 0 } } : {}),
    ...(filters.stockFilter === "low_stock"
      ? {
          stockQuantity: { gt: 0 },
          stockStatus: StockStatus.LOW_STOCK,
        }
      : {}),
    ...(filters.stockFilter === "out_of_stock" ? { stockQuantity: { lte: 0 } } : {}),
  };

  const [products, stats, recentLogs] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ stockQuantity: "asc" }, { updatedAt: "desc" }],
      take: 300,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        stockStatus: true,
        stockQuantity: true,
        minStockLevel: true,
        totalSold: true,
        currentPrice: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        images: {
          where: { isMain: true },
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: {
            imageUrl: true,
            altText: true,
          },
        },
      },
    }),
    db.product.groupBy({
      by: ["stockStatus"],
      _count: { _all: true },
    }),
    db.inventoryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        productId: true,
        previousQuantity: true,
        changeAmount: true,
        newQuantity: true,
        reason: true,
        referenceType: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        actor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const inStockCount = stats.find((entry) => entry.stockStatus === StockStatus.IN_STOCK)?._count._all ?? 0;
  const lowStockCount = stats.find((entry) => entry.stockStatus === StockStatus.LOW_STOCK)?._count._all ?? 0;
  const outOfStockCount =
    stats.find((entry) => entry.stockStatus === StockStatus.OUT_OF_STOCK)?._count._all ?? 0;
  const totalProducts = stats.reduce((total, entry) => total + entry._count._all, 0);

  return {
    items: products.map((item) => ({
      ...item,
      currentPrice: toNumber(item.currentPrice),
      mainImage: item.images[0] ?? null,
    })),
    stats: {
      totalProducts,
      inStockCount,
      lowStockCount,
      outOfStockCount,
    },
    recentLogs,
  };
}

type AdjustInventoryInput = {
  productId: string;
  mode: "ADJUST" | "SET";
  amount: number;
  reason?: string;
  actorUserId: string;
};

export async function adjustAdminInventory(input: AdjustInventoryInput) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        minStockLevel: true,
        stockStatus: true,
      },
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const previousQuantity = product.stockQuantity;
    const nextQuantity =
      input.mode === "SET" ? input.amount : previousQuantity + input.amount;

    if (nextQuantity < 0) {
      throw new AppError("Stock quantity cannot be negative", 400, "INVALID_STOCK_QUANTITY");
    }

    const changeAmount = nextQuantity - previousQuantity;
    if (changeAmount === 0) {
      throw new AppError("No stock change detected", 400, "NO_STOCK_CHANGE");
    }

    const nextStatus = resolveStockStatus(nextQuantity, product.minStockLevel);
    const reason = normalizeOptionalText(input.reason);

    const updated = await tx.product.update({
      where: { id: product.id },
      data: {
        stockQuantity: nextQuantity,
        stockStatus: nextStatus,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        stockStatus: true,
        minStockLevel: true,
        updatedAt: true,
      },
    });

    await tx.inventoryLog.create({
      data: {
        productId: product.id,
        changedBy: input.actorUserId,
        previousQuantity,
        changeAmount,
        newQuantity: nextQuantity,
        reason,
        referenceType: "ADMIN_MANUAL_ADJUSTMENT",
      },
    });

    await emitLowStockAdminAlerts(tx, {
      productIds: [product.id],
      source: "ADMIN_MANUAL_ADJUSTMENT",
    });

    return updated;
  });
}
