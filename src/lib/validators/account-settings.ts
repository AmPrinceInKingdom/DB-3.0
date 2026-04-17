import { z } from "zod";

export const accountNotificationSettingsUpdateSchema = z.object({
  preferences: z.object({
    channels: z.object({
      push: z.coerce.boolean(),
      email: z.coerce.boolean(),
      sms: z.coerce.boolean(),
    }),
    categories: z.object({
      order: z.coerce.boolean(),
      payment: z.coerce.boolean(),
      review: z.coerce.boolean(),
      promotion: z.coerce.boolean(),
      system: z.coerce.boolean(),
      stock: z.coerce.boolean(),
    }),
  }),
});

export type AccountNotificationSettingsUpdateInput = z.infer<
  typeof accountNotificationSettingsUpdateSchema
>;

export const accountCheckoutSettingsUpdateSchema = z.object({
  preferredPaymentMethod: z.enum(["CARD", "BANK_TRANSFER"]),
  preferredShippingMethodCode: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase()),
});

export type AccountCheckoutSettingsUpdateInput = z.infer<
  typeof accountCheckoutSettingsUpdateSchema
>;
