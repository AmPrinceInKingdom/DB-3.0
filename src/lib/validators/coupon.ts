import { DiscountScope, DiscountType } from "@prisma/client";
import { z } from "zod";

const textField = z.string().trim();
const optionalText = textField.optional().or(z.literal(""));
const optionalDateString = textField.optional().or(z.literal(""));

const optionalUuid = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}, z.string().uuid().optional());

const optionalNonNegativeNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().min(0).optional());

const optionalPositiveInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().positive().optional());

function normalizeText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const couponCreateBaseSchema = z
  .object({
    code: textField
      .min(3, "Coupon code must be at least 3 characters")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore, and hyphen"),
    title: textField.min(3).max(160),
    description: optionalText,
    discountType: z.nativeEnum(DiscountType),
    discountScope: z.nativeEnum(DiscountScope).default(DiscountScope.ORDER),
    discountValue: z.coerce.number().positive(),
    minPurchaseAmount: z.coerce.number().min(0).default(0),
    maxDiscountAmount: optionalNonNegativeNumber,
    startsAt: optionalDateString,
    expiresAt: optionalDateString,
    usageLimit: optionalPositiveInt,
    usageLimitPerUser: z.coerce.number().int().positive().default(1),
    isActive: z.coerce.boolean().default(true),
    applicableCategoryId: optionalUuid,
    applicableProductId: optionalUuid,
  })
  .superRefine((value, context) => {
    if (value.discountScope === DiscountScope.CATEGORY && !value.applicableCategoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicableCategoryId"],
        message: "Category is required for category-scope coupon",
      });
    }

    if (value.discountScope === DiscountScope.PRODUCT && !value.applicableProductId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicableProductId"],
        message: "Product is required for product-scope coupon",
      });
    }
  });

export const createCouponSchema = couponCreateBaseSchema.transform((value) => ({
  code: value.code.trim().toUpperCase(),
  title: value.title.trim(),
  description: normalizeText(value.description),
  discountType: value.discountType,
  discountScope: value.discountScope,
  discountValue: value.discountValue,
  minPurchaseAmount: value.minPurchaseAmount,
  maxDiscountAmount: value.maxDiscountAmount ?? null,
  startsAt: normalizeDate(value.startsAt),
  expiresAt: normalizeDate(value.expiresAt),
  usageLimit: value.usageLimit ?? null,
  usageLimitPerUser: value.usageLimitPerUser,
  isActive: value.isActive,
  applicableCategoryId: value.applicableCategoryId ?? null,
  applicableProductId: value.applicableProductId ?? null,
}));

export const updateCouponSchema = z
  .object({
    code: textField
      .min(3, "Coupon code must be at least 3 characters")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore, and hyphen")
      .optional(),
    title: textField.min(3).max(160).optional(),
    description: optionalText,
    discountType: z.nativeEnum(DiscountType).optional(),
    discountScope: z.nativeEnum(DiscountScope).optional(),
    discountValue: z.coerce.number().positive().optional(),
    minPurchaseAmount: z.coerce.number().min(0).optional(),
    maxDiscountAmount: optionalNonNegativeNumber,
    startsAt: optionalDateString,
    expiresAt: optionalDateString,
    usageLimit: optionalPositiveInt,
    usageLimitPerUser: z.coerce.number().int().positive().optional(),
    isActive: z.coerce.boolean().optional(),
    applicableCategoryId: optionalUuid,
    applicableProductId: optionalUuid,
  })
  .superRefine((value, context) => {
    if (value.discountScope === DiscountScope.CATEGORY && value.applicableCategoryId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicableCategoryId"],
        message: "Category is required when scope is CATEGORY",
      });
    }

    if (value.discountScope === DiscountScope.PRODUCT && value.applicableProductId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicableProductId"],
        message: "Product is required when scope is PRODUCT",
      });
    }
  });

export function normalizeOptionalCouponUpdate(payload: z.infer<typeof updateCouponSchema>) {
  return {
    ...(payload.code !== undefined ? { code: payload.code.trim().toUpperCase() } : {}),
    ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
    ...(payload.description !== undefined ? { description: normalizeText(payload.description) } : {}),
    ...(payload.discountType !== undefined ? { discountType: payload.discountType } : {}),
    ...(payload.discountScope !== undefined ? { discountScope: payload.discountScope } : {}),
    ...(payload.discountValue !== undefined ? { discountValue: payload.discountValue } : {}),
    ...(payload.minPurchaseAmount !== undefined
      ? { minPurchaseAmount: payload.minPurchaseAmount }
      : {}),
    ...(payload.maxDiscountAmount !== undefined
      ? { maxDiscountAmount: payload.maxDiscountAmount ?? null }
      : {}),
    ...(payload.startsAt !== undefined ? { startsAt: normalizeDate(payload.startsAt) } : {}),
    ...(payload.expiresAt !== undefined ? { expiresAt: normalizeDate(payload.expiresAt) } : {}),
    ...(payload.usageLimit !== undefined ? { usageLimit: payload.usageLimit ?? null } : {}),
    ...(payload.usageLimitPerUser !== undefined
      ? { usageLimitPerUser: payload.usageLimitPerUser }
      : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    ...(payload.applicableCategoryId !== undefined
      ? { applicableCategoryId: payload.applicableCategoryId ?? null }
      : {}),
    ...(payload.applicableProductId !== undefined
      ? { applicableProductId: payload.applicableProductId ?? null }
      : {}),
  };
}

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
