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
const stripeApiBaseUrl = "https://api.stripe.com/v1";
const stripeConnectionCacheTtlMs = 60_000;
const requiredBankTransferFields = [
  { key: "bankTransferAccountName", label: "Bank transfer account name" },
  { key: "bankTransferBankName", label: "Bank name" },
  { key: "bankTransferAccountNumber", label: "Bank account number" },
] as const;
type StripeSecretKeyMode = "MISSING" | "UNKNOWN" | "TEST" | "LIVE";

type StripeConnectionHealth = {
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

let stripeConnectionCache:
  | {
      expiresAt: number;
      value: StripeConnectionHealth;
    }
  | null = null;

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

function detectStripeSecretKeyMode(value: string | undefined): StripeSecretKeyMode {
  if (!value || !value.trim().length) return "MISSING";
  const normalized = value.trim();
  if (normalized.startsWith("sk_live_")) return "LIVE";
  if (normalized.startsWith("sk_test_")) return "TEST";
  return "UNKNOWN";
}

function isHttpsUrl(value: string | null) {
  return Boolean(value && value.startsWith("https://"));
}

function isLocalhostUrl(value: string | null) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    const normalized = value.toLowerCase();
    return (
      normalized.includes("localhost") || normalized.includes("127.0.0.1") || normalized.includes("::1")
    );
  }
}

function isStrictProductionRuntime() {
  const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercelEnv.length > 0) {
    return vercelEnv === "production";
  }
  return (process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function normalizeStripeConnectionError(message: string) {
  if (!message.trim().length) return "Unable to connect to Stripe API.";
  return message.replace(/sk_(live|test)_[A-Za-z0-9]+/g, "sk_***");
}

function createAbortControllerWithTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    controller,
    release: () => clearTimeout(timeout),
  };
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  return null;
}

function parseString(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

async function fetchStripeConnectionHealth(options: { forceRefresh?: boolean } = {}) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!hasValue(stripeSecretKey)) {
    return {
      checkedAt: new Date().toISOString(),
      reachable: false,
      livemode: null,
      accountId: null,
      country: null,
      chargesEnabled: null,
      payoutsEnabled: null,
      detailsSubmitted: null,
      errorMessage: "STRIPE_SECRET_KEY is missing.",
    } satisfies StripeConnectionHealth;
  }

  if (!options.forceRefresh && stripeConnectionCache && stripeConnectionCache.expiresAt > Date.now()) {
    return stripeConnectionCache.value;
  }

  const { controller, release } = createAbortControllerWithTimeout(8_000);
  try {
    const response = await fetch(`${stripeApiBaseUrl}/account`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const responseText = await response.text();
    const checkedAt = new Date().toISOString();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    if (!response.ok || !payload) {
      const apiError = payload && typeof payload.error === "object" && payload.error
        ? (payload.error as Record<string, unknown>)
        : null;
      const message =
        parseString(apiError?.message) ??
        `Stripe API request failed with status ${response.status}.`;

      const failed = {
        checkedAt,
        reachable: false,
        livemode: null,
        accountId: null,
        country: null,
        chargesEnabled: null,
        payoutsEnabled: null,
        detailsSubmitted: null,
        errorMessage: normalizeStripeConnectionError(message),
      } satisfies StripeConnectionHealth;

      stripeConnectionCache = {
        expiresAt: Date.now() + stripeConnectionCacheTtlMs,
        value: failed,
      };
      return failed;
    }

    const successful = {
      checkedAt,
      reachable: true,
      livemode: parseBoolean(payload.livemode),
      accountId: parseString(payload.id),
      country: parseString(payload.country),
      chargesEnabled: parseBoolean(payload.charges_enabled),
      payoutsEnabled: parseBoolean(payload.payouts_enabled),
      detailsSubmitted: parseBoolean(payload.details_submitted),
      errorMessage: null,
    } satisfies StripeConnectionHealth;

    stripeConnectionCache = {
      expiresAt: Date.now() + stripeConnectionCacheTtlMs,
      value: successful,
    };
    return successful;
  } catch (error) {
    const failed = {
      checkedAt: new Date().toISOString(),
      reachable: false,
      livemode: null,
      accountId: null,
      country: null,
      chargesEnabled: null,
      payoutsEnabled: null,
      detailsSubmitted: null,
      errorMessage:
        error instanceof Error
          ? normalizeStripeConnectionError(error.message)
          : "Unable to connect to Stripe API.",
    } satisfies StripeConnectionHealth;

    stripeConnectionCache = {
      expiresAt: Date.now() + stripeConnectionCacheTtlMs,
      value: failed,
    };
    return failed;
  } finally {
    release();
  }
}

function getStripeProductionWarnings(input: {
  stripeReady: boolean;
  stripeSecretKeyMode: StripeSecretKeyMode;
  appUrlConfigured: boolean;
  appUrlHttps: boolean;
  appUrlLocalhost: boolean;
  stripeWebhookSecretConfigured: boolean;
  stripeConnection: StripeConnectionHealth;
}) {
  const warnings: string[] = [];

  if (!input.stripeReady) {
    warnings.push("Stripe base configuration is incomplete.");
  }

  if (input.stripeSecretKeyMode === "MISSING") {
    warnings.push("STRIPE_SECRET_KEY is missing.");
  } else if (input.stripeSecretKeyMode === "TEST") {
    warnings.push("STRIPE_SECRET_KEY is in test mode. Use a live key for production.");
  } else if (input.stripeSecretKeyMode === "UNKNOWN") {
    warnings.push("STRIPE_SECRET_KEY format is not recognized.");
  }

  if (!input.stripeWebhookSecretConfigured) {
    warnings.push("STRIPE_WEBHOOK_SECRET is missing.");
  }

  if (!input.stripeConnection.reachable) {
    warnings.push(
      input.stripeConnection.errorMessage
        ? `Stripe API connectivity failed: ${input.stripeConnection.errorMessage}`
        : "Stripe API connectivity failed.",
    );
  } else {
    if (input.stripeConnection.livemode === false) {
      warnings.push("Stripe account is still in test mode (livemode=false).");
    }
    if (input.stripeConnection.chargesEnabled === false) {
      warnings.push("Stripe account charges are not enabled.");
    }
    if (input.stripeConnection.payoutsEnabled === false) {
      warnings.push("Stripe account payouts are not enabled.");
    }
  }

  if (!input.appUrlConfigured) {
    warnings.push("NEXT_PUBLIC_APP_URL is missing.");
  } else {
    if (!input.appUrlHttps) {
      warnings.push("NEXT_PUBLIC_APP_URL must use HTTPS.");
    }
    if (input.appUrlLocalhost) {
      warnings.push("NEXT_PUBLIC_APP_URL cannot point to localhost.");
    }
  }

  return warnings;
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
  const stripeConnection = await fetchStripeConnectionHealth();
  const settings = mapSettings(dashboard.settings.payment);
  const missingStripeRequirements = getMissingStripeRequirements(dashboard.paymentHealth);
  const missingBankTransferFields = getMissingBankTransferFields(settings);
  const stripeSecretKeyMode = detectStripeSecretKeyMode(process.env.STRIPE_SECRET_KEY);
  const appUrlHttps = isHttpsUrl(appUrl);
  const appUrlLocalhost = isLocalhostUrl(appUrl);
  const strictProduction = isStrictProductionRuntime();
  const stripeProductionWarnings = getStripeProductionWarnings({
    stripeReady: dashboard.paymentHealth.stripeReady,
    stripeSecretKeyMode,
    appUrlConfigured: dashboard.paymentHealth.appUrlConfigured,
    appUrlHttps,
    appUrlLocalhost,
    stripeWebhookSecretConfigured: dashboard.paymentHealth.stripeWebhookSecretConfigured,
    stripeConnection,
  });
  const stripeProductionReady = stripeProductionWarnings.length === 0;
  const selectedProviderReady =
    settings.cardPaymentProvider === "SANDBOX"
      ? dashboard.paymentHealth.sandboxReady
      : strictProduction
        ? dashboard.paymentHealth.stripeReady && stripeProductionReady
        : dashboard.paymentHealth.stripeReady;

  return {
    settings,
    health: {
      stripeSecretKeyConfigured: dashboard.paymentHealth.stripeSecretKeyConfigured,
      stripeWebhookSecretConfigured: dashboard.paymentHealth.stripeWebhookSecretConfigured,
      stripeSecretKeyMode,
      appUrlConfigured: dashboard.paymentHealth.appUrlConfigured,
      appUrlHttps,
      appUrlLocalhost,
      stripeReady: dashboard.paymentHealth.stripeReady,
      missingStripeRequirements,
      sandboxReady: dashboard.paymentHealth.sandboxReady,
      selectedProviderReady,
      strictProduction,
      stripeProductionReady,
      stripeProductionWarnings,
      bankTransferDetailsReady: missingBankTransferFields.length === 0,
      missingBankTransferFields,
      appUrl,
      stripeWebhookPath,
      stripeWebhookUrl,
      stripeConnection,
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
  const strictProduction = isStrictProductionRuntime();

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

  if (
    nextPaymentSettings.cardPaymentEnabled &&
    nextPaymentSettings.cardPaymentProvider === "STRIPE_CHECKOUT" &&
    strictProduction
  ) {
    const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
    const stripeSecretKeyMode = detectStripeSecretKeyMode(process.env.STRIPE_SECRET_KEY);
    const stripeConnection = await fetchStripeConnectionHealth({ forceRefresh: true });
    const stripeProductionWarnings = getStripeProductionWarnings({
      stripeReady: current.paymentHealth.stripeReady,
      stripeSecretKeyMode,
      appUrlConfigured: current.paymentHealth.appUrlConfigured,
      appUrlHttps: isHttpsUrl(appUrl),
      appUrlLocalhost: isLocalhostUrl(appUrl),
      stripeWebhookSecretConfigured: current.paymentHealth.stripeWebhookSecretConfigured,
      stripeConnection,
    });

    if (stripeProductionWarnings.length > 0) {
      throw new AppError(
        `Stripe production readiness check failed: ${stripeProductionWarnings.join(" ")}`,
        400,
        "STRIPE_PRODUCTION_READINESS_FAILED",
      );
    }
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
