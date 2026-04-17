import { z } from "zod";

const optionalText = z.string().trim().optional().nullable().or(z.literal(""));

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const wishlistSyncItemSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  addedAt: optionalText,
});

const compareSyncItemSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  addedAt: optionalText,
});

export const accountWishlistSyncSchema = z.object({
  items: z.array(wishlistSyncItemSchema).max(300),
}).transform((value) => ({
  items: value.items.map((item) => ({
    productId: item.productId.trim(),
    addedAt: normalizeDate(item.addedAt),
  })),
}));

export const accountCompareSyncSchema = z.object({
  items: z.array(compareSyncItemSchema).max(20),
}).transform((value) => ({
  items: value.items.map((item) => ({
    productId: item.productId.trim(),
    addedAt: normalizeDate(item.addedAt),
  })),
}));

export type AccountWishlistSyncInput = z.infer<typeof accountWishlistSyncSchema>;
export type AccountCompareSyncInput = z.infer<typeof accountCompareSyncSchema>;
