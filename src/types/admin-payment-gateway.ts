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
  appUrlConfigured: boolean;
  stripeReady: boolean;
  missingStripeRequirements: string[];
  sandboxReady: boolean;
  selectedProviderReady: boolean;
  bankTransferDetailsReady: boolean;
  missingBankTransferFields: string[];
  appUrl: string | null;
  stripeWebhookPath: string;
  stripeWebhookUrl: string | null;
};

export type AdminPaymentGatewayPayload = {
  settings: AdminPaymentGatewaySettings;
  health: AdminPaymentGatewayHealth;
};
