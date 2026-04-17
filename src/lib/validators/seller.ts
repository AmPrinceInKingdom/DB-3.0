import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().default("");
const optionalLongText = z.string().trim().max(1500).optional().default("");
const optionalUrl = z.string().trim().url().or(z.literal("")).optional().default("");

export const sellerApplicationSchema = z.object({
  storeName: z.string().trim().min(3).max(160),
  supportEmail: z.string().trim().email().or(z.literal("")).optional().default(""),
  supportPhone: z.string().trim().max(32).optional().default(""),
  taxId: z.string().trim().max(100).optional().default(""),
  description: optionalText,
});

export const adminSellerReviewSchema = z.object({
  action: z.enum(["APPROVE", "SUSPEND", "REJECT"]),
  reason: z.string().trim().max(300).optional(),
});

export const sellerStoreProfileUpdateSchema = z.object({
  storeName: z.string().trim().min(3).max(160),
  supportEmail: z.string().trim().email().or(z.literal("")).optional().default(""),
  supportPhone: z.string().trim().max(32).optional().default(""),
  taxId: z.string().trim().max(100).optional().default(""),
  description: optionalLongText,
  logoUrl: optionalUrl,
  bannerUrl: optionalUrl,
});

export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;
export type AdminSellerReviewInput = z.infer<typeof adminSellerReviewSchema>;
export type SellerStoreProfileUpdateInput = z.infer<typeof sellerStoreProfileUpdateSchema>;
