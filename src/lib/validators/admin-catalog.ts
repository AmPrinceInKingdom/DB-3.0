import { ProductStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));
const optionalShortText = z.string().trim().max(500).optional().or(z.literal(""));
const optionalUrl = z.string().trim().url().optional().or(z.literal(""));
const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const variantOptionMapSchema = z.record(
  z.string().trim().min(1).max(60),
  z.string().trim().min(1).max(120),
);

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalUuid(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrlList(values: string[] | undefined) {
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

function normalizeOptionMap(values: Record<string, string> | undefined) {
  if (!values) return {} as Record<string, string>;

  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(values)) {
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (!key || !value) continue;
    normalized[key] = value;
  }
  return normalized;
}

const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(3).max(120),
  name: z.string().trim().max(180).optional().or(z.literal("")),
  options: variantOptionMapSchema.optional().default({}),
  price: z.coerce.number().positive(),
  oldPrice: z.coerce.number().min(0).optional().nullable(),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  imageUrl: optionalUrl,
  isDefault: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export const createAdminProductSchema = z
  .object({
    name: z.string().trim().min(2).max(220),
    shortDescription: optionalShortText,
    description: optionalText,
    sku: z.string().trim().min(3).max(120),
    categoryId: z.string().uuid(),
    subcategoryId: optionalUuid,
    brandId: optionalUuid,
    sellerId: optionalUuid,
    currentPrice: z.coerce.number().positive(),
    oldPrice: z.coerce.number().min(0).optional().nullable(),
    stockQuantity: z.coerce.number().int().min(0),
    minStockLevel: z.coerce.number().int().min(1).max(1000).default(5),
    weightKg: z.coerce.number().min(0).optional().nullable(),
    status: z
      .enum([
        ProductStatus.DRAFT,
        ProductStatus.ACTIVE,
        ProductStatus.INACTIVE,
        ProductStatus.ARCHIVED,
      ])
      .default(ProductStatus.DRAFT),
    mainImageUrl: optionalUrl,
    galleryImageUrls: z.array(z.string().trim().url()).max(12).optional().default([]),
    variants: z.array(productVariantSchema).max(50).optional().default([]),
  })
  .transform((value) => ({
    name: value.name,
    shortDescription: normalizeOptionalText(value.shortDescription),
    description: normalizeOptionalText(value.description),
    sku: value.sku.toUpperCase(),
    categoryId: value.categoryId,
    subcategoryId: normalizeOptionalUuid(value.subcategoryId),
    brandId: normalizeOptionalUuid(value.brandId),
    sellerId: normalizeOptionalUuid(value.sellerId),
    currentPrice: value.currentPrice,
    oldPrice: value.oldPrice ?? null,
    stockQuantity: value.stockQuantity,
    minStockLevel: value.minStockLevel,
    weightKg: value.weightKg ?? null,
    status: value.status,
    mainImageUrl: normalizeOptionalText(value.mainImageUrl),
    galleryImageUrls: normalizeUrlList(value.galleryImageUrls),
    variants: value.variants.map((variant) => ({
      sku: variant.sku.toUpperCase(),
      name: normalizeOptionalText(variant.name),
      options: normalizeOptionMap(variant.options),
      price: variant.price,
      oldPrice: variant.oldPrice ?? null,
      stockQuantity: variant.stockQuantity,
      imageUrl: normalizeOptionalText(variant.imageUrl),
      isDefault: variant.isDefault,
      isActive: variant.isActive,
    })),
  }));

export const updateAdminProductSchema = z.object({
  name: z.string().trim().min(2).max(220).optional(),
  shortDescription: optionalShortText,
  description: optionalText,
  sku: z.string().trim().min(3).max(120).optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: optionalUuid,
  brandId: optionalUuid,
  sellerId: optionalUuid,
  currentPrice: z.coerce.number().positive().optional(),
  oldPrice: z.coerce.number().min(0).optional().nullable(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  minStockLevel: z.coerce.number().int().min(1).max(1000).optional(),
  weightKg: z.coerce.number().min(0).optional().nullable(),
  status: z
    .enum([
      ProductStatus.DRAFT,
      ProductStatus.ACTIVE,
      ProductStatus.INACTIVE,
      ProductStatus.ARCHIVED,
    ])
    .optional(),
  mainImageUrl: optionalUrl,
  galleryImageUrls: z.array(z.string().trim().url()).max(12).optional(),
  variants: z.array(productVariantSchema).max(50).optional(),
});

export function normalizeAdminProductUpdate(
  payload: z.infer<typeof updateAdminProductSchema>,
) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.shortDescription !== undefined
      ? { shortDescription: normalizeOptionalText(payload.shortDescription) }
      : {}),
    ...(payload.description !== undefined
      ? { description: normalizeOptionalText(payload.description) }
      : {}),
    ...(payload.sku !== undefined ? { sku: payload.sku.toUpperCase() } : {}),
    ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
    ...(payload.subcategoryId !== undefined
      ? { subcategoryId: normalizeOptionalUuid(payload.subcategoryId) }
      : {}),
    ...(payload.brandId !== undefined ? { brandId: normalizeOptionalUuid(payload.brandId) } : {}),
    ...(payload.sellerId !== undefined ? { sellerId: normalizeOptionalUuid(payload.sellerId) } : {}),
    ...(payload.currentPrice !== undefined ? { currentPrice: payload.currentPrice } : {}),
    ...(payload.oldPrice !== undefined ? { oldPrice: payload.oldPrice ?? null } : {}),
    ...(payload.stockQuantity !== undefined ? { stockQuantity: payload.stockQuantity } : {}),
    ...(payload.minStockLevel !== undefined ? { minStockLevel: payload.minStockLevel } : {}),
    ...(payload.weightKg !== undefined ? { weightKg: payload.weightKg ?? null } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.mainImageUrl !== undefined
      ? { mainImageUrl: normalizeOptionalText(payload.mainImageUrl) }
      : {}),
    ...(payload.galleryImageUrls !== undefined
      ? { galleryImageUrls: normalizeUrlList(payload.galleryImageUrls) }
      : {}),
    ...(payload.variants !== undefined
      ? {
          variants: payload.variants.map((variant) => ({
            ...(variant.id ? { id: variant.id } : {}),
            sku: variant.sku.toUpperCase(),
            name: normalizeOptionalText(variant.name),
            options: normalizeOptionMap(variant.options),
            price: variant.price,
            oldPrice: variant.oldPrice ?? null,
            stockQuantity: variant.stockQuantity,
            imageUrl: normalizeOptionalText(variant.imageUrl),
            isDefault: variant.isDefault,
            isActive: variant.isActive,
          })),
        }
      : {}),
  };
}

export const createAdminCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(140),
    description: optionalText,
    imageUrl: optionalUrl,
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.coerce.boolean().default(true),
  })
  .transform((value) => ({
    name: value.name,
    description: normalizeOptionalText(value.description),
    imageUrl: normalizeOptionalText(value.imageUrl),
    sortOrder: value.sortOrder,
    isActive: value.isActive,
  }));

export const updateAdminCategorySchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  description: optionalText,
  imageUrl: optionalUrl,
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export function normalizeAdminCategoryUpdate(
  payload: z.infer<typeof updateAdminCategorySchema>,
) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined
      ? { description: normalizeOptionalText(payload.description) }
      : {}),
    ...(payload.imageUrl !== undefined ? { imageUrl: normalizeOptionalText(payload.imageUrl) } : {}),
    ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  };
}

export const createAdminSubcategorySchema = z
  .object({
    categoryId: z.string().uuid(),
    name: z.string().trim().min(2).max(140),
    description: optionalText,
    imageUrl: optionalUrl,
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.coerce.boolean().default(true),
  })
  .transform((value) => ({
    categoryId: value.categoryId,
    name: value.name,
    description: normalizeOptionalText(value.description),
    imageUrl: normalizeOptionalText(value.imageUrl),
    sortOrder: value.sortOrder,
    isActive: value.isActive,
  }));

export const updateAdminSubcategorySchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(140).optional(),
  description: optionalText,
  imageUrl: optionalUrl,
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export function normalizeAdminSubcategoryUpdate(
  payload: z.infer<typeof updateAdminSubcategorySchema>,
) {
  return {
    ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined
      ? { description: normalizeOptionalText(payload.description) }
      : {}),
    ...(payload.imageUrl !== undefined ? { imageUrl: normalizeOptionalText(payload.imageUrl) } : {}),
    ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  };
}

export const createAdminBrandSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    logoUrl: optionalUrl,
    description: optionalText,
    isActive: z.coerce.boolean().default(true),
  })
  .transform((value) => ({
    name: value.name,
    logoUrl: normalizeOptionalText(value.logoUrl),
    description: normalizeOptionalText(value.description),
    isActive: value.isActive,
  }));

export const updateAdminBrandSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  logoUrl: optionalUrl,
  description: optionalText,
  isActive: z.coerce.boolean().optional(),
});

export function normalizeAdminBrandUpdate(payload: z.infer<typeof updateAdminBrandSchema>) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.logoUrl !== undefined ? { logoUrl: normalizeOptionalText(payload.logoUrl) } : {}),
    ...(payload.description !== undefined
      ? { description: normalizeOptionalText(payload.description) }
      : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  };
}

export type CreateAdminProductInput = z.infer<typeof createAdminProductSchema>;
export type UpdateAdminProductInput = ReturnType<typeof normalizeAdminProductUpdate>;
export type CreateAdminCategoryInput = z.infer<typeof createAdminCategorySchema>;
export type UpdateAdminCategoryInput = ReturnType<typeof normalizeAdminCategoryUpdate>;
export type CreateAdminSubcategoryInput = z.infer<typeof createAdminSubcategorySchema>;
export type UpdateAdminSubcategoryInput = ReturnType<typeof normalizeAdminSubcategoryUpdate>;
export type CreateAdminBrandInput = z.infer<typeof createAdminBrandSchema>;
export type UpdateAdminBrandInput = ReturnType<typeof normalizeAdminBrandUpdate>;
