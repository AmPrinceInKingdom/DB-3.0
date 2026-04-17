import { NotificationType, Prisma } from "@prisma/client";

const notificationSettingKeys = {
  autoStockAlertsEnabled: "notification_auto_stock_alerts_enabled",
  lowStockThreshold: "notification_low_stock_threshold",
  orderAlertsEnabled: "notification_order_alerts_enabled",
  paymentAlertsEnabled: "notification_payment_alerts_enabled",
  reviewAlertsEnabled: "notification_review_alerts_enabled",
  promotionAlertsEnabled: "notification_promotion_alerts_enabled",
  systemAlertsEnabled: "notification_system_alerts_enabled",
} as const;

export type NotificationSettingsState = {
  autoStockAlertsEnabled: boolean;
  lowStockThreshold: number;
  orderAlertsEnabled: boolean;
  paymentAlertsEnabled: boolean;
  reviewAlertsEnabled: boolean;
  promotionAlertsEnabled: boolean;
  systemAlertsEnabled: boolean;
};

const defaultNotificationSettings: NotificationSettingsState = {
  autoStockAlertsEnabled: true,
  lowStockThreshold: 5,
  orderAlertsEnabled: true,
  paymentAlertsEnabled: true,
  reviewAlertsEnabled: true,
  promotionAlertsEnabled: true,
  systemAlertsEnabled: true,
};

function parseBooleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function parseIntSetting(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.floor(parsed));
    }
  }
  return fallback;
}

export async function getNotificationSettings(
  tx: Pick<Prisma.TransactionClient, "siteSetting">,
): Promise<NotificationSettingsState> {
  const settings = await tx.siteSetting.findMany({
    where: {
      settingKey: {
        in: Object.values(notificationSettingKeys),
      },
    },
    select: {
      settingKey: true,
      settingValue: true,
    },
  });

  const map = new Map(settings.map((entry) => [entry.settingKey, entry.settingValue]));

  return {
    autoStockAlertsEnabled: parseBooleanSetting(
      map.get(notificationSettingKeys.autoStockAlertsEnabled),
      defaultNotificationSettings.autoStockAlertsEnabled,
    ),
    lowStockThreshold: parseIntSetting(
      map.get(notificationSettingKeys.lowStockThreshold),
      defaultNotificationSettings.lowStockThreshold,
    ),
    orderAlertsEnabled: parseBooleanSetting(
      map.get(notificationSettingKeys.orderAlertsEnabled),
      defaultNotificationSettings.orderAlertsEnabled,
    ),
    paymentAlertsEnabled: parseBooleanSetting(
      map.get(notificationSettingKeys.paymentAlertsEnabled),
      defaultNotificationSettings.paymentAlertsEnabled,
    ),
    reviewAlertsEnabled: parseBooleanSetting(
      map.get(notificationSettingKeys.reviewAlertsEnabled),
      defaultNotificationSettings.reviewAlertsEnabled,
    ),
    promotionAlertsEnabled: parseBooleanSetting(
      map.get(notificationSettingKeys.promotionAlertsEnabled),
      defaultNotificationSettings.promotionAlertsEnabled,
    ),
    systemAlertsEnabled: parseBooleanSetting(
      map.get(notificationSettingKeys.systemAlertsEnabled),
      defaultNotificationSettings.systemAlertsEnabled,
    ),
  };
}

export function isNotificationTypeEnabled(
  settings: NotificationSettingsState,
  type: NotificationType,
) {
  if (type === NotificationType.STOCK) return settings.autoStockAlertsEnabled;
  if (type === NotificationType.ORDER) return settings.orderAlertsEnabled;
  if (type === NotificationType.PAYMENT) return settings.paymentAlertsEnabled;
  if (type === NotificationType.REVIEW) return settings.reviewAlertsEnabled;
  if (type === NotificationType.PROMOTION) return settings.promotionAlertsEnabled;
  if (type === NotificationType.SYSTEM) return settings.systemAlertsEnabled;
  return true;
}
