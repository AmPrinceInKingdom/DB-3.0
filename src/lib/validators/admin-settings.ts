import { z } from "zod";

const optionalText = z.string().trim().max(500).or(z.literal("")).default("");
const optionalUrl = z.string().trim().url().or(z.literal("")).default("");
const optionalEmail = z.string().trim().email().or(z.literal("")).default("");
const optionalLogoUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => value === "" || value.startsWith("/") || /^https?:\/\//i.test(value),
    "Logo URL must be an absolute URL or root-relative path",
  )
  .default("");

export const adminSettingsUpdateSchema = z.object({
  general: z.object({
    siteName: z.string().trim().min(2).max(120),
    siteTagline: optionalText,
    logoUrl: optionalLogoUrl,
    themeMode: z.enum(["system", "light", "dark"]),
  }),
  contact: z.object({
    supportEmail: optionalEmail,
    supportPhone: optionalText,
    whatsappNumber: optionalText,
    businessAddress: optionalText,
  }),
  social: z.object({
    facebookUrl: optionalUrl,
    instagramUrl: optionalUrl,
    youtubeUrl: optionalUrl,
    tiktokUrl: optionalUrl,
  }),
  localization: z.object({
    defaultLanguage: z.string().trim().min(2).max(16),
    enabledLanguages: z.array(z.string().trim().min(2).max(16)).min(1),
    defaultCurrency: z.string().trim().length(3),
    enabledCurrencies: z.array(z.string().trim().length(3)).min(1),
  }),
  checkout: z.object({
    taxRatePercentage: z.coerce.number().min(0).max(100),
    allowGuestCheckout: z.coerce.boolean(),
  }),
  payment: z.object({
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
  }),
  shipping: z.object({
    standardDeliveryFee: z.coerce.number().min(0),
    expressDeliveryFee: z.coerce.number().min(0),
    pickupEnabled: z.coerce.boolean(),
  }),
  homepage: z.object({
    heroEnabled: z.coerce.boolean(),
    featuredCategoriesEnabled: z.coerce.boolean(),
    newArrivalsEnabled: z.coerce.boolean(),
    bestSellersEnabled: z.coerce.boolean(),
  }),
  banners: z.object({
    heroAutoRotateSeconds: z.coerce.number().int().min(2).max(30),
    promoBannerEnabled: z.coerce.boolean(),
  }),
  notifications: z.object({
    autoStockAlertsEnabled: z.coerce.boolean(),
    lowStockThreshold: z.coerce.number().int().min(1).max(500),
    orderAlertsEnabled: z.coerce.boolean(),
    paymentAlertsEnabled: z.coerce.boolean(),
    reviewAlertsEnabled: z.coerce.boolean(),
    promotionAlertsEnabled: z.coerce.boolean(),
    systemAlertsEnabled: z.coerce.boolean(),
  }),
});

export type AdminSettingsUpdateInput = z.infer<typeof adminSettingsUpdateSchema>;
