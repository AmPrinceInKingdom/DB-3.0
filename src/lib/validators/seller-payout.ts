import { PayoutStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().max(300).optional().or(z.literal(""));

export const sellerPayoutAccountCreateSchema = z.object({
  bankName: z.string().trim().min(2).max(120),
  accountName: z.string().trim().min(2).max(180),
  accountNumber: z.string().trim().min(4).max(100),
  branchName: z.string().trim().max(120).optional().or(z.literal("")),
  swiftCode: z.string().trim().max(32).optional().or(z.literal("")),
  isDefault: z.boolean().optional().default(false),
});

export const sellerPayoutAccountUpdateSchema = z.object({
  bankName: z.string().trim().min(2).max(120).optional(),
  accountName: z.string().trim().min(2).max(180).optional(),
  accountNumber: z.string().trim().min(4).max(100).optional(),
  branchName: z.string().trim().max(120).optional().or(z.literal("")),
  swiftCode: z.string().trim().max(32).optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export const adminCreatePayoutSchema = z.object({
  sellerId: z.string().trim().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  periodStart: z.string().datetime().optional().or(z.literal("")),
  periodEnd: z.string().datetime().optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: optionalText,
});

export const adminUpdatePayoutSchema = z.object({
  status: z.nativeEnum(PayoutStatus).optional(),
  paidAt: z.string().datetime().optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: optionalText,
});

export type SellerPayoutAccountCreateInput = z.infer<typeof sellerPayoutAccountCreateSchema>;
export type SellerPayoutAccountUpdateInput = z.infer<typeof sellerPayoutAccountUpdateSchema>;
export type AdminCreatePayoutInput = z.infer<typeof adminCreatePayoutSchema>;
export type AdminUpdatePayoutInput = z.infer<typeof adminUpdatePayoutSchema>;
