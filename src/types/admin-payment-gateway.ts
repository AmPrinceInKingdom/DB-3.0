export type AdminPaymentGatewayProvider = "SANDBOX" | "STRIPE_CHECKOUT";

export type AdminPaymentGatewaySettings = {
  cardPaymentProvider: AdminPaymentGatewayProvider;
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

export type AdminPaymentGatewayHealth = {
  stripeSecretKeyConfigured: boolean;
  stripeWebhookSecretConfigured: boolean;
  stripeSecretKeyMode: "MISSING" | "UNKNOWN" | "TEST" | "LIVE";
  appUrlConfigured: boolean;
  appUrlHttps: boolean;
  appUrlLocalhost: boolean;
  stripeReady: boolean;
  missingStripeRequirements: string[];
  sandboxReady: boolean;
  selectedProviderReady: boolean;
  strictProduction: boolean;
  stripeProductionReady: boolean;
  stripeProductionWarnings: string[];
  bankTransferDetailsReady: boolean;
  missingBankTransferFields: string[];
  appUrl: string | null;
  stripeWebhookPath: string;
  stripeWebhookUrl: string | null;
  stripeConnection: {
    checkedAt: string | null;
    reachable: boolean;
    livemode: boolean | null;
    accountId: string | null;
    country: string | null;
    chargesEnabled: boolean | null;
    payoutsEnabled: boolean | null;
    detailsSubmitted: boolean | null;
    errorMessage: string | null;
  };
};

export type AdminPaymentGatewayPayload = {
  settings: AdminPaymentGatewaySettings;
  health: AdminPaymentGatewayHealth;
};
