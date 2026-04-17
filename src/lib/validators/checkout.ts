import { z } from "zod";

const optionalText = z.string().trim().optional().or(z.literal(""));
const currencyCodeSchema = z.enum(["LKR", "USD", "EUR", "GBP", "INR"]);
const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "Image URL must be absolute or root-relative",
  );

function normalizeText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const cartLineItemSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1).max(240),
  brand: z.string().min(1).max(160),
  imageUrl: imageUrlSchema,
  quantity: z.coerce.number().int().min(1).max(20),
  unitPriceBase: z.coerce.number().positive(),
  variantId: z.string().optional().nullable(),
  variantLabel: z.string().max(180).optional().nullable(),
});
const cartLineItemsSchema = z.array(cartLineItemSchema).min(1).max(100);

const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  company: optionalText,
  phone: optionalText,
  line1: z.string().trim().min(1).max(220),
  line2: optionalText,
  city: z.string().trim().min(1).max(120),
  state: optionalText,
  postalCode: optionalText,
  countryCode: z.string().trim().toUpperCase().min(2).max(2),
});

export const createOrderSchema = z
  .object({
    customerEmail: z.email().toLowerCase(),
    customerPhone: optionalText,
    notes: optionalText,
    couponCode: optionalText,
    billingAddressId: z.string().uuid().optional().nullable(),
    shippingAddressId: z.string().uuid().optional().nullable(),
    shippingMethodCode: z.string().trim().min(1).max(50),
    paymentMethod: z.enum(["CARD", "BANK_TRANSFER"]),
    currencyCode: currencyCodeSchema,
    items: cartLineItemsSchema,
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
  })
  .transform((value) => ({
    ...value,
    customerPhone: normalizeText(value.customerPhone),
    notes: normalizeText(value.notes),
    couponCode: normalizeText(value.couponCode)?.toUpperCase() ?? null,
    billingAddressId: normalizeText(value.billingAddressId),
    shippingAddressId: normalizeText(value.shippingAddressId),
    billingAddress: {
      ...value.billingAddress,
      company: normalizeText(value.billingAddress.company),
      phone: normalizeText(value.billingAddress.phone),
      line2: normalizeText(value.billingAddress.line2),
      state: normalizeText(value.billingAddress.state),
      postalCode: normalizeText(value.billingAddress.postalCode),
    },
    shippingAddress: {
      ...value.shippingAddress,
      company: normalizeText(value.shippingAddress.company),
      phone: normalizeText(value.shippingAddress.phone),
      line2: normalizeText(value.shippingAddress.line2),
      state: normalizeText(value.shippingAddress.state),
      postalCode: normalizeText(value.shippingAddress.postalCode),
    },
  }));

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const previewCouponSchema = z
  .object({
    couponCode: z.string().trim().min(3).max(80),
    shippingMethodCode: z.string().trim().min(1).max(50),
    currencyCode: currencyCodeSchema,
    items: cartLineItemsSchema,
  })
  .transform((value) => ({
    ...value,
    couponCode: value.couponCode.trim().toUpperCase(),
  }));

export type PreviewCouponInput = z.infer<typeof previewCouponSchema>;
