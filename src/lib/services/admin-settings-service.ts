import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import type { AdminSettingsState } from "@/types/settings";

const availableLanguages = ["en", "si", "ta"];
const requiredBankTransferPaymentFields = [
  { key: "bankTransferAccountName", label: "Bank transfer account name" },
  { key: "bankTransferBankName", label: "Bank name" },
  { key: "bankTransferAccountNumber", label: "Bank account number" },
] as const;

const settingMeta = {
  siteName: { group: "general", key: "site_name", isPublic: true, description: "Main website name" },
  siteTagline: {
    group: "general",
    key: "site_tagline",
    isPublic: true,
    description: "Public website tagline",
  },
  logoUrl: { group: "general", key: "logo_url", isPublic: true, description: "Brand logo URL" },
  themeMode: { group: "general", key: "theme_mode", isPublic: true, description: "Theme mode preference" },
  supportEmail: { group: "contact", key: "support_email", isPublic: true, description: "Support email" },
  supportPhone: { group: "contact", key: "support_phone", isPublic: true, description: "Support phone number" },
  whatsappNumber: {
    group: "contact",
    key: "whatsapp_number",
    isPublic: true,
    description: "WhatsApp contact number",
  },
  businessAddress: {
    group: "contact",
    key: "business_address",
    isPublic: true,
    description: "Business contact address",
  },
  facebookUrl: { group: "social", key: "facebook_url", isPublic: true, description: "Facebook profile URL" },
  instagramUrl: {
    group: "social",
    key: "instagram_url",
    isPublic: true,
    description: "Instagram profile URL",
  },
  youtubeUrl: { group: "social", key: "youtube_url", isPublic: true, description: "YouTube channel URL" },
  tiktokUrl: { group: "social", key: "tiktok_url", isPublic: true, description: "TikTok profile URL" },
  defaultLanguage: {
    group: "localization",
    key: "default_language",
    isPublic: true,
    description: "Default interface language",
  },
  enabledLanguages: {
    group: "localization",
    key: "enabled_languages",
    isPublic: true,
    description: "Enabled language options",
  },
  defaultCurrency: {
    group: "localization",
    key: "default_currency",
    isPublic: true,
    description: "Default display currency",
  },
  enabledCurrencies: {
    group: "localization",
    key: "enabled_currencies",
    isPublic: true,
    description: "Enabled display currencies",
  },
  taxRatePercentage: {
    group: "checkout",
    key: "tax_rate_percentage",
    isPublic: false,
    description: "Default checkout tax percentage",
  },
  allowGuestCheckout: {
    group: "checkout",
    key: "allow_guest_checkout",
    isPublic: false,
    description: "Allow guest checkout",
  },
  cardPaymentEnabled: {
    group: "payment",
    key: "card_payment_enabled",
    isPublic: false,
    description: "Enable card payment method",
  },
  cardPaymentProvider: {
    group: "payment",
    key: "card_payment_provider",
    isPublic: false,
    description: "Card payment gateway provider mode",
  },
  bankTransferEnabled: {
    group: "payment",
    key: "bank_transfer_enabled",
    isPublic: false,
    description: "Enable bank transfer payment method",
  },
  cashOnDeliveryEnabled: {
    group: "payment",
    key: "cash_on_delivery_enabled",
    isPublic: false,
    description: "Enable cash on delivery payment method",
  },
  bankTransferAccountName: {
    group: "payment",
    key: "bank_transfer_account_name",
    isPublic: false,
    description: "Bank transfer account name",
  },
  bankTransferBankName: {
    group: "payment",
    key: "bank_transfer_bank_name",
    isPublic: false,
    description: "Bank transfer bank name",
  },
  bankTransferAccountNumber: {
    group: "payment",
    key: "bank_transfer_account_number",
    isPublic: false,
    description: "Bank transfer account number",
  },
  bankTransferBranch: {
    group: "payment",
    key: "bank_transfer_branch",
    isPublic: false,
    description: "Bank transfer branch",
  },
  bankTransferSwift: {
    group: "payment",
    key: "bank_transfer_swift",
    isPublic: false,
    description: "Bank transfer SWIFT code",
  },
  bankTransferNote: {
    group: "payment",
    key: "bank_transfer_note",
    isPublic: false,
    description: "Bank transfer payment note",
  },
  heroAutoRotateSeconds: {
    group: "banner",
    key: "hero_auto_rotate_seconds",
    isPublic: false,
    description: "Hero banner auto rotation interval",
  },
  promoBannerEnabled: {
    group: "banner",
    key: "promo_banner_enabled",
    isPublic: false,
    description: "Enable promotional banners section",
  },
  autoStockAlertsEnabled: {
    group: "notification",
    key: "notification_auto_stock_alerts_enabled",
    isPublic: false,
    description: "Enable automatic stock alert notifications",
  },
  lowStockThreshold: {
    group: "notification",
    key: "notification_low_stock_threshold",
    isPublic: false,
    description: "Global low stock threshold for admin alerts",
  },
  orderAlertsEnabled: {
    group: "notification",
    key: "notification_order_alerts_enabled",
    isPublic: false,
    description: "Enable order notifications",
  },
  paymentAlertsEnabled: {
    group: "notification",
    key: "notification_payment_alerts_enabled",
    isPublic: false,
    description: "Enable payment notifications",
  },
  reviewAlertsEnabled: {
    group: "notification",
    key: "notification_review_alerts_enabled",
    isPublic: false,
    description: "Enable review notifications",
  },
  promotionAlertsEnabled: {
    group: "notification",
    key: "notification_promotion_alerts_enabled",
    isPublic: false,
    description: "Enable promotion notifications",
  },
  systemAlertsEnabled: {
    group: "notification",
    key: "notification_system_alerts_enabled",
    isPublic: false,
    description: "Enable system notifications",
  },
} as const;

type SettingKey = (typeof settingMeta)[keyof typeof settingMeta]["key"];

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
}

function toStringValue(raw: unknown, fallback = "") {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return fallback;
}

function toNumberValue(raw: unknown, fallback = 0) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toBooleanValue(raw: unknown, fallback = false) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw.toLowerCase() === "true";
  return fallback;
}

function toStringArray(raw: unknown, fallback: string[] = []) {
  if (!Array.isArray(raw)) return fallback;
  return raw.filter((item): item is string => typeof item === "string").map((item) => item.trim());
}

function toCardPaymentProvider(raw: unknown): AdminSettingsState["payment"]["cardPaymentProvider"] {
  const normalized = toStringValue(raw, "SANDBOX").toUpperCase();
  return normalized === "STRIPE_CHECKOUT" ? "STRIPE_CHECKOUT" : "SANDBOX";
}

function hasEnvValue(value: string | undefined) {
  return Boolean(value && value.trim().length);
}

function getMissingStripeEnvironmentKeys() {
  const missing: string[] = [];
  if (!hasEnvValue(process.env.STRIPE_SECRET_KEY)) missing.push("STRIPE_SECRET_KEY");
  if (!hasEnvValue(process.env.STRIPE_WEBHOOK_SECRET)) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!hasEnvValue(process.env.NEXT_PUBLIC_APP_URL)) missing.push("NEXT_PUBLIC_APP_URL");
  return missing;
}

function getMissingBankTransferPaymentFields(payment: AdminSettingsState["payment"]) {
  return requiredBankTransferPaymentFields
    .filter((field) => !normalizeOptionalText(payment[field.key]).length)
    .map((field) => field.label);
}

async function upsertSetting(
  tx: Prisma.TransactionClient,
  keyInfo: (typeof settingMeta)[keyof typeof settingMeta],
  value: Prisma.InputJsonValue,
  actorUserId: string,
) {
  await tx.siteSetting.upsert({
    where: { settingKey: keyInfo.key },
    update: {
      settingValue: value,
      isPublic: keyInfo.isPublic,
      description: keyInfo.description,
      updatedBy: actorUserId,
    },
    create: {
      settingGroup: keyInfo.group,
      settingKey: keyInfo.key,
      settingValue: value,
      isPublic: keyInfo.isPublic,
      description: keyInfo.description,
      updatedBy: actorUserId,
    },
  });
}

export async function getAdminSettingsDashboard() {
  const keys = Object.values(settingMeta).map((item) => item.key as SettingKey);

  const [siteSettings, currencies, shippingMethods, homepageSections] = await Promise.all([
    db.siteSetting.findMany({
      where: {
        settingKey: {
          in: keys,
        },
      },
      select: {
        settingKey: true,
        settingValue: true,
      },
    }),
    db.supportedCurrency.findMany({
      orderBy: { code: "asc" },
      select: {
        code: true,
        isActive: true,
      },
    }),
    db.shippingMethod.findMany({
      where: {
        code: { in: ["STANDARD", "EXPRESS", "PICKUP"] },
      },
      select: {
        code: true,
        baseFee: true,
        isActive: true,
      },
    }),
    db.homepageSection.findMany({
      where: {
        sectionKey: { in: ["hero", "featured_categories", "new_arrivals", "best_sellers"] },
      },
      select: {
        sectionKey: true,
        isActive: true,
      },
    }),
  ]);

  const settingsMap = new Map(siteSettings.map((item) => [item.settingKey, item.settingValue]));
  const shippingMap = new Map(shippingMethods.map((item) => [item.code, item]));
  const homepageMap = new Map(homepageSections.map((item) => [item.sectionKey, item.isActive]));

  const activeCurrencyCodes = currencies.filter((item) => item.isActive).map((item) => item.code);

  const enabledCurrencies =
    toStringArray(settingsMap.get(settingMeta.enabledCurrencies.key), activeCurrencyCodes).map((code) =>
      code.toUpperCase(),
    );

  const settings: AdminSettingsState = {
    general: {
      siteName: toStringValue(settingsMap.get(settingMeta.siteName.key), "Deal Bazaar"),
      siteTagline: toStringValue(settingsMap.get(settingMeta.siteTagline.key), ""),
      logoUrl: toStringValue(settingsMap.get(settingMeta.logoUrl.key), ""),
      themeMode:
        (toStringValue(settingsMap.get(settingMeta.themeMode.key), "system") as
          | "system"
          | "light"
          | "dark") ?? "system",
    },
    contact: {
      supportEmail: toStringValue(settingsMap.get(settingMeta.supportEmail.key), ""),
      supportPhone: toStringValue(settingsMap.get(settingMeta.supportPhone.key), ""),
      whatsappNumber: toStringValue(settingsMap.get(settingMeta.whatsappNumber.key), ""),
      businessAddress: toStringValue(settingsMap.get(settingMeta.businessAddress.key), ""),
    },
    social: {
      facebookUrl: toStringValue(settingsMap.get(settingMeta.facebookUrl.key), ""),
      instagramUrl: toStringValue(settingsMap.get(settingMeta.instagramUrl.key), ""),
      youtubeUrl: toStringValue(settingsMap.get(settingMeta.youtubeUrl.key), ""),
      tiktokUrl: toStringValue(settingsMap.get(settingMeta.tiktokUrl.key), ""),
    },
    localization: {
      defaultLanguage: toStringValue(settingsMap.get(settingMeta.defaultLanguage.key), "en"),
      enabledLanguages: toStringArray(settingsMap.get(settingMeta.enabledLanguages.key), ["en", "si"]),
      defaultCurrency: toStringValue(settingsMap.get(settingMeta.defaultCurrency.key), "LKR").toUpperCase(),
      enabledCurrencies,
    },
    checkout: {
      taxRatePercentage: toNumberValue(settingsMap.get(settingMeta.taxRatePercentage.key), 8),
      allowGuestCheckout: toBooleanValue(settingsMap.get(settingMeta.allowGuestCheckout.key), true),
    },
    payment: {
      cardPaymentProvider: toCardPaymentProvider(
        settingsMap.get(settingMeta.cardPaymentProvider.key),
      ),
      cardPaymentEnabled: toBooleanValue(settingsMap.get(settingMeta.cardPaymentEnabled.key), true),
      bankTransferEnabled: toBooleanValue(settingsMap.get(settingMeta.bankTransferEnabled.key), true),
      cashOnDeliveryEnabled: toBooleanValue(settingsMap.get(settingMeta.cashOnDeliveryEnabled.key), false),
      bankTransferAccountName: toStringValue(settingsMap.get(settingMeta.bankTransferAccountName.key), ""),
      bankTransferBankName: toStringValue(settingsMap.get(settingMeta.bankTransferBankName.key), ""),
      bankTransferAccountNumber: toStringValue(settingsMap.get(settingMeta.bankTransferAccountNumber.key), ""),
      bankTransferBranch: toStringValue(settingsMap.get(settingMeta.bankTransferBranch.key), ""),
      bankTransferSwift: toStringValue(settingsMap.get(settingMeta.bankTransferSwift.key), ""),
      bankTransferNote: toStringValue(settingsMap.get(settingMeta.bankTransferNote.key), ""),
    },
    shipping: {
      standardDeliveryFee: toNumberValue(shippingMap.get("STANDARD")?.baseFee, 450),
      expressDeliveryFee: toNumberValue(shippingMap.get("EXPRESS")?.baseFee, 950),
      pickupEnabled: shippingMap.get("PICKUP")?.isActive ?? true,
    },
    homepage: {
      heroEnabled: homepageMap.get("hero") ?? true,
      featuredCategoriesEnabled: homepageMap.get("featured_categories") ?? true,
      newArrivalsEnabled: homepageMap.get("new_arrivals") ?? true,
      bestSellersEnabled: homepageMap.get("best_sellers") ?? true,
    },
    banners: {
      heroAutoRotateSeconds: toNumberValue(settingsMap.get(settingMeta.heroAutoRotateSeconds.key), 6),
      promoBannerEnabled: toBooleanValue(settingsMap.get(settingMeta.promoBannerEnabled.key), true),
    },
    notifications: {
      autoStockAlertsEnabled: toBooleanValue(
        settingsMap.get(settingMeta.autoStockAlertsEnabled.key),
        true,
      ),
      lowStockThreshold: Math.max(
        1,
        Math.floor(toNumberValue(settingsMap.get(settingMeta.lowStockThreshold.key), 5)),
      ),
      orderAlertsEnabled: toBooleanValue(settingsMap.get(settingMeta.orderAlertsEnabled.key), true),
      paymentAlertsEnabled: toBooleanValue(settingsMap.get(settingMeta.paymentAlertsEnabled.key), true),
      reviewAlertsEnabled: toBooleanValue(settingsMap.get(settingMeta.reviewAlertsEnabled.key), true),
      promotionAlertsEnabled: toBooleanValue(
        settingsMap.get(settingMeta.promotionAlertsEnabled.key),
        true,
      ),
      systemAlertsEnabled: toBooleanValue(settingsMap.get(settingMeta.systemAlertsEnabled.key), true),
    },
  };

  const stripeSecretKeyConfigured = hasEnvValue(process.env.STRIPE_SECRET_KEY);
  const stripeWebhookSecretConfigured = hasEnvValue(process.env.STRIPE_WEBHOOK_SECRET);
  const appUrlConfigured = hasEnvValue(process.env.NEXT_PUBLIC_APP_URL);
  const stripeReady =
    stripeSecretKeyConfigured && stripeWebhookSecretConfigured && appUrlConfigured;

  return {
    settings,
    options: {
      availableCurrencies: currencies.map((currency) => currency.code),
      availableLanguages,
    },
    paymentHealth: {
      stripeSecretKeyConfigured,
      stripeWebhookSecretConfigured,
      appUrlConfigured,
      stripeReady,
      sandboxReady: true,
    },
  };
}

export async function updateAdminSettings(payload: AdminSettingsState, actorUserId: string) {
  const normalizedEnabledCurrencies = Array.from(
    new Set(
      payload.localization.enabledCurrencies
        .map((code) => code.toUpperCase().trim())
        .filter((code) => code.length === 3),
    ),
  );
  const defaultCurrency = payload.localization.defaultCurrency.toUpperCase();
  if (!normalizedEnabledCurrencies.includes(defaultCurrency)) {
    normalizedEnabledCurrencies.push(defaultCurrency);
  }

  const normalizedEnabledLanguages = Array.from(
    new Set(
      payload.localization.enabledLanguages
        .map((lang) => lang.toLowerCase().trim())
        .filter((lang) => lang.length >= 2),
    ),
  );

  if (!normalizedEnabledLanguages.includes(payload.localization.defaultLanguage.toLowerCase())) {
    normalizedEnabledLanguages.push(payload.localization.defaultLanguage.toLowerCase());
  }

  const enabledPaymentMethodsCount = [
    payload.payment.cardPaymentEnabled,
    payload.payment.bankTransferEnabled,
    payload.payment.cashOnDeliveryEnabled,
  ].filter(Boolean).length;
  if (enabledPaymentMethodsCount === 0) {
    throw new AppError(
      "At least one payment method must remain enabled.",
      400,
      "PAYMENT_METHOD_REQUIRED",
    );
  }

  if (
    payload.payment.cardPaymentEnabled &&
    payload.payment.cardPaymentProvider === "STRIPE_CHECKOUT"
  ) {
    const missingStripeEnvironmentKeys = getMissingStripeEnvironmentKeys();
    if (missingStripeEnvironmentKeys.length > 0) {
      throw new AppError(
        `Stripe Checkout is not ready. Missing: ${missingStripeEnvironmentKeys.join(", ")}.`,
        400,
        "STRIPE_CONFIGURATION_INCOMPLETE",
      );
    }
  }

  if (payload.payment.bankTransferEnabled) {
    const missingBankTransferPaymentFields = getMissingBankTransferPaymentFields(payload.payment);
    if (missingBankTransferPaymentFields.length > 0) {
      throw new AppError(
        `Bank transfer details are incomplete. Please fill: ${missingBankTransferPaymentFields.join(", ")}.`,
        400,
        "BANK_TRANSFER_DETAILS_INCOMPLETE",
      );
    }
  }

  await db.$transaction(async (tx) => {
    const existingCurrencies = await tx.supportedCurrency.findMany({
      where: {
        code: { in: normalizedEnabledCurrencies },
      },
      select: { code: true },
    });

    if (existingCurrencies.length !== normalizedEnabledCurrencies.length) {
      throw new AppError("One or more selected currencies are not supported", 400, "INVALID_CURRENCY_CODE");
    }

    await Promise.all([
      upsertSetting(tx, settingMeta.siteName, normalizeOptionalText(payload.general.siteName), actorUserId),
      upsertSetting(tx, settingMeta.siteTagline, normalizeOptionalText(payload.general.siteTagline), actorUserId),
      upsertSetting(tx, settingMeta.logoUrl, normalizeOptionalText(payload.general.logoUrl), actorUserId),
      upsertSetting(tx, settingMeta.themeMode, payload.general.themeMode, actorUserId),
      upsertSetting(tx, settingMeta.supportEmail, normalizeOptionalText(payload.contact.supportEmail), actorUserId),
      upsertSetting(tx, settingMeta.supportPhone, normalizeOptionalText(payload.contact.supportPhone), actorUserId),
      upsertSetting(
        tx,
        settingMeta.whatsappNumber,
        normalizeOptionalText(payload.contact.whatsappNumber),
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.businessAddress,
        normalizeOptionalText(payload.contact.businessAddress),
        actorUserId,
      ),
      upsertSetting(tx, settingMeta.facebookUrl, normalizeOptionalText(payload.social.facebookUrl), actorUserId),
      upsertSetting(tx, settingMeta.instagramUrl, normalizeOptionalText(payload.social.instagramUrl), actorUserId),
      upsertSetting(tx, settingMeta.youtubeUrl, normalizeOptionalText(payload.social.youtubeUrl), actorUserId),
      upsertSetting(tx, settingMeta.tiktokUrl, normalizeOptionalText(payload.social.tiktokUrl), actorUserId),
      upsertSetting(
        tx,
        settingMeta.defaultLanguage,
        payload.localization.defaultLanguage.toLowerCase(),
        actorUserId,
      ),
      upsertSetting(tx, settingMeta.enabledLanguages, normalizedEnabledLanguages, actorUserId),
      upsertSetting(tx, settingMeta.defaultCurrency, defaultCurrency, actorUserId),
      upsertSetting(tx, settingMeta.enabledCurrencies, normalizedEnabledCurrencies, actorUserId),
      upsertSetting(tx, settingMeta.taxRatePercentage, payload.checkout.taxRatePercentage, actorUserId),
      upsertSetting(tx, settingMeta.allowGuestCheckout, payload.checkout.allowGuestCheckout, actorUserId),
      upsertSetting(
        tx,
        settingMeta.cardPaymentProvider,
        payload.payment.cardPaymentProvider,
        actorUserId,
      ),
      upsertSetting(tx, settingMeta.cardPaymentEnabled, payload.payment.cardPaymentEnabled, actorUserId),
      upsertSetting(tx, settingMeta.bankTransferEnabled, payload.payment.bankTransferEnabled, actorUserId),
      upsertSetting(tx, settingMeta.cashOnDeliveryEnabled, payload.payment.cashOnDeliveryEnabled, actorUserId),
      upsertSetting(
        tx,
        settingMeta.bankTransferAccountName,
        normalizeOptionalText(payload.payment.bankTransferAccountName),
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.bankTransferBankName,
        normalizeOptionalText(payload.payment.bankTransferBankName),
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.bankTransferAccountNumber,
        normalizeOptionalText(payload.payment.bankTransferAccountNumber),
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.bankTransferBranch,
        normalizeOptionalText(payload.payment.bankTransferBranch),
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.bankTransferSwift,
        normalizeOptionalText(payload.payment.bankTransferSwift),
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.bankTransferNote,
        normalizeOptionalText(payload.payment.bankTransferNote),
        actorUserId,
      ),
      upsertSetting(tx, settingMeta.heroAutoRotateSeconds, payload.banners.heroAutoRotateSeconds, actorUserId),
      upsertSetting(tx, settingMeta.promoBannerEnabled, payload.banners.promoBannerEnabled, actorUserId),
      upsertSetting(
        tx,
        settingMeta.autoStockAlertsEnabled,
        payload.notifications.autoStockAlertsEnabled,
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.lowStockThreshold,
        payload.notifications.lowStockThreshold,
        actorUserId,
      ),
      upsertSetting(tx, settingMeta.orderAlertsEnabled, payload.notifications.orderAlertsEnabled, actorUserId),
      upsertSetting(
        tx,
        settingMeta.paymentAlertsEnabled,
        payload.notifications.paymentAlertsEnabled,
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.reviewAlertsEnabled,
        payload.notifications.reviewAlertsEnabled,
        actorUserId,
      ),
      upsertSetting(
        tx,
        settingMeta.promotionAlertsEnabled,
        payload.notifications.promotionAlertsEnabled,
        actorUserId,
      ),
      upsertSetting(tx, settingMeta.systemAlertsEnabled, payload.notifications.systemAlertsEnabled, actorUserId),
    ]);

    await tx.supportedCurrency.updateMany({
      data: { isActive: false },
    });

    await tx.supportedCurrency.updateMany({
      where: {
        code: { in: normalizedEnabledCurrencies },
      },
      data: { isActive: true },
    });

    await Promise.all([
      tx.shippingMethod.upsert({
        where: { code: "STANDARD" },
        update: {
          baseFee: payload.shipping.standardDeliveryFee,
          isActive: true,
        },
        create: {
          name: "Standard Delivery",
          code: "STANDARD",
          baseFee: payload.shipping.standardDeliveryFee,
          estimatedDaysMin: 2,
          estimatedDaysMax: 4,
          isActive: true,
        },
      }),
      tx.shippingMethod.upsert({
        where: { code: "EXPRESS" },
        update: {
          baseFee: payload.shipping.expressDeliveryFee,
          isActive: true,
        },
        create: {
          name: "Express Delivery",
          code: "EXPRESS",
          baseFee: payload.shipping.expressDeliveryFee,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
          isActive: true,
        },
      }),
      tx.shippingMethod.upsert({
        where: { code: "PICKUP" },
        update: {
          isActive: payload.shipping.pickupEnabled,
          baseFee: 0,
        },
        create: {
          name: "Store Pickup",
          code: "PICKUP",
          baseFee: 0,
          estimatedDaysMin: 0,
          estimatedDaysMax: 1,
          isActive: payload.shipping.pickupEnabled,
        },
      }),
      tx.homepageSection.upsert({
        where: { sectionKey: "hero" },
        update: { isActive: payload.homepage.heroEnabled, updatedBy: actorUserId },
        create: {
          sectionKey: "hero",
          isActive: payload.homepage.heroEnabled,
          updatedBy: actorUserId,
        },
      }),
      tx.homepageSection.upsert({
        where: { sectionKey: "featured_categories" },
        update: { isActive: payload.homepage.featuredCategoriesEnabled, updatedBy: actorUserId },
        create: {
          sectionKey: "featured_categories",
          isActive: payload.homepage.featuredCategoriesEnabled,
          updatedBy: actorUserId,
        },
      }),
      tx.homepageSection.upsert({
        where: { sectionKey: "new_arrivals" },
        update: { isActive: payload.homepage.newArrivalsEnabled, updatedBy: actorUserId },
        create: {
          sectionKey: "new_arrivals",
          isActive: payload.homepage.newArrivalsEnabled,
          updatedBy: actorUserId,
        },
      }),
      tx.homepageSection.upsert({
        where: { sectionKey: "best_sellers" },
        update: { isActive: payload.homepage.bestSellersEnabled, updatedBy: actorUserId },
        create: {
          sectionKey: "best_sellers",
          isActive: payload.homepage.bestSellersEnabled,
          updatedBy: actorUserId,
        },
      }),
    ]);
  });
}
