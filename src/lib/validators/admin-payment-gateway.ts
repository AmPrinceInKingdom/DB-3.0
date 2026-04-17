import { z } from "zod";

const optionalText = z.string().trim().max(500).or(z.literal("")).default("");

export const adminPaymentGatewayUpdateSchema = z.object({
  cardPaymentProvider: z.enum(["SANDBOX", "STRIPE_CHECKOUT"]),
  cardPaymentEnabled: z.coerce.boolean(),
  bankTransferEnabled: z.coerce.boolean(),
  cashOnDeliveryEnabled: z.coerce.boolean(),
  bankTransferAccountName: optionalText,
  bankTransferBankName: optionalText,
  bankTransferAccountNumber: optionalText,
  bankTransferBranch: optionalText,
  bankTransferSwift: optionalText,
  bankTransferNote: optionalText,
});

export type AdminPaymentGatewayUpdateInput = z.infer<typeof adminPaymentGatewayUpdateSchema>;

