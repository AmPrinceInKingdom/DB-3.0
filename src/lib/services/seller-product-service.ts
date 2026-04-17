import { Prisma, ProductStatus, StockStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import { toSlug } from "@/lib/utils";
import type { CreateSellerProductInput, UpdateSellerProductInput } from "@/lib/validators/seller-product";
import type { SellerProductItem, SellerProductsWorkspace } from "@/types/seller-product";

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNumber(value: Prisma.Decimal | number | string | null, fallback = 0) {
  if (value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number(value.toString());
}

function resolveStockStatus(quantity: number, minStockLevel: number): StockStatus {
  if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
  if (quantity <= minStockLevel) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

async function requireActiveSellerProfile(userId: string) {
  const seller = await db.seller.findUnique({
    where: { userId },
    select: {
      userId: true,
      status: true,
    },
  });

  if (!seller || seller.status !== "ACTIVE") {
    throw new AppError("Active seller profile required", 403, "SELLER_PROFILE_INACTIVE");
  }

  return seller;
}

async function ensureUniqueProductSlug(
  tx: Prisma.TransactionClient,
  productName: string,
  sellerId: string,
  ignoreProductId?: string,
) {
  const slugBase = toSlug(productName).slice(0, 210) || `product-${Date.now().toString(36)}`;
  let candidate = slugBase;
  let attempt = 2;

  while (attempt < 500) {
    const existing = await tx.product.findFirst({
      where: {
        slug: candidate,
        sellerId,
        ...(ignoreProductId ? { NOT: { id: ignoreProductId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${slugBase}-${attempt}`;
    attempt += 1;
  }

  return `${slugBase}-${Date.now().toString(36)}`;
}

async function validateReferences(
  tx: Prisma.TransactionClient,
  input: {
    categoryId?: string;
    subcategoryId?: string | null;
    brandId?: string | null;
  },
) {
  if (input.categoryId) {
    const category = await tx.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      throw new AppError("Selected category is invalid or inactive.", 400, "INVALID_CATEGORY");
    }
  }

  if (input.subcategoryId) {
    const subcategory = await tx.subcategory.findUnique({
      where: { id: input.subcategoryId },
      select: { id: true, categoryId: true, isActive: true },
    });
    if (!subcategory || !subcategory.isActive) {
      throw new AppError("Selected subcategory is invalid or inactive.", 400, "INVALID_SUBCATEGORY");
    }
    if (input.categoryId && subcategory.categoryId !== input.categoryId) {
      throw new AppError("Selected subcategory does not belong to selected category.", 400, "SUBCATEGORY_MISMATCH");
    }
  }

  if (input.brandId) {
    const brand = await tx.brand.findUnique({
      where: { id: input.brandId },
      select: { id: true, isActive: true },
    });
    if (!brand || !brand.isActive) {
      throw new AppError("Selected brand is invalid or inactive.", 400, "INVALID_BRAND");
    }
  }
}

function mapSellerProductItem(
  item: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    status: ProductStatus;
    stockStatus: StockStatus;
    stockQuantity: number;
    minStockLevel: number;
    currentPrice: Prisma.Decimal;
    oldPrice: Prisma.Decimal | null;
    categoryId: string;
    subcategoryId: string | null;
    brandId: string | null;
    shortDescription: string | null;
    description: string | null;
    updatedAt: Date;
    category: {
      name: string;
    };
    subcategory: {
      name: string;
    } | null;
    brand: {
      name: string;
    } | null;
    images: Array<{
      imageUrl: string;
    }>;
  },
): SellerProductItem {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    sku: item.sku,
    status: item.status,
    stockStatus: item.stockStatus,
    stockQuantity: item.stockQuantity,
    minStockLevel: item.minStockLevel,
    currentPrice: toNumber(item.currentPrice),
    oldPrice: item.oldPrice === null ? null : toNumber(item.oldPrice),
    categoryId: item.categoryId,
    categoryName: item.category.name,
    subcategoryId: item.subcategoryId,
    subcategoryName: item.subcategory?.name ?? null,
    brandId: item.brandId,
    brandName: item.brand?.name ?? null,
    shortDescription: item.shortDescription,
    description: item.description,
    mainImageUrl: item.images[0]?.imageUrl ?? null,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function getSellerProductsWorkspace(
  sellerUserId: string,
  filters: {
    query?: string;
    status?: ProductStatus;
  } = {},
): Promise<SellerProductsWorkspace> {
  await requireActiveSellerProfile(sellerUserId);

  const queryText = normalizeOptionalText(filters.query);

  const [items, categories, subcategories, brands] = await Promise.all([
    db.product.findMany({
      where: {
        sellerId: sellerUserId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(queryText
          ? {
              OR: [
                { name: { contains: queryText, mode: "insensitive" } },
                { sku: { contains: queryText, mode: "insensitive" } },
                { slug: { contains: queryText, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        stockStatus: true,
        stockQuantity: true,
        minStockLevel: true,
        currentPrice: true,
        oldPrice: true,
        categoryId: true,
        subcategoryId: true,
        brandId: true,
        shortDescription: true,
        description: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
        subcategory: {
          select: {
            name: true,
          },
        },
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
      take: 300,
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
      take: 200,
    }),
    db.subcategory.findMany({
      where: { isActive: true },
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        categoryId: true,
      },
      take: 500,
    }),
    db.brand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
      take: 300,
    }),
  ]);

  return {
    items: items.map(mapSellerProductItem),
    options: {
      categories,
      subcategories,
      brands,
    },
  };
}

export async function createSellerProduct(sellerUserId: string, input: CreateSellerProductInput) {
  await requireActiveSellerProfile(sellerUserId);

  return db.$transaction(async (tx) => {
    await validateReferences(tx, {
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      brandId: input.brandId,
    });

    const slug = await ensureUniqueProductSlug(tx, input.name, sellerUserId);
    const stockStatus = resolveStockStatus(input.stockQuantity, input.minStockLevel);

    const created = await tx.product.create({
      data: {
        sellerId: sellerUserId,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        brandId: input.brandId,
        name: input.name,
        slug,
        shortDescription: input.shortDescription,
        description: input.description,
        sku: input.sku,
        status: input.status,
        currentPrice: input.currentPrice,
        oldPrice: input.oldPrice,
        stockQuantity: input.stockQuantity,
        minStockLevel: input.minStockLevel,
        stockStatus,
        weightKg: input.weightKg,
      },
      select: {
        id: true,
      },
    });

    if (input.mainImageUrl) {
      await tx.productImage.create({
        data: {
          productId: created.id,
          imageUrl: input.mainImageUrl,
          isMain: true,
          sortOrder: 0,
        },
      });
    }

    const product = await tx.product.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        stockStatus: true,
        stockQuantity: true,
        minStockLevel: true,
        currentPrice: true,
        oldPrice: true,
        categoryId: true,
        subcategoryId: true,
        brandId: true,
        shortDescription: true,
        description: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
        subcategory: {
          select: {
            name: true,
          },
        },
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
    });

    if (!product) {
      throw new AppError("Unable to create product", 500, "SELLER_PRODUCT_CREATE_FAILED");
    }

    return mapSellerProductItem(product);
  });
}

export async function updateSellerProduct(
  sellerUserId: string,
  productId: string,
  input: UpdateSellerProductInput,
) {
  await requireActiveSellerProfile(sellerUserId);

  return db.$transaction(async (tx) => {
    const current = await tx.product.findFirst({
      where: {
        id: productId,
        sellerId: sellerUserId,
      },
      select: {
        id: true,
        categoryId: true,
        minStockLevel: true,
        stockQuantity: true,
      },
    });

    if (!current) {
      throw new NotFoundError("Seller product not found");
    }

    const nextCategoryId = input.categoryId ?? current.categoryId;
    const nextMinStockLevel = input.minStockLevel ?? current.minStockLevel;
    const nextStockQuantity = input.stockQuantity ?? current.stockQuantity;

    await validateReferences(tx, {
      categoryId: nextCategoryId,
      subcategoryId: input.subcategoryId ?? undefined,
      brandId: input.brandId ?? undefined,
    });

    const stockStatus = resolveStockStatus(nextStockQuantity, nextMinStockLevel);

    const nextSlug = input.name
      ? await ensureUniqueProductSlug(tx, input.name, sellerUserId, current.id)
      : undefined;

    await tx.product.update({
      where: { id: current.id },
      data: {
        ...(input.name !== undefined ? { name: input.name, slug: nextSlug } : {}),
        ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.subcategoryId !== undefined ? { subcategoryId: input.subcategoryId } : {}),
        ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
        ...(input.currentPrice !== undefined ? { currentPrice: input.currentPrice } : {}),
        ...(input.oldPrice !== undefined ? { oldPrice: input.oldPrice } : {}),
        ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
        ...(input.minStockLevel !== undefined ? { minStockLevel: input.minStockLevel } : {}),
        ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        stockStatus,
      },
    });

    if (input.mainImageUrl !== undefined) {
      await tx.productImage.deleteMany({
        where: {
          productId: current.id,
          isMain: true,
        },
      });

      if (input.mainImageUrl) {
        await tx.productImage.create({
          data: {
            productId: current.id,
            imageUrl: input.mainImageUrl,
            isMain: true,
            sortOrder: 0,
          },
        });
      }
    }

    const product = await tx.product.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        stockStatus: true,
        stockQuantity: true,
        minStockLevel: true,
        currentPrice: true,
        oldPrice: true,
        categoryId: true,
        subcategoryId: true,
        brandId: true,
        shortDescription: true,
        description: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
        subcategory: {
          select: {
            name: true,
          },
        },
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
    });

    if (!product) {
      throw new NotFoundError("Seller product not found");
    }

    return mapSellerProductItem(product);
  });
}

export async function archiveSellerProduct(sellerUserId: string, productId: string) {
  await requireActiveSellerProfile(sellerUserId);

  const updated = await db.product.updateMany({
    where: {
      id: productId,
      sellerId: sellerUserId,
    },
    data: {
      status: ProductStatus.ARCHIVED,
    },
  });

  if (updated.count === 0) {
    throw new NotFoundError("Seller product not found");
  }

  return {
    id: productId,
    status: ProductStatus.ARCHIVED,
  };
}
