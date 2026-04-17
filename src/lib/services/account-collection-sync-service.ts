import { ProductStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { WishlistItem } from "@/types/wishlist";
import type { CompareItem } from "@/types/compare";
import type {
  AccountCompareSyncInput,
  AccountWishlistSyncInput,
} from "@/lib/validators/account-collection-sync";

const maxCompareItems = 4;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function sortByMostRecent<T extends { addedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

function dedupeByProductIdWithRecent<T extends { productId: string; addedAt: string }>(items: T[]) {
  const byProductId = new Map<string, T>();

  for (const item of items) {
    const existing = byProductId.get(item.productId);
    if (!existing) {
      byProductId.set(item.productId, item);
      continue;
    }

    const existingAt = new Date(existing.addedAt).getTime();
    const itemAt = new Date(item.addedAt).getTime();
    if (itemAt >= existingAt) {
      byProductId.set(item.productId, item);
    }
  }

  return sortByMostRecent(Array.from(byProductId.values()));
}

function mapWishlistItem(row: {
  createdAt: Date;
  product: {
    id: string;
    slug: string;
    name: string;
    status: ProductStatus;
    stockQuantity: number;
    currentPrice: unknown;
    oldPrice: unknown;
    averageRating: unknown;
    brand: { name: string } | null;
    images: Array<{ imageUrl: string }>;
  };
}): WishlistItem {
  const oldPriceBase = toNumber(row.product.oldPrice);
  return {
    productId: row.product.id,
    slug: row.product.slug,
    name: row.product.name,
    brand: row.product.brand?.name ?? "Deal Bazaar",
    imageUrl: row.product.images[0]?.imageUrl ?? "/next.svg",
    unitPriceBase: toNumber(row.product.currentPrice),
    oldPriceBase: oldPriceBase > 0 ? oldPriceBase : undefined,
    rating: toNumber(row.product.averageRating),
    inStock: row.product.status === ProductStatus.ACTIVE && row.product.stockQuantity > 0,
    addedAt: row.createdAt.toISOString(),
  };
}

function mapCompareItem(row: {
  createdAt: Date;
  product: {
    id: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    status: ProductStatus;
    stockQuantity: number;
    currentPrice: unknown;
    oldPrice: unknown;
    averageRating: unknown;
    brand: { name: string } | null;
    category: { name: string };
    images: Array<{ imageUrl: string }>;
    _count: { reviews: number };
  };
}): CompareItem {
  const oldPriceBase = toNumber(row.product.oldPrice);
  return {
    productId: row.product.id,
    slug: row.product.slug,
    name: row.product.name,
    brand: row.product.brand?.name ?? "Deal Bazaar",
    category: row.product.category.name,
    imageUrl: row.product.images[0]?.imageUrl ?? "/next.svg",
    unitPriceBase: toNumber(row.product.currentPrice),
    oldPriceBase: oldPriceBase > 0 ? oldPriceBase : undefined,
    rating: toNumber(row.product.averageRating),
    reviewsCount: row.product._count.reviews,
    inStock: row.product.status === ProductStatus.ACTIVE && row.product.stockQuantity > 0,
    shortDescription: row.product.shortDescription ?? "No description available.",
    addedAt: row.createdAt.toISOString(),
  };
}

export async function listAccountWishlistItems(userId: string): Promise<WishlistItem[]> {
  const rows = await db.wishlistItem.findMany({
    where: {
      wishlist: {
        userId,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          stockQuantity: true,
          currentPrice: true,
          oldPrice: true,
          averageRating: true,
          brand: { select: { name: true } },
          images: {
            where: { isMain: true },
            select: { imageUrl: true },
            take: 1,
          },
        },
      },
    },
  });

  return rows.map(mapWishlistItem);
}

export async function listAccountCompareItems(userId: string): Promise<CompareItem[]> {
  const rows = await db.compareItem.findMany({
    where: {
      compareList: {
        userId,
      },
    },
    orderBy: { createdAt: "desc" },
    take: maxCompareItems,
    select: {
      createdAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          shortDescription: true,
          status: true,
          stockQuantity: true,
          currentPrice: true,
          oldPrice: true,
          averageRating: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
          images: {
            where: { isMain: true },
            select: { imageUrl: true },
            take: 1,
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
      },
    },
  });

  return rows.map(mapCompareItem);
}

export async function replaceAccountWishlistItems(
  userId: string,
  input: AccountWishlistSyncInput,
): Promise<WishlistItem[]> {
  const dedupedItems = dedupeByProductIdWithRecent(
    input.items.map((item) => ({
      productId: item.productId,
      addedAt: item.addedAt ?? new Date().toISOString(),
    })),
  );

  const productIds = Array.from(
    new Set(dedupedItems.map((item) => item.productId).filter((productId) => isUuid(productId))),
  );

  const validProducts = productIds.length
    ? await db.product.findMany({
        where: {
          id: { in: productIds },
          status: { not: ProductStatus.ARCHIVED },
        },
        select: { id: true },
      })
    : [];
  const validProductIds = new Set(validProducts.map((product) => product.id));

  await db.$transaction(async (tx) => {
    const wishlist = await tx.wishlist.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });

    await tx.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id },
    });

    const createRows = dedupedItems
      .filter((item) => validProductIds.has(item.productId))
      .map((item) => ({
        wishlistId: wishlist.id,
        productId: item.productId,
        createdAt: new Date(item.addedAt),
      }));

    if (createRows.length > 0) {
      await tx.wishlistItem.createMany({
        data: createRows,
      });
    }
  });

  return listAccountWishlistItems(userId);
}

export async function replaceAccountCompareItems(
  userId: string,
  input: AccountCompareSyncInput,
): Promise<CompareItem[]> {
  const dedupedItems = dedupeByProductIdWithRecent(
    input.items.map((item) => ({
      productId: item.productId,
      addedAt: item.addedAt ?? new Date().toISOString(),
    })),
  ).slice(0, maxCompareItems);

  const productIds = Array.from(
    new Set(dedupedItems.map((item) => item.productId).filter((productId) => isUuid(productId))),
  );

  const validProducts = productIds.length
    ? await db.product.findMany({
        where: {
          id: { in: productIds },
          status: { not: ProductStatus.ARCHIVED },
        },
        select: { id: true },
      })
    : [];
  const validProductIds = new Set(validProducts.map((product) => product.id));

  await db.$transaction(async (tx) => {
    const compareList = await tx.compareList.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });

    await tx.compareItem.deleteMany({
      where: { compareListId: compareList.id },
    });

    const createRows = dedupedItems
      .filter((item) => validProductIds.has(item.productId))
      .map((item) => ({
        compareListId: compareList.id,
        productId: item.productId,
        createdAt: new Date(item.addedAt),
      }));

    if (createRows.length > 0) {
      await tx.compareItem.createMany({
        data: createRows,
      });
    }
  });

  return listAccountCompareItems(userId);
}
