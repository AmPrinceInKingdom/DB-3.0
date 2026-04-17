import { z } from "zod";

export const inventoryAdjustmentSchema = z
  .object({
    mode: z.enum(["ADJUST", "SET"]).default("ADJUST"),
    amount: z.coerce.number().int(),
    reason: z.string().trim().max(180).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.mode === "ADJUST" && value.amount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Adjustment amount cannot be zero",
      });
    }

    if (value.mode === "SET" && value.amount < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Set quantity must be zero or greater",
      });
    }
  });

export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
