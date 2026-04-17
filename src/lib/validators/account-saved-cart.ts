import { z } from "zod";

const optionalText = z.string().trim().optional().nullable().or(z.literal(""));

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeSavedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const accountSavedCartItemInputSchema = z.object({
  lineId: z.string().trim().min(1).max(255),
  productId: z.string().trim().min(1).max(120),
  variantId: optionalText,
  quantity: z.coerce.number().int().min(1).max(20),
  savedAt: optionalText,
});

export const accountSavedCartSyncSchema = z.object({
  items: z.array(accountSavedCartItemInputSchema).max(120),
}).transform((value) => ({
  items: value.items.map((item) => ({
    lineId: item.lineId.trim(),
    productId: item.productId.trim(),
    variantId: normalizeOptionalText(item.variantId),
    quantity: item.quantity,
    savedAt: normalizeSavedAt(item.savedAt),
  })),
}));

export type AccountSavedCartSyncInput = z.infer<typeof accountSavedCartSyncSchema>;
