import { db } from "@/lib/db";
import {
  normalizeCheckoutPreferences,
  normalizeNotificationPreferences,
  toNotificationPreferencesJson,
} from "@/lib/services/user-notification-preferences-service";
import type {
  AccountCheckoutSettingsPayload,
  AccountNotificationPreferencesState,
  AccountNotificationSettingsPayload,
} from "@/types/settings";

export async function getAccountNotificationSettings(
  userId: string,
): Promise<AccountNotificationSettingsPayload> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: {
      notificationPreferences: true,
      updatedAt: true,
    },
  });

  return {
    preferences: normalizeNotificationPreferences(profile?.notificationPreferences),
    updatedAt: profile?.updatedAt ? profile.updatedAt.toISOString() : null,
  };
}

export async function updateAccountNotificationSettings(
  userId: string,
  preferences: AccountNotificationPreferencesState,
): Promise<AccountNotificationSettingsPayload> {
  const existing = await db.userProfile.findUnique({
    where: { userId },
    select: {
      notificationPreferences: true,
    },
  });
  const checkoutPreferences = normalizeCheckoutPreferences(existing?.notificationPreferences);

  const updated = await db.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      notificationPreferences: toNotificationPreferencesJson(preferences, checkoutPreferences),
    },
    update: {
      notificationPreferences: toNotificationPreferencesJson(preferences, checkoutPreferences),
    },
    select: {
      notificationPreferences: true,
      updatedAt: true,
    },
  });

  return {
    preferences: normalizeNotificationPreferences(updated.notificationPreferences),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function getAccountCheckoutSettings(
  userId: string,
): Promise<AccountCheckoutSettingsPayload> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: {
      notificationPreferences: true,
      updatedAt: true,
    },
  });

  return {
    ...normalizeCheckoutPreferences(profile?.notificationPreferences),
    updatedAt: profile?.updatedAt ? profile.updatedAt.toISOString() : null,
  };
}

export async function updateAccountCheckoutSettings(
  userId: string,
  checkoutSettings: Pick<
    AccountCheckoutSettingsPayload,
    "preferredPaymentMethod" | "preferredShippingMethodCode"
  >,
): Promise<AccountCheckoutSettingsPayload> {
  const existing = await db.userProfile.findUnique({
    where: { userId },
    select: {
      notificationPreferences: true,
    },
  });

  const existingNotifications = normalizeNotificationPreferences(
    existing?.notificationPreferences,
  );

  const updated = await db.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      notificationPreferences: toNotificationPreferencesJson(
        existingNotifications,
        checkoutSettings,
      ),
    },
    update: {
      notificationPreferences: toNotificationPreferencesJson(
        existingNotifications,
        checkoutSettings,
      ),
    },
    select: {
      notificationPreferences: true,
      updatedAt: true,
    },
  });

  return {
    ...normalizeCheckoutPreferences(updated.notificationPreferences),
    updatedAt: updated.updatedAt.toISOString(),
  };
}
