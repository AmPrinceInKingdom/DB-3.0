import { ProductStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { SavedCartItem } from "@/types/cart";
import type { AccountSavedCartSyncInput } from "@/lib/validators/account-saved-cart";

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

function toSavedCartItem(row: {
  lineId: string;
  quantity: number;
  savedAt: Date;
  product: {
    id: string;
    slug: string;
    name: string;
    status: ProductStatus;
    stockQuantity: number;
    currentPrice: unknown;
    oldPrice: unknown;
    brand: { name: string } | null;
    images: Array<{ imageUrl: string }>;
  };
  variant: {
    id: string;
    name: string | null;
    price: unknown;
    oldPrice: unknown;
    stockQuantity: number;
    isActive: boolean;
    imageUrl: string | null;
  } | null;
}): SavedCartItem {
  const hasActiveVariant = Boolean(row.variant?.isActive);
  const unitPriceBase = hasActiveVariant
    ? toNumber(row.variant?.price)
    : toNumber(row.product.currentPrice);
  const oldPriceBase = hasActiveVariant
    ? toNumber(row.variant?.oldPrice)
    : toNumber(row.product.oldPrice);

  return {
    lineId: row.lineId,
    productId: row.product.id,
    slug: row.product.slug,
    name: row.product.name,
    brand: row.product.brand?.name ?? "Deal Bazaar",
    imageUrl: row.variant?.imageUrl ?? row.product.images[0]?.imageUrl ?? "/next.svg",
    quantity: Math.max(1, Math.min(20, row.quantity)),
    unitPriceBase,
    oldPriceBase: oldPriceBase > 0 ? oldPriceBase : undefined,
    variantId: row.variant?.id ?? null,
    variantLabel: row.variant?.name ?? null,
    inStock: hasActiveVariant ? row.variant!.stockQuantity > 0 : row.product.stockQuantity > 0,
    savedAt: row.savedAt.toISOString(),
  };
}

function mergeByLineId(items: SavedCartItem[]): SavedCartItem[] {
  const byLineId = new Map<string, SavedCartItem>();

  for (const item of items) {
    const existing = byLineId.get(item.lineId);
    if (!existing) {
      byLineId.set(item.lineId, item);
      continue;
    }

    const itemTime = new Date(item.savedAt).getTime();
    const existingTime = new Date(existing.savedAt).getTime();
    if (itemTime >= existingTime) {
      byLineId.set(item.lineId, item);
    }
  }

  return Array.from(byLineId.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

export async function listAccountSavedCartItems(userId: string): Promise<SavedCartItem[]> {
  const rows = await db.savedCartItem.findMany({
    where: { userId },
    orderBy: [{ savedAt: "desc" }, { createdAt: "desc" }],
    select: {
      lineId: true,
      quantity: true,
      savedAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          stockQuantity: true,
          currentPrice: true,
          oldPrice: true,
          brand: {
            select: {
              name: true,
            },
          },
          images: {
            where: { isMain: true },
            select: { imageUrl: true },
            take: 1,
          },
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          price: true,
          oldPrice: true,
          stockQuantity: true,
          isActive: true,
          imageUrl: true,
        },
      },
    },
  });

  const items = rows.map(toSavedCartItem);
  return mergeByLineId(items);
}

export async function replaceAccountSavedCartItems(
  userId: string,
  input: AccountSavedCartSyncInput,
): Promise<SavedCartItem[]> {
  const dedupedInput = new Map<
    string,
    {
      lineId: string;
      productId: string;
      variantId: string | null;
      quantity: number;
      savedAt: string | null;
    }
  >();

  for (const item of input.items) {
    if (!item.lineId || !item.productId) continue;
    dedupedInput.set(item.lineId, item);
  }

  const normalizedItems = Array.from(dedupedInput.values());
  const productIds = Array.from(
    new Set(normalizedItems.map((item) => item.productId).filter((productId) => isUuid(productId))),
  );
  const variantIds = Array.from(
    new Set(
      normalizedItems
        .map((item) => item.variantId)
        .filter((variantId): variantId is string => Boolean(variantId && isUuid(variantId))),
    ),
  );

  const [products, variants] = await Promise.all([
    productIds.length
      ? db.product.findMany({
          where: {
            id: { in: productIds },
          },
          select: {
            id: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    variantIds.length
      ? db.productVariant.findMany({
          where: {
            id: { in: variantIds },
          },
          select: {
            id: true,
            productId: true,
            isActive: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const rowsToPersist: Array<{
    userId: string;
    lineId: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    savedAt: Date;
  }> = [];

  for (const item of normalizedItems) {
    if (!isUuid(item.productId)) continue;
    const product = productMap.get(item.productId);
    if (!product || product.status === ProductStatus.ARCHIVED) continue;

    let variantId: string | null = null;
    if (item.variantId && isUuid(item.variantId)) {
      const variant = variantMap.get(item.variantId);
      if (!variant || variant.productId !== product.id || !variant.isActive) {
        continue;
      }
      variantId = variant.id;
    }

    const savedAt =
      item.savedAt && !Number.isNaN(new Date(item.savedAt).getTime())
        ? new Date(item.savedAt)
        : new Date();

    rowsToPersist.push({
      userId,
      lineId: item.lineId,
      productId: product.id,
      variantId,
      quantity: Math.max(1, Math.min(20, item.quantity)),
      savedAt,
    });
  }

  await db.$transaction(async (tx) => {
    await tx.savedCartItem.deleteMany({
      where: { userId },
    });

    if (rowsToPersist.length > 0) {
      await tx.savedCartItem.createMany({
        data: rowsToPersist,
      });
    }
  });

  return listAccountSavedCartItems(userId);
}
