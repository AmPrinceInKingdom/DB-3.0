export type AdminSettingsState = {
  general: {
    siteName: string;
    siteTagline: string;
    logoUrl: string;
    themeMode: "system" | "light" | "dark";
  };
  contact: {
    supportEmail: string;
    supportPhone: string;
    whatsappNumber: string;
    businessAddress: string;
  };
  social: {
    facebookUrl: string;
    instagramUrl: string;
    youtubeUrl: string;
    tiktokUrl: string;
  };
  localization: {
    defaultLanguage: string;
    enabledLanguages: string[];
    defaultCurrency: string;
    enabledCurrencies: string[];
  };
  checkout: {
    taxRatePercentage: number;
    allowGuestCheckout: boolean;
  };
  payment: {
    cardPaymentProvider: "SANDBOX" | "STRIPE_CHECKOUT";
    cardPaymentEnabled: boolean;
    bankTransferEnabled: boolean;
    cashOnDeliveryEnabled: boolean;
    bankTransferAccountName: string;
    bankTransferBankName: string;
    bankTransferAccountNumber: string;
    bankTransferBranch: string;
    bankTransferSwift: string;
    bankTransferNote: string;
  };
  shipping: {
    standardDeliveryFee: number;
    expressDeliveryFee: number;
    pickupEnabled: boolean;
  };
  homepage: {
    heroEnabled: boolean;
    featuredCategoriesEnabled: boolean;
    newArrivalsEnabled: boolean;
    bestSellersEnabled: boolean;
  };
  banners: {
    heroAutoRotateSeconds: number;
    promoBannerEnabled: boolean;
  };
  notifications: {
    autoStockAlertsEnabled: boolean;
    lowStockThreshold: number;
    orderAlertsEnabled: boolean;
    paymentAlertsEnabled: boolean;
    reviewAlertsEnabled: boolean;
    promotionAlertsEnabled: boolean;
    systemAlertsEnabled: boolean;
  };
};

export type AdminSettingsPayload = {
  settings: AdminSettingsState;
  options: {
    availableCurrencies: string[];
    availableLanguages: string[];
  };
  paymentHealth: {
    stripeSecretKeyConfigured: boolean;
    stripeWebhookSecretConfigured: boolean;
    appUrlConfigured: boolean;
    stripeReady: boolean;
    sandboxReady: boolean;
  };
};

export type PublicSiteSettings = {
  siteName: string;
  siteTagline: string;
  logoUrl: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  businessAddress: string;
  social: {
    facebookUrl: string;
    instagramUrl: string;
    youtubeUrl: string;
    tiktokUrl: string;
  };
  homepage: {
    heroEnabled: boolean;
    featuredCategoriesEnabled: boolean;
    newArrivalsEnabled: boolean;
    bestSellersEnabled: boolean;
    promoBannerEnabled: boolean;
  };
};

export type AccountNotificationPreferencesState = {
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  categories: {
    order: boolean;
    payment: boolean;
    review: boolean;
    promotion: boolean;
    system: boolean;
    stock: boolean;
  };
};

export type AccountCheckoutPaymentMethod = "CARD" | "BANK_TRANSFER";

export type AccountNotificationSettingsPayload = {
  preferences: AccountNotificationPreferencesState;
  updatedAt: string | null;
};

export type AccountCheckoutSettingsPayload = {
  preferredPaymentMethod: AccountCheckoutPaymentMethod;
  preferredShippingMethodCode: string;
  updatedAt: string | null;
};
