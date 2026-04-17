import { NotificationType, Prisma } from "@prisma/client";
import type {
  AccountCheckoutPaymentMethod,
  AccountNotificationPreferencesState,
} from "@/types/settings";

const defaultNotificationPreferences: AccountNotificationPreferencesState = {
  channels: {
    push: true,
    email: true,
    sms: false,
  },
  categories: {
    order: true,
    payment: true,
    review: true,
    promotion: true,
    system: true,
    stock: true,
  },
};

const defaultPreferredPaymentMethod: AccountCheckoutPaymentMethod = "CARD";
const defaultPreferredShippingMethodCode = "STANDARD";

type AccountCheckoutPreferencesState = {
  preferredPaymentMethod: AccountCheckoutPaymentMethod;
  preferredShippingMethodCode: string;
};

const notificationTypeToCategoryKey: Record<
  NotificationType,
  keyof AccountNotificationPreferencesState["categories"]
> = {
  ORDER: "order",
  PAYMENT: "payment",
  REVIEW: "review",
  PROMOTION: "promotion",
  SYSTEM: "system",
  STOCK: "stock",
};

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

export function buildDefaultNotificationPreferences(): AccountNotificationPreferencesState {
  return {
    channels: { ...defaultNotificationPreferences.channels },
    categories: { ...defaultNotificationPreferences.categories },
  };
}

export function normalizeNotificationPreferences(
  raw: unknown,
): AccountNotificationPreferencesState {
  const defaults = buildDefaultNotificationPreferences();
  const root = toRecord(raw);
  if (!root) return defaults;

  const channelsRecord = toRecord(root.channels);
  const categoriesRecord = toRecord(root.categories);

  // Legacy payload compatibility:
  // Earlier versions stored channel booleans at root level.
  const legacyChannels = {
    push: root.push,
    email: root.email,
    sms: root.sms,
  };

  return {
    channels: {
      push: parseBoolean(
        channelsRecord?.push ?? legacyChannels.push,
        defaults.channels.push,
      ),
      email: parseBoolean(
        channelsRecord?.email ?? legacyChannels.email,
        defaults.channels.email,
      ),
      sms: parseBoolean(
        channelsRecord?.sms ?? legacyChannels.sms,
        defaults.channels.sms,
      ),
    },
    categories: {
      order: parseBoolean(categoriesRecord?.order, defaults.categories.order),
      payment: parseBoolean(categoriesRecord?.payment, defaults.categories.payment),
      review: parseBoolean(categoriesRecord?.review, defaults.categories.review),
      promotion: parseBoolean(categoriesRecord?.promotion, defaults.categories.promotion),
      system: parseBoolean(categoriesRecord?.system, defaults.categories.system),
      stock: parseBoolean(categoriesRecord?.stock, defaults.categories.stock),
    },
  };
}

export function normalizePreferredPaymentMethod(raw: unknown): AccountCheckoutPaymentMethod {
  return normalizeCheckoutPreferences(raw).preferredPaymentMethod;
}

export function normalizePreferredShippingMethodCode(raw: unknown): string {
  return normalizeCheckoutPreferences(raw).preferredShippingMethodCode;
}

export function buildDefaultCheckoutPreferences(): AccountCheckoutPreferencesState {
  return {
    preferredPaymentMethod: defaultPreferredPaymentMethod,
    preferredShippingMethodCode: defaultPreferredShippingMethodCode,
  };
}

export function normalizeCheckoutPreferences(
  raw: unknown,
): AccountCheckoutPreferencesState {
  const defaults = buildDefaultCheckoutPreferences();
  const root = toRecord(raw);
  if (!root) return defaults;

  const checkoutRecord = toRecord(root.checkout);
  const paymentValue = checkoutRecord?.preferredPaymentMethod ?? root.preferredPaymentMethod;
  const shippingValue =
    checkoutRecord?.preferredShippingMethodCode ?? root.preferredShippingMethodCode;

  const preferredPaymentMethod =
    paymentValue === "CARD" || paymentValue === "BANK_TRANSFER"
      ? paymentValue
      : defaults.preferredPaymentMethod;

  const preferredShippingMethodCode =
    typeof shippingValue === "string" && shippingValue.trim().length > 0
      ? shippingValue.trim().toUpperCase()
      : defaults.preferredShippingMethodCode;

  return {
    preferredPaymentMethod,
    preferredShippingMethodCode,
  };
}

export function toNotificationPreferencesJson(
  state: AccountNotificationPreferencesState,
  checkoutPreferences: AccountCheckoutPreferencesState = buildDefaultCheckoutPreferences(),
): Prisma.InputJsonValue {
  return {
    version: 3,
    channels: {
      push: Boolean(state.channels.push),
      email: Boolean(state.channels.email),
      sms: Boolean(state.channels.sms),
    },
    categories: {
      order: Boolean(state.categories.order),
      payment: Boolean(state.categories.payment),
      review: Boolean(state.categories.review),
      promotion: Boolean(state.categories.promotion),
      system: Boolean(state.categories.system),
      stock: Boolean(state.categories.stock),
    },
    checkout: {
      preferredPaymentMethod: checkoutPreferences.preferredPaymentMethod,
      preferredShippingMethodCode: checkoutPreferences.preferredShippingMethodCode,
    },
  } satisfies Prisma.InputJsonValue;
}

export function isInAppNotificationEnabled(
  raw: unknown,
  type: NotificationType,
) {
  const normalized = normalizeNotificationPreferences(raw);
  const categoryKey = notificationTypeToCategoryKey[type];
  return normalized.channels.push && normalized.categories[categoryKey];
}

export async function canSendInAppNotification(
  tx: Pick<Prisma.TransactionClient, "userProfile">,
  userId: string,
  type: NotificationType,
) {
  const profile = await tx.userProfile.findUnique({
    where: { userId },
    select: { notificationPreferences: true },
  });

  return isInAppNotificationEnabled(profile?.notificationPreferences, type);
}
