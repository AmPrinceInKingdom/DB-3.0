import { ProductStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));
const optionalUuid = z.string().uuid().optional().or(z.literal(""));
const optionalUrl = z.string().trim().url().optional().or(z.literal(""));

function normalizeOptionalText(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeOptionalUuid(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const createSchemaBase = z.object({
  name: z.string().trim().min(2).max(220),
  shortDescription: z.string().trim().max(500).optional().or(z.literal("")),
  description: optionalText,
  sku: z.string().trim().min(3).max(120),
  categoryId: z.string().uuid(),
  subcategoryId: optionalUuid,
  brandId: optionalUuid,
  currentPrice: z.coerce.number().positive(),
  oldPrice: z.coerce.number().min(0).optional().nullable(),
  stockQuantity: z.coerce.number().int().min(0),
  minStockLevel: z.coerce.number().int().min(1).max(1000).default(5),
  weightKg: z.coerce.number().min(0).optional().nullable(),
  status: z.enum([ProductStatus.DRAFT, ProductStatus.ACTIVE, ProductStatus.INACTIVE]).default(ProductStatus.DRAFT),
  mainImageUrl: optionalUrl,
});

export const createSellerProductSchema = createSchemaBase.transform((value) => ({
  name: value.name,
  shortDescription: normalizeOptionalText(value.shortDescription),
  description: normalizeOptionalText(value.description),
  sku: value.sku.toUpperCase(),
  categoryId: value.categoryId,
  subcategoryId: normalizeOptionalUuid(value.subcategoryId),
  brandId: normalizeOptionalUuid(value.brandId),
  currentPrice: value.currentPrice,
  oldPrice: value.oldPrice ?? null,
  stockQuantity: value.stockQuantity,
  minStockLevel: value.minStockLevel,
  weightKg: value.weightKg ?? null,
  status: value.status,
  mainImageUrl: normalizeOptionalText(value.mainImageUrl),
}));

export const updateSellerProductSchema = z.object({
  name: z.string().trim().min(2).max(220).optional(),
  shortDescription: z.string().trim().max(500).optional().or(z.literal("")),
  description: optionalText,
  sku: z.string().trim().min(3).max(120).optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: optionalUuid,
  brandId: optionalUuid,
  currentPrice: z.coerce.number().positive().optional(),
  oldPrice: z.coerce.number().min(0).optional().nullable(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  minStockLevel: z.coerce.number().int().min(1).max(1000).optional(),
  weightKg: z.coerce.number().min(0).optional().nullable(),
  status: z.enum([ProductStatus.DRAFT, ProductStatus.ACTIVE, ProductStatus.INACTIVE]).optional(),
  mainImageUrl: optionalUrl,
});

export function normalizeSellerProductUpdate(
  payload: z.infer<typeof updateSellerProductSchema>,
) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.shortDescription !== undefined
      ? { shortDescription: normalizeOptionalText(payload.shortDescription) }
      : {}),
    ...(payload.description !== undefined ? { description: normalizeOptionalText(payload.description) } : {}),
    ...(payload.sku !== undefined ? { sku: payload.sku.toUpperCase() } : {}),
    ...(payload.categoryId !== undefined ? { categoryId: payload.categoryId } : {}),
    ...(payload.subcategoryId !== undefined
      ? { subcategoryId: normalizeOptionalUuid(payload.subcategoryId) }
      : {}),
    ...(payload.brandId !== undefined ? { brandId: normalizeOptionalUuid(payload.brandId) } : {}),
    ...(payload.currentPrice !== undefined ? { currentPrice: payload.currentPrice } : {}),
    ...(payload.oldPrice !== undefined ? { oldPrice: payload.oldPrice ?? null } : {}),
    ...(payload.stockQuantity !== undefined ? { stockQuantity: payload.stockQuantity } : {}),
    ...(payload.minStockLevel !== undefined ? { minStockLevel: payload.minStockLevel } : {}),
    ...(payload.weightKg !== undefined ? { weightKg: payload.weightKg ?? null } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.mainImageUrl !== undefined
      ? { mainImageUrl: normalizeOptionalText(payload.mainImageUrl) }
      : {}),
  };
}

export type CreateSellerProductInput = z.infer<typeof createSellerProductSchema>;
export type UpdateSellerProductInput = ReturnType<typeof normalizeSellerProductUpdate>;
