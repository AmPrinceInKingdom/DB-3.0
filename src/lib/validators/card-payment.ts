import { z } from "zod";

export const getCardPaymentSessionSchema = z.object({
  token: z.string().trim().min(24).max(320),
});

export const completeCardPaymentSessionSchema = z
  .object({
    token: z.string().trim().min(24).max(320),
    approved: z.boolean(),
    cardBrand: z.string().trim().max(40).optional(),
    cardLast4: z.string().trim().regex(/^\d{4}$/).optional(),
    failureReason: z.string().trim().max(240).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.approved && !value.cardLast4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cardLast4 is required for approved payments.",
        path: ["cardLast4"],
      });
    }
  });

export const retryCardPaymentSchema = z.object({
  orderId: z.uuid(),
  customerEmail: z.email().toLowerCase().optional(),
});

export type CompleteCardPaymentSessionInput = z.infer<typeof completeCardPaymentSessionSchema>;
export type RetryCardPaymentInput = z.infer<typeof retryCardPaymentSchema>;
