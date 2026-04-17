import { AccountStatus, Prisma, ProductStatus, StockStatus } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import { toSlug } from "@/lib/utils";
import type {
  CreateAdminBrandInput,
  CreateAdminCategoryInput,
  CreateAdminProductInput,
  CreateAdminSubcategoryInput,
  UpdateAdminBrandInput,
  UpdateAdminCategoryInput,
  UpdateAdminProductInput,
  UpdateAdminSubcategoryInput,
} from "@/lib/validators/admin-catalog";
import type {
  AdminBrandsWorkspace,
  AdminCategoriesWorkspace,
  AdminCatalogProductItem,
  AdminProductsWorkspace,
} from "@/types/admin-catalog";

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeImageUrlList(values: string[] | undefined) {
  if (!values) return [] as string[];
  const unique = new Set<string>();
  for (const raw of values) {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique);
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

function isKnownPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function resolveStockStatus(quantity: number, minStockLevel: number): StockStatus {
  if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
  if (quantity <= minStockLevel) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

function buildProductImageRows(mainImageUrl: string | null, galleryImageUrls: string[]) {
  let normalizedMainImageUrl = normalizeOptionalText(mainImageUrl);
  let normalizedGallery = normalizeImageUrlList(galleryImageUrls);

  if (normalizedMainImageUrl) {
    normalizedGallery = normalizedGallery.filter((imageUrl) => imageUrl !== normalizedMainImageUrl);
  } else if (normalizedGallery.length > 0) {
    normalizedMainImageUrl = normalizedGallery[0] ?? null;
    normalizedGallery = normalizedGallery.slice(1);
  }

  const rows: Array<{ imageUrl: string; isMain: boolean; sortOrder: number }> = [];

  if (normalizedMainImageUrl) {
    rows.push({
      imageUrl: normalizedMainImageUrl,
      isMain: true,
      sortOrder: 0,
    });
  }

  for (const [index, imageUrl] of normalizedGallery.entries()) {
    rows.push({
      imageUrl,
      isMain: false,
      sortOrder: index + 1,
    });
  }

  return {
    mainImageUrl: normalizedMainImageUrl,
    galleryImageUrls: normalizedGallery,
    rows,
  };
}

type AdminVariantInput = {
  id?: string;
  sku: string;
  name: string | null;
  options: Record<string, string>;
  price: number;
  oldPrice: number | null;
  stockQuantity: number;
  imageUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
};

function normalizeVariantOptions(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") {
      continue;
    }
    const key = rawKey.trim();
    const mappedValue = String(rawValue).trim();
    if (!key || !mappedValue) continue;
    normalized[key] = mappedValue;
  }
  return normalized;
}

function normalizeVariantInputList(variants: AdminVariantInput[] | undefined) {
  if (!variants || variants.length === 0) {
    return [] as Array<AdminVariantInput & { id?: string; isDefault: boolean }>;
  }

  const seenSku = new Set<string>();
  const normalized = variants.map((variant, index) => {
    const normalizedSku = variant.sku.trim().toUpperCase();
    if (!normalizedSku) {
      throw new AppError(`Variant ${index + 1} SKU is required`, 400, "INVALID_VARIANT_SKU");
    }
    if (seenSku.has(normalizedSku)) {
      throw new AppError(`Duplicate variant SKU detected: ${normalizedSku}`, 409, "VARIANT_SKU_EXISTS");
    }
    seenSku.add(normalizedSku);

    const options: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(variant.options ?? {})) {
      const key = rawKey.trim();
      const value = rawValue.trim();
      if (!key || !value) continue;
      options[key] = value;
    }

    return {
      ...(variant.id ? { id: variant.id } : {}),
      sku: normalizedSku,
      name: normalizeOptionalText(variant.name),
      options,
      price: variant.price,
      oldPrice: variant.oldPrice ?? null,
      stockQuantity: Math.max(0, variant.stockQuantity),
      imageUrl: normalizeOptionalText(variant.imageUrl),
      isDefault: Boolean(variant.isDefault),
      isActive: Boolean(variant.isActive),
    };
  });

  let defaultIndex = normalized.findIndex((variant) => variant.isDefault && variant.isActive);
  if (defaultIndex === -1) {
    defaultIndex = normalized.findIndex((variant) => variant.isActive);
  }
  if (defaultIndex === -1) {
    defaultIndex = 0;
  }

  return normalized.map((variant, index) => ({
    ...variant,
    isDefault: index === defaultIndex,
  }));
}

async function syncProductVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: AdminVariantInput[],
) {
  const normalizedVariants = normalizeVariantInputList(variants);
  const existing = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((variant) => variant.id));

  await tx.productVariant.updateMany({
    where: { productId },
    data: { isDefault: false },
  });

  const processedIds = new Set<string>();
  let defaultVariantId: string | null = null;

  for (const variant of normalizedVariants) {
    let variantId: string;
    if (variant.id) {
      if (!existingIds.has(variant.id)) {
        throw new AppError("One or more variants are invalid for this product", 400, "INVALID_VARIANT");
      }

      const updated = await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          sku: variant.sku,
          name: variant.name,
          options: variant.options as Prisma.InputJsonValue,
          price: variant.price,
          oldPrice: variant.oldPrice,
          stockQuantity: variant.stockQuantity,
          imageUrl: variant.imageUrl,
          isActive: variant.isActive,
          isDefault: false,
        },
        select: { id: true },
      });
      variantId = updated.id;
    } else {
      const created = await tx.productVariant.create({
        data: {
          productId,
          sku: variant.sku,
          name: variant.name,
          options: variant.options as Prisma.InputJsonValue,
          price: variant.price,
          oldPrice: variant.oldPrice,
          stockQuantity: variant.stockQuantity,
          imageUrl: variant.imageUrl,
          isActive: variant.isActive,
          isDefault: false,
        },
        select: { id: true },
      });
      variantId = created.id;
    }

    processedIds.add(variantId);
    if (variant.isDefault) {
      defaultVariantId = variantId;
    }
  }

  const staleVariantIds = existing
    .map((variant) => variant.id)
    .filter((variantId) => !processedIds.has(variantId));
  if (staleVariantIds.length > 0) {
    await tx.productVariant.deleteMany({
      where: {
        productId,
        id: { in: staleVariantIds },
      },
    });
  }

  if (defaultVariantId) {
    await tx.productVariant.update({
      where: { id: defaultVariantId },
      data: { isDefault: true },
    });
  }

  return {
    hasVariants: normalizedVariants.length > 0,
    totalStockQuantity: normalizedVariants.reduce(
      (sum, variant) => sum + variant.stockQuantity,
      0,
    ),
  };
}

async function ensureUniqueProductSlug(
  tx: Prisma.TransactionClient,
  productName: string,
  ignoreProductId?: string,
) {
  const slugBase = toSlug(productName).slice(0, 210) || `product-${Date.now().toString(36)}`;
  let candidate = slugBase;
  let attempt = 2;

  while (attempt < 500) {
    const existing = await tx.product.findFirst({
      where: {
        slug: candidate,
        ...(ignoreProductId ? { NOT: { id: ignoreProductId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;
    candidate = `${slugBase}-${attempt}`;
    attempt += 1;
  }

  return `${slugBase}-${Date.now().toString(36)}`;
}

async function ensureUniqueCategorySlug(
  tx: Prisma.TransactionClient,
  categoryName: string,
  ignoreCategoryId?: string,
) {
  const slugBase = toSlug(categoryName).slice(0, 150) || `category-${Date.now().toString(36)}`;
  let candidate = slugBase;
  let attempt = 2;

  while (attempt < 300) {
    const existing = await tx.category.findFirst({
      where: {
        slug: candidate,
        ...(ignoreCategoryId ? { NOT: { id: ignoreCategoryId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${slugBase}-${attempt}`;
    attempt += 1;
  }

  return `${slugBase}-${Date.now().toString(36)}`;
}

async function ensureUniqueSubcategorySlug(
  tx: Prisma.TransactionClient,
  subcategoryName: string,
  ignoreSubcategoryId?: string,
) {
  const slugBase =
    toSlug(subcategoryName).slice(0, 150) || `subcategory-${Date.now().toString(36)}`;
  let candidate = slugBase;
  let attempt = 2;

  while (attempt < 300) {
    const existing = await tx.subcategory.findFirst({
      where: {
        slug: candidate,
        ...(ignoreSubcategoryId ? { NOT: { id: ignoreSubcategoryId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${slugBase}-${attempt}`;
    attempt += 1;
  }

  return `${slugBase}-${Date.now().toString(36)}`;
}

async function ensureUniqueBrandSlug(
  tx: Prisma.TransactionClient,
  brandName: string,
  ignoreBrandId?: string,
) {
  const slugBase = toSlug(brandName).slice(0, 170) || `brand-${Date.now().toString(36)}`;
  let candidate = slugBase;
  let attempt = 2;

  while (attempt < 300) {
    const existing = await tx.brand.findFirst({
      where: {
        slug: candidate,
        ...(ignoreBrandId ? { NOT: { id: ignoreBrandId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${slugBase}-${attempt}`;
    attempt += 1;
  }

  return `${slugBase}-${Date.now().toString(36)}`;
}

async function validateProductReferences(
  tx: Prisma.TransactionClient,
  input: {
    categoryId?: string;
    subcategoryId?: string | null;
    brandId?: string | null;
    sellerId?: string | null;
  },
) {
  if (input.categoryId) {
    const category = await tx.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      throw new AppError("Selected category is invalid or inactive", 400, "INVALID_CATEGORY");
    }
  }

  if (input.subcategoryId) {
    const subcategory = await tx.subcategory.findUnique({
      where: { id: input.subcategoryId },
      select: { id: true, categoryId: true, isActive: true },
    });
    if (!subcategory || !subcategory.isActive) {
      throw new AppError("Selected subcategory is invalid or inactive", 400, "INVALID_SUBCATEGORY");
    }
    if (input.categoryId && subcategory.categoryId !== input.categoryId) {
      throw new AppError(
        "Selected subcategory does not belong to selected category",
        400,
        "SUBCATEGORY_MISMATCH",
      );
    }
  }

  if (input.brandId) {
    const brand = await tx.brand.findUnique({
      where: { id: input.brandId },
      select: { id: true, isActive: true },
    });
    if (!brand || !brand.isActive) {
      throw new AppError("Selected brand is invalid or inactive", 400, "INVALID_BRAND");
    }
  }

  if (input.sellerId) {
    const seller = await tx.seller.findUnique({
      where: { userId: input.sellerId },
      select: { userId: true, status: true },
    });
    if (!seller || seller.status !== AccountStatus.ACTIVE) {
      throw new AppError("Selected seller is invalid or inactive", 400, "INVALID_SELLER");
    }
  }
}

function mapAdminProductItem(item: {
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
  sellerId: string | null;
  shortDescription: string | null;
  description: string | null;
  updatedAt: Date;
  category: { name: string };
  subcategory: { name: string } | null;
  brand: { name: string } | null;
  seller: { storeName: string } | null;
  images: Array<{ imageUrl: string; isMain: boolean; sortOrder: number }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string | null;
    options: Prisma.JsonValue;
    price: Prisma.Decimal;
    oldPrice: Prisma.Decimal | null;
    stockQuantity: number;
    imageUrl: string | null;
    isDefault: boolean;
    isActive: boolean;
  }>;
}): AdminCatalogProductItem {
  const orderedImages = [...item.images].sort((left, right) => {
    if (left.isMain === right.isMain) {
      return left.sortOrder - right.sortOrder;
    }
    return left.isMain ? -1 : 1;
  });
  const mainImageUrl =
    orderedImages.find((image) => image.isMain)?.imageUrl ?? orderedImages[0]?.imageUrl ?? null;
  const galleryImageUrls = orderedImages
    .filter((image) => image.imageUrl !== mainImageUrl)
    .map((image) => image.imageUrl);
  const variants = item.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    options: normalizeVariantOptions(variant.options),
    price: toNumber(variant.price),
    oldPrice: variant.oldPrice === null ? null : toNumber(variant.oldPrice),
    stockQuantity: variant.stockQuantity,
    imageUrl: variant.imageUrl,
    isDefault: variant.isDefault,
    isActive: variant.isActive,
  }));

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
    sellerId: item.sellerId,
    sellerName: item.seller?.storeName ?? null,
    shortDescription: item.shortDescription,
    description: item.description,
    mainImageUrl,
    galleryImageUrls,
    variants,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function getAdminProductsWorkspace(filters: {
  query?: string;
  status?: ProductStatus;
} = {}): Promise<AdminProductsWorkspace> {
  const queryText = normalizeOptionalText(filters.query);

  const [items, categories, subcategories, brands, sellers] = await Promise.all([
    db.product.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(queryText
          ? {
              OR: [
                { name: { contains: queryText, mode: "insensitive" } },
                { sku: { contains: queryText, mode: "insensitive" } },
                { slug: { contains: queryText, mode: "insensitive" } },
                { category: { name: { contains: queryText, mode: "insensitive" } } },
                { subcategory: { name: { contains: queryText, mode: "insensitive" } } },
                { brand: { name: { contains: queryText, mode: "insensitive" } } },
                { seller: { storeName: { contains: queryText, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 350,
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
        sellerId: true,
        shortDescription: true,
        description: true,
        updatedAt: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        brand: { select: { name: true } },
        seller: { select: { storeName: true } },
        images: {
          select: {
            imageUrl: true,
            isMain: true,
            sortOrder: true,
          },
          orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
          take: 12,
        },
        variants: {
          select: {
            id: true,
            sku: true,
            name: true,
            options: true,
            price: true,
            oldPrice: true,
            stockQuantity: true,
            imageUrl: true,
            isDefault: true,
            isActive: true,
          },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          take: 50,
        },
      },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 200,
    }),
    db.subcategory.findMany({
      where: { isActive: true },
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, categoryId: true },
      take: 500,
    }),
    db.brand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 300,
    }),
    db.seller.findMany({
      where: { status: AccountStatus.ACTIVE },
      orderBy: { storeName: "asc" },
      select: { userId: true, storeName: true, status: true },
      take: 300,
    }),
  ]);

  return {
    items: items.map(mapAdminProductItem),
    options: {
      categories,
      subcategories,
      brands,
      sellers: sellers.map((seller) => ({
        id: seller.userId,
        name: seller.storeName,
        status: seller.status,
      })),
    },
  };
}

export async function createAdminProduct(input: CreateAdminProductInput) {
  try {
    return await db.$transaction(async (tx) => {
      await validateProductReferences(tx, {
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        brandId: input.brandId,
        sellerId: input.sellerId,
      });

      const slug = await ensureUniqueProductSlug(tx, input.name);
      const hasVariantInput = Array.isArray(input.variants) && input.variants.length > 0;
      const initialStockQuantity = hasVariantInput
        ? input.variants.reduce((sum, variant) => sum + Math.max(0, variant.stockQuantity), 0)
        : input.stockQuantity;
      const stockStatus = resolveStockStatus(initialStockQuantity, input.minStockLevel);
      const imagePayload = buildProductImageRows(input.mainImageUrl, input.galleryImageUrls ?? []);

      const created = await tx.product.create({
        data: {
          sellerId: input.sellerId,
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
          stockQuantity: initialStockQuantity,
          minStockLevel: input.minStockLevel,
          stockStatus,
          hasVariants: hasVariantInput,
          weightKg: input.weightKg,
        },
        select: { id: true },
      });

      if (imagePayload.rows.length > 0) {
        await tx.productImage.createMany({
          data: imagePayload.rows.map((image) => ({
            productId: created.id,
            imageUrl: image.imageUrl,
            isMain: image.isMain,
            sortOrder: image.sortOrder,
          })),
        });
      }

      if (hasVariantInput) {
        const synced = await syncProductVariants(tx, created.id, input.variants);
        const syncedStockStatus = resolveStockStatus(synced.totalStockQuantity, input.minStockLevel);

        await tx.product.update({
          where: { id: created.id },
          data: {
            hasVariants: synced.hasVariants,
            stockQuantity: synced.totalStockQuantity,
            stockStatus: syncedStockStatus,
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
          sellerId: true,
          shortDescription: true,
          description: true,
          updatedAt: true,
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          brand: { select: { name: true } },
          seller: { select: { storeName: true } },
          images: {
            select: {
              imageUrl: true,
              isMain: true,
              sortOrder: true,
            },
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            take: 12,
          },
          variants: {
            select: {
              id: true,
              sku: true,
              name: true,
              options: true,
              price: true,
              oldPrice: true,
              stockQuantity: true,
              imageUrl: true,
              isDefault: true,
              isActive: true,
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            take: 50,
          },
        },
      });

      if (!product) {
        throw new AppError("Unable to create product", 500, "ADMIN_PRODUCT_CREATE_FAILED");
      }

      return mapAdminProductItem(product);
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Product or variant SKU already exists", 409, "PRODUCT_SKU_EXISTS");
    }
    if (isKnownPrismaError(error, "P2003")) {
      throw new AppError("Invalid category, brand, seller, or subcategory", 400, "PRODUCT_REFERENCE_INVALID");
    }
    throw error;
  }
}

export async function updateAdminProduct(productId: string, input: UpdateAdminProductInput) {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          categoryId: true,
          subcategoryId: true,
          sellerId: true,
          hasVariants: true,
          minStockLevel: true,
          stockQuantity: true,
          images: {
            select: {
              imageUrl: true,
              isMain: true,
              sortOrder: true,
            },
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            take: 12,
          },
          variants: {
            select: {
              id: true,
            },
            take: 100,
          },
        },
      });

      if (!current) {
        throw new NotFoundError("Product not found");
      }

      const nextCategoryId = input.categoryId ?? current.categoryId;
      const nextSubcategoryId =
        input.subcategoryId !== undefined ? input.subcategoryId : current.subcategoryId;
      const nextSellerId = input.sellerId !== undefined ? input.sellerId : current.sellerId;
      const nextMinStockLevel = input.minStockLevel ?? current.minStockLevel;
      const existingMainImageUrl =
        current.images.find((image) => image.isMain)?.imageUrl ?? current.images[0]?.imageUrl ?? null;
      const existingGalleryImageUrls = current.images
        .filter((image) => image.imageUrl !== existingMainImageUrl)
        .map((image) => image.imageUrl);
      const shouldSyncImages =
        input.mainImageUrl !== undefined || input.galleryImageUrls !== undefined;

      await validateProductReferences(tx, {
        categoryId: nextCategoryId,
        subcategoryId: nextSubcategoryId,
        brandId: input.brandId ?? undefined,
        sellerId: nextSellerId,
      });

      const syncedVariants =
        input.variants !== undefined
          ? await syncProductVariants(tx, current.id, input.variants)
          : null;
      const nextHasVariants = syncedVariants ? syncedVariants.hasVariants : current.hasVariants;
      const nextStockQuantity = syncedVariants
        ? (syncedVariants.hasVariants
            ? syncedVariants.totalStockQuantity
            : (input.stockQuantity ?? current.stockQuantity))
        : (input.stockQuantity ?? current.stockQuantity);
      const stockStatus = resolveStockStatus(nextStockQuantity, nextMinStockLevel);
      const nextSlug =
        input.name !== undefined
          ? await ensureUniqueProductSlug(tx, input.name, current.id)
          : undefined;

      await tx.product.update({
        where: { id: current.id },
        data: {
          ...(input.name !== undefined ? { name: input.name, slug: nextSlug } : {}),
          ...(input.shortDescription !== undefined
            ? { shortDescription: input.shortDescription }
            : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.subcategoryId !== undefined ? { subcategoryId: input.subcategoryId } : {}),
          ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
          ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
          ...(input.currentPrice !== undefined ? { currentPrice: input.currentPrice } : {}),
          ...(input.oldPrice !== undefined ? { oldPrice: input.oldPrice } : {}),
          stockQuantity: nextStockQuantity,
          ...(input.minStockLevel !== undefined ? { minStockLevel: input.minStockLevel } : {}),
          ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          hasVariants: nextHasVariants,
          stockStatus,
        },
      });

      if (shouldSyncImages) {
        const imagePayload = buildProductImageRows(
          input.mainImageUrl !== undefined ? input.mainImageUrl : existingMainImageUrl,
          input.galleryImageUrls !== undefined
            ? input.galleryImageUrls
            : existingGalleryImageUrls,
        );

        await tx.productImage.deleteMany({
          where: {
            productId: current.id,
          },
        });

        if (imagePayload.rows.length > 0) {
          await tx.productImage.createMany({
            data: imagePayload.rows.map((image) => ({
              productId: current.id,
              imageUrl: image.imageUrl,
              isMain: image.isMain,
              sortOrder: image.sortOrder,
            })),
          });
        }
      }

      const updated = await tx.product.findUnique({
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
          sellerId: true,
          shortDescription: true,
          description: true,
          updatedAt: true,
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          brand: { select: { name: true } },
          seller: { select: { storeName: true } },
          images: {
            select: {
              imageUrl: true,
              isMain: true,
              sortOrder: true,
            },
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            take: 12,
          },
          variants: {
            select: {
              id: true,
              sku: true,
              name: true,
              options: true,
              price: true,
              oldPrice: true,
              stockQuantity: true,
              imageUrl: true,
              isDefault: true,
              isActive: true,
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            take: 50,
          },
        },
      });

      if (!updated) {
        throw new NotFoundError("Product not found");
      }

      return mapAdminProductItem(updated);
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Product or variant SKU already exists", 409, "PRODUCT_SKU_EXISTS");
    }
    if (isKnownPrismaError(error, "P2003")) {
      throw new AppError("Invalid category, brand, seller, or subcategory", 400, "PRODUCT_REFERENCE_INVALID");
    }
    throw error;
  }
}

export async function archiveAdminProduct(productId: string) {
  const updated = await db.product.updateMany({
    where: { id: productId },
    data: { status: ProductStatus.ARCHIVED },
  });

  if (updated.count === 0) {
    throw new NotFoundError("Product not found");
  }

  return { id: productId, status: ProductStatus.ARCHIVED };
}

export async function getAdminCategoriesWorkspace(filters: {
  query?: string;
  isActive?: boolean;
} = {}): Promise<AdminCategoriesWorkspace> {
  const queryText = normalizeOptionalText(filters.query);

  const categoryWhere: Prisma.CategoryWhereInput = {
    ...(typeof filters.isActive === "boolean" ? { isActive: filters.isActive } : {}),
    ...(queryText
      ? {
          OR: [
            { name: { contains: queryText, mode: "insensitive" } },
            { slug: { contains: queryText, mode: "insensitive" } },
            { description: { contains: queryText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const subcategoryWhere: Prisma.SubcategoryWhereInput = {
    ...(typeof filters.isActive === "boolean" ? { isActive: filters.isActive } : {}),
    ...(queryText
      ? {
          OR: [
            { name: { contains: queryText, mode: "insensitive" } },
            { slug: { contains: queryText, mode: "insensitive" } },
            { description: { contains: queryText, mode: "insensitive" } },
            { category: { name: { contains: queryText, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [categories, subcategories, categoryOptions] = await Promise.all([
    db.category.findMany({
      where: categoryWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        isActive: true,
        sortOrder: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
            subcategories: true,
          },
        },
      },
      take: 300,
    }),
    db.subcategory.findMany({
      where: subcategoryWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        categoryId: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        isActive: true,
        sortOrder: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      take: 500,
    }),
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
      take: 300,
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      productCount: category._count.products,
      subcategoryCount: category._count.subcategories,
      updatedAt: category.updatedAt.toISOString(),
    })),
    subcategories: subcategories.map((subcategory) => ({
      id: subcategory.id,
      categoryId: subcategory.categoryId,
      categoryName: subcategory.category.name,
      name: subcategory.name,
      slug: subcategory.slug,
      description: subcategory.description,
      imageUrl: subcategory.imageUrl,
      isActive: subcategory.isActive,
      sortOrder: subcategory.sortOrder,
      productCount: subcategory._count.products,
      updatedAt: subcategory.updatedAt.toISOString(),
    })),
    categoryOptions,
  };
}

export async function createAdminCategory(input: CreateAdminCategoryInput) {
  try {
    return await db.$transaction(async (tx) => {
      const slug = await ensureUniqueCategorySlug(tx, input.name);

      return tx.category.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          imageUrl: input.imageUrl,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Category already exists", 409, "CATEGORY_EXISTS");
    }
    throw error;
  }
}

export async function updateAdminCategory(categoryId: string, input: UpdateAdminCategoryInput) {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.category.findUnique({
        where: { id: categoryId },
        select: { id: true, name: true },
      });

      if (!current) {
        throw new NotFoundError("Category not found");
      }

      const nextSlug =
        input.name !== undefined
          ? await ensureUniqueCategorySlug(tx, input.name, current.id)
          : undefined;

      return tx.category.update({
        where: { id: current.id },
        data: {
          ...(input.name !== undefined ? { name: input.name, slug: nextSlug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          updatedAt: true,
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Category already exists", 409, "CATEGORY_EXISTS");
    }
    throw error;
  }
}

export async function deleteAdminCategory(categoryId: string) {
  return db.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        _count: {
          select: {
            products: true,
            subcategories: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    if (category._count.products > 0 || category._count.subcategories > 0) {
      throw new AppError(
        "Category has linked products or subcategories. Remove links first.",
        409,
        "CATEGORY_DELETE_BLOCKED",
      );
    }

    await tx.category.delete({
      where: { id: category.id },
    });

    return { id: category.id };
  });
}

export async function createAdminSubcategory(input: CreateAdminSubcategoryInput) {
  try {
    return await db.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true, isActive: true },
      });

      if (!category || !category.isActive) {
        throw new AppError("Selected category is invalid or inactive", 400, "INVALID_CATEGORY");
      }

      const slug = await ensureUniqueSubcategorySlug(tx, input.name);
      return tx.subcategory.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
          slug,
          description: input.description,
          imageUrl: input.imageUrl,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          categoryId: true,
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Subcategory already exists", 409, "SUBCATEGORY_EXISTS");
    }
    if (isKnownPrismaError(error, "P2003")) {
      throw new AppError("Invalid category selected", 400, "INVALID_CATEGORY");
    }
    throw error;
  }
}

export async function updateAdminSubcategory(
  subcategoryId: string,
  input: UpdateAdminSubcategoryInput,
) {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.subcategory.findUnique({
        where: { id: subcategoryId },
        select: {
          id: true,
          categoryId: true,
        },
      });

      if (!current) {
        throw new NotFoundError("Subcategory not found");
      }

      const nextCategoryId = input.categoryId ?? current.categoryId;
      const category = await tx.category.findUnique({
        where: { id: nextCategoryId },
        select: { id: true, isActive: true },
      });
      if (!category || !category.isActive) {
        throw new AppError("Selected category is invalid or inactive", 400, "INVALID_CATEGORY");
      }

      const nextSlug =
        input.name !== undefined
          ? await ensureUniqueSubcategorySlug(tx, input.name, current.id)
          : undefined;

      return tx.subcategory.update({
        where: { id: current.id },
        data: {
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.name !== undefined ? { name: input.name, slug: nextSlug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          categoryId: true,
          isActive: true,
          updatedAt: true,
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Subcategory already exists", 409, "SUBCATEGORY_EXISTS");
    }
    if (isKnownPrismaError(error, "P2003")) {
      throw new AppError("Invalid category selected", 400, "INVALID_CATEGORY");
    }
    throw error;
  }
}

export async function deleteAdminSubcategory(subcategoryId: string) {
  return db.$transaction(async (tx) => {
    const subcategory = await tx.subcategory.findUnique({
      where: { id: subcategoryId },
      select: {
        id: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!subcategory) {
      throw new NotFoundError("Subcategory not found");
    }

    if (subcategory._count.products > 0) {
      throw new AppError(
        "Subcategory has linked products. Remove links first.",
        409,
        "SUBCATEGORY_DELETE_BLOCKED",
      );
    }

    await tx.subcategory.delete({
      where: { id: subcategory.id },
    });

    return { id: subcategory.id };
  });
}

export async function getAdminBrandsWorkspace(filters: {
  query?: string;
  isActive?: boolean;
} = {}): Promise<AdminBrandsWorkspace> {
  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.BrandWhereInput = {
    ...(typeof filters.isActive === "boolean" ? { isActive: filters.isActive } : {}),
    ...(queryText
      ? {
          OR: [
            { name: { contains: queryText, mode: "insensitive" } },
            { slug: { contains: queryText, mode: "insensitive" } },
            { description: { contains: queryText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const brands = await db.brand.findMany({
    where,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      description: true,
      isActive: true,
      updatedAt: true,
      _count: {
        select: { products: true },
      },
    },
    take: 400,
  });

  return {
    brands: brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      description: brand.description,
      isActive: brand.isActive,
      productCount: brand._count.products,
      updatedAt: brand.updatedAt.toISOString(),
    })),
  };
}

export async function createAdminBrand(input: CreateAdminBrandInput) {
  try {
    return await db.$transaction(async (tx) => {
      const slug = await ensureUniqueBrandSlug(tx, input.name);

      return tx.brand.create({
        data: {
          name: input.name,
          slug,
          logoUrl: input.logoUrl,
          description: input.description,
          isActive: input.isActive,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Brand already exists", 409, "BRAND_EXISTS");
    }
    throw error;
  }
}

export async function updateAdminBrand(brandId: string, input: UpdateAdminBrandInput) {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.brand.findUnique({
        where: { id: brandId },
        select: { id: true },
      });

      if (!current) {
        throw new NotFoundError("Brand not found");
      }

      const nextSlug =
        input.name !== undefined ? await ensureUniqueBrandSlug(tx, input.name, current.id) : undefined;

      return tx.brand.update({
        where: { id: current.id },
        data: {
          ...(input.name !== undefined ? { name: input.name, slug: nextSlug } : {}),
          ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          updatedAt: true,
        },
      });
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Brand already exists", 409, "BRAND_EXISTS");
    }
    throw error;
  }
}

export async function deleteAdminBrand(brandId: string) {
  return db.$transaction(async (tx) => {
    const brand = await tx.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundError("Brand not found");
    }

    if (brand._count.products > 0) {
      throw new AppError(
        "Brand has linked products. Remove links first.",
        409,
        "BRAND_DELETE_BLOCKED",
      );
    }

    await tx.brand.delete({
      where: { id: brand.id },
    });

    return { id: brand.id };
  });
}
