import type { AdminPaymentGatewayUpdateInput } from "@/lib/validators/admin-payment-gateway";
import {
  getAdminSettingsDashboard,
  updateAdminSettings,
} from "@/lib/services/admin-settings-service";
import { AppError } from "@/lib/errors";
import type {
  AdminPaymentGatewayPayload,
  AdminPaymentGatewaySettings,
} from "@/types/admin-payment-gateway";

const stripeWebhookPath = "/api/payments/card/stripe/webhook";
const requiredBankTransferFields = [
  { key: "bankTransferAccountName", label: "Bank transfer account name" },
  { key: "bankTransferBankName", label: "Bank name" },
  { key: "bankTransferAccountNumber", label: "Bank account number" },
] as const;

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
}

function normalizeAppUrl(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.replace(/\/+$/, "");
}

function getMissingStripeRequirements(health: {
  stripeSecretKeyConfigured: boolean;
  stripeWebhookSecretConfigured: boolean;
  appUrlConfigured: boolean;
}) {
  const missing: string[] = [];
  if (!health.stripeSecretKeyConfigured) missing.push("STRIPE_SECRET_KEY");
  if (!health.stripeWebhookSecretConfigured) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!health.appUrlConfigured) missing.push("NEXT_PUBLIC_APP_URL");
  return missing;
}

function getMissingBankTransferFields(settings: AdminPaymentGatewaySettings) {
  return requiredBankTransferFields
    .filter((field) => !normalizeOptionalText(settings[field.key]).length)
    .map((field) => field.label);
}

function mapSettings(
  input: AdminPaymentGatewayUpdateInput | AdminPaymentGatewaySettings,
): AdminPaymentGatewaySettings {
  return {
    cardPaymentProvider: input.cardPaymentProvider,
    cardPaymentEnabled: input.cardPaymentEnabled,
    bankTransferEnabled: input.bankTransferEnabled,
    cashOnDeliveryEnabled: input.cashOnDeliveryEnabled,
    bankTransferAccountName: normalizeOptionalText(input.bankTransferAccountName),
    bankTransferBankName: normalizeOptionalText(input.bankTransferBankName),
    bankTransferAccountNumber: normalizeOptionalText(input.bankTransferAccountNumber),
    bankTransferBranch: normalizeOptionalText(input.bankTransferBranch),
    bankTransferSwift: normalizeOptionalText(input.bankTransferSwift),
    bankTransferNote: normalizeOptionalText(input.bankTransferNote),
  };
}

export async function getAdminPaymentGatewayPanel(): Promise<AdminPaymentGatewayPayload> {
  const dashboard = await getAdminSettingsDashboard();
  const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  const stripeWebhookUrl = appUrl ? `${appUrl}${stripeWebhookPath}` : null;
  const settings = mapSettings(dashboard.settings.payment);
  const missingStripeRequirements = getMissingStripeRequirements(dashboard.paymentHealth);
  const missingBankTransferFields = getMissingBankTransferFields(settings);
  const selectedProviderReady =
    settings.cardPaymentProvider === "SANDBOX"
      ? dashboard.paymentHealth.sandboxReady
      : dashboard.paymentHealth.stripeReady;

  return {
    settings,
    health: {
      stripeSecretKeyConfigured: dashboard.paymentHealth.stripeSecretKeyConfigured,
      stripeWebhookSecretConfigured: dashboard.paymentHealth.stripeWebhookSecretConfigured,
      appUrlConfigured: dashboard.paymentHealth.appUrlConfigured,
      stripeReady: dashboard.paymentHealth.stripeReady,
      missingStripeRequirements,
      sandboxReady: dashboard.paymentHealth.sandboxReady,
      selectedProviderReady,
      bankTransferDetailsReady: missingBankTransferFields.length === 0,
      missingBankTransferFields,
      appUrl,
      stripeWebhookPath,
      stripeWebhookUrl,
    },
  };
}

export async function updateAdminPaymentGatewayPanel(
  input: AdminPaymentGatewayUpdateInput,
  actorUserId: string,
) {
  const current = await getAdminSettingsDashboard();
  const nextPaymentSettings = mapSettings(input);
  const missingStripeRequirements = getMissingStripeRequirements(current.paymentHealth);

  const enabledMethodsCount = [
    nextPaymentSettings.cardPaymentEnabled,
    nextPaymentSettings.bankTransferEnabled,
    nextPaymentSettings.cashOnDeliveryEnabled,
  ].filter(Boolean).length;

  if (enabledMethodsCount === 0) {
    throw new AppError(
      "At least one payment method must remain enabled.",
      400,
      "PAYMENT_METHOD_REQUIRED",
    );
  }

  if (
    nextPaymentSettings.cardPaymentEnabled &&
    nextPaymentSettings.cardPaymentProvider === "STRIPE_CHECKOUT" &&
    missingStripeRequirements.length > 0
  ) {
    throw new AppError(
      `Stripe Checkout is not ready. Missing: ${missingStripeRequirements.join(", ")}.`,
      400,
      "STRIPE_CONFIGURATION_INCOMPLETE",
    );
  }

  if (nextPaymentSettings.bankTransferEnabled) {
    const missingBankTransferFields = getMissingBankTransferFields(nextPaymentSettings);
    if (missingBankTransferFields.length > 0) {
      throw new AppError(
        `Bank transfer details are incomplete. Please fill: ${missingBankTransferFields.join(", ")}.`,
        400,
        "BANK_TRANSFER_DETAILS_INCOMPLETE",
      );
    }
  }

  const next = {
    ...current.settings,
    payment: nextPaymentSettings,
  };

  await updateAdminSettings(next, actorUserId);
  return getAdminPaymentGatewayPanel();
}
