"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CreditCard, Landmark, Mail, RefreshCcw, Save, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToastStore } from "@/store/toast-store";
import type {
  AccountCheckoutPaymentMethod,
  AccountCheckoutSettingsPayload,
  AccountNotificationPreferencesState,
  AccountNotificationSettingsPayload,
} from "@/types/settings";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type CheckoutOptionsPayload = {
  shippingMethods: Array<{
    code: string;
    name: string;
  }>;
  paymentMethods?: Array<{
    code: "CARD" | "BANK_TRANSFER" | "CASH_ON_DELIVERY";
    label: string;
    enabled: boolean;
    description: string;
    unavailableReason?: string | null;
  }>;
  cardPaymentProvider?: "SANDBOX" | "STRIPE_CHECKOUT";
  cardPaymentProviderReady?: boolean;
  cardPaymentProviderLabel?: string;
  cardPaymentProviderUnavailableReason?: string | null;
};

const fallbackShippingMethods = [
  { code: "STANDARD", name: "Standard Delivery" },
  { code: "EXPRESS", name: "Express Delivery" },
  { code: "PICKUP", name: "Store Pickup" },
];

type CheckoutPaymentAvailability = {
  cardEnabled: boolean;
  cardUnavailableReason: string | null;
  bankTransferEnabled: boolean;
  bankTransferUnavailableReason: string | null;
  cardPaymentProvider: "SANDBOX" | "STRIPE_CHECKOUT";
  cardPaymentProviderReady: boolean;
  cardPaymentProviderLabel: string;
  cardPaymentProviderUnavailableReason: string | null;
};

const defaultCheckoutPaymentAvailability: CheckoutPaymentAvailability = {
  cardEnabled: true,
  cardUnavailableReason: null,
  bankTransferEnabled: true,
  bankTransferUnavailableReason: null,
  cardPaymentProvider: "SANDBOX",
  cardPaymentProviderReady: true,
  cardPaymentProviderLabel: "Deal Bazaar Sandbox",
  cardPaymentProviderUnavailableReason: null,
};

function resolvePreferredPaymentMethod(
  preferredMethod: AccountCheckoutPaymentMethod,
  availability: Pick<CheckoutPaymentAvailability, "cardEnabled" | "bankTransferEnabled">,
): AccountCheckoutPaymentMethod {
  if (preferredMethod === "CARD" && availability.cardEnabled) {
    return "CARD";
  }

  if (preferredMethod === "BANK_TRANSFER" && availability.bankTransferEnabled) {
    return "BANK_TRANSFER";
  }

  if (availability.cardEnabled) {
    return "CARD";
  }

  if (availability.bankTransferEnabled) {
    return "BANK_TRANSFER";
  }

  return preferredMethod;
}

function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4"
      />
      {icon ? <span className="mt-0.5 text-muted-foreground">{icon}</span> : null}
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function AccountSettingsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [preferences, setPreferences] = useState<AccountNotificationPreferencesState | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredPaymentMethod, setPreferredPaymentMethod] =
    useState<AccountCheckoutPaymentMethod>("CARD");
  const [preferredShippingMethodCode, setPreferredShippingMethodCode] =
    useState<string>("STANDARD");
  const [availableShippingMethods, setAvailableShippingMethods] =
    useState<Array<{ code: string; name: string }>>(fallbackShippingMethods);
  const [checkoutUpdatedAt, setCheckoutUpdatedAt] = useState<string | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(true);
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPaymentAvailability, setCheckoutPaymentAvailability] =
    useState<CheckoutPaymentAvailability>(defaultCheckoutPaymentAvailability);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/account/settings/notifications", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<AccountNotificationSettingsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load settings");
      }
      setPreferences(payload.data.preferences);
      setUpdatedAt(payload.data.updatedAt);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load settings";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadCheckoutSettings = useCallback(async () => {
    setLoadingCheckout(true);
    setCheckoutError(null);
    try {
      const response = await fetch("/api/account/settings/checkout", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<AccountCheckoutSettingsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load checkout settings");
      }

      let shippingMethods = fallbackShippingMethods;
      let availability = defaultCheckoutPaymentAvailability;
      try {
        const optionsResponse = await fetch("/api/checkout/options", { cache: "no-store" });
        if (optionsResponse.ok) {
          const optionsPayload = (await optionsResponse.json()) as ApiEnvelope<CheckoutOptionsPayload>;
          if (optionsPayload.success && optionsPayload.data) {
            if (optionsPayload.data.shippingMethods?.length) {
              shippingMethods = optionsPayload.data.shippingMethods.map((method) => ({
                code: method.code,
                name: method.name,
              }));
            }

            const cardMethod = optionsPayload.data.paymentMethods?.find(
              (method) => method.code === "CARD",
            );
            const bankTransferMethod = optionsPayload.data.paymentMethods?.find(
              (method) => method.code === "BANK_TRANSFER",
            );

            availability = {
              cardEnabled: cardMethod?.enabled ?? defaultCheckoutPaymentAvailability.cardEnabled,
              cardUnavailableReason:
                cardMethod?.unavailableReason ??
                defaultCheckoutPaymentAvailability.cardUnavailableReason,
              bankTransferEnabled:
                bankTransferMethod?.enabled ?? defaultCheckoutPaymentAvailability.bankTransferEnabled,
              bankTransferUnavailableReason:
                bankTransferMethod?.unavailableReason ??
                defaultCheckoutPaymentAvailability.bankTransferUnavailableReason,
              cardPaymentProvider:
                optionsPayload.data.cardPaymentProvider ??
                defaultCheckoutPaymentAvailability.cardPaymentProvider,
              cardPaymentProviderReady:
                optionsPayload.data.cardPaymentProviderReady ??
                defaultCheckoutPaymentAvailability.cardPaymentProviderReady,
              cardPaymentProviderLabel:
                optionsPayload.data.cardPaymentProviderLabel ??
                defaultCheckoutPaymentAvailability.cardPaymentProviderLabel,
              cardPaymentProviderUnavailableReason:
                optionsPayload.data.cardPaymentProviderUnavailableReason ??
                defaultCheckoutPaymentAvailability.cardPaymentProviderUnavailableReason,
            };
          }
        }
      } catch {
        // Keep fallback shipping methods when checkout options are temporarily unavailable.
      }

      setAvailableShippingMethods(shippingMethods);
      setCheckoutPaymentAvailability(availability);
      setPreferredPaymentMethod(
        resolvePreferredPaymentMethod(payload.data.preferredPaymentMethod, availability),
      );
      const preferredShippingMethodCode = payload.data.preferredShippingMethodCode;
      const matchedShippingMethod = shippingMethods.find(
        (method) => method.code === preferredShippingMethodCode,
      );
      setPreferredShippingMethodCode(
        matchedShippingMethod?.code ?? shippingMethods[0]?.code ?? "STANDARD",
      );
      setCheckoutUpdatedAt(payload.data.updatedAt);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load checkout settings";
      setCheckoutError(message);
      pushToast(message, "error");
    } finally {
      setLoadingCheckout(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadCheckoutSettings();
  }, [loadCheckoutSettings]);

  const selectedPaymentMethodAvailable = useMemo(() => {
    if (preferredPaymentMethod === "CARD") {
      return checkoutPaymentAvailability.cardEnabled;
    }

    return checkoutPaymentAvailability.bankTransferEnabled;
  }, [preferredPaymentMethod, checkoutPaymentAvailability]);

  const updateChannels = useCallback(
    (patch: Partial<AccountNotificationPreferencesState["channels"]>) => {
      setPreferences((current) => {
        if (!current) return current;
        return {
          ...current,
          channels: {
            ...current.channels,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const updateCategories = useCallback(
    (patch: Partial<AccountNotificationPreferencesState["categories"]>) => {
      setPreferences((current) => {
        if (!current) return current;
        return {
          ...current,
          categories: {
            ...current.categories,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const saveSettings = useCallback(async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/account/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const payload = (await response.json()) as ApiEnvelope<AccountNotificationSettingsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to save settings");
      }
      setPreferences(payload.data.preferences);
      setUpdatedAt(payload.data.updatedAt);
      pushToast("Notification preferences updated", "success");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save settings";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  }, [preferences, pushToast]);

  const saveCheckoutSettings = useCallback(async () => {
    if (!selectedPaymentMethodAvailable) {
      const message = "Selected payment option is currently unavailable.";
      setCheckoutError(message);
      pushToast(message, "error");
      return;
    }

    setSavingCheckout(true);
    setCheckoutError(null);
    try {
      const response = await fetch("/api/account/settings/checkout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredPaymentMethod,
          preferredShippingMethodCode,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<AccountCheckoutSettingsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to save checkout settings");
      }
      setPreferredPaymentMethod(
        resolvePreferredPaymentMethod(payload.data.preferredPaymentMethod, checkoutPaymentAvailability),
      );
      setPreferredShippingMethodCode(payload.data.preferredShippingMethodCode);
      setCheckoutUpdatedAt(payload.data.updatedAt);
      pushToast("Checkout preferences updated", "success");
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save checkout settings";
      setCheckoutError(message);
      pushToast(message, "error");
    } finally {
      setSavingCheckout(false);
    }
  }, [
    preferredPaymentMethod,
    preferredShippingMethodCode,
    checkoutPaymentAvailability,
    selectedPaymentMethodAvailable,
    pushToast,
  ]);

  if (loading && !preferences) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading notification preferences...</p>
      </section>
    );
  }

  if (!preferences) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-red-600 dark:text-red-300">
          {error ?? "Unable to load account settings."}
        </p>
        <Button variant="outline" onClick={() => void loadSettings()}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage how Deal Bazaar contacts you and how checkout behaves by default.
          </p>
          {updatedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Notifications updated: {new Date(updatedAt).toLocaleString()}
            </p>
          ) : null}
          {checkoutUpdatedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Checkout settings updated: {new Date(checkoutUpdatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadSettings()} disabled={saving || loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh Notifications
          </Button>
          <Button onClick={() => void saveSettings()} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Notification Settings"}
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {checkoutError ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {checkoutError}
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Delivery Channels</h2>
          <SettingsToggle
            label="In-app notifications"
            description="Show alerts in your Deal Bazaar notification center and bell icon."
            checked={preferences.channels.push}
            onChange={(checked) => updateChannels({ push: checked })}
            icon={<Bell className="h-4 w-4" />}
          />
          <SettingsToggle
            label="Email notifications"
            description="Receive order and account updates by email."
            checked={preferences.channels.email}
            onChange={(checked) => updateChannels({ email: checked })}
            icon={<Mail className="h-4 w-4" />}
          />
          <SettingsToggle
            label="SMS notifications"
            description="Receive critical updates by SMS (where available)."
            checked={preferences.channels.sms}
            onChange={(checked) => updateChannels({ sms: checked })}
            icon={<Smartphone className="h-4 w-4" />}
          />
        </article>

        <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Alert Categories</h2>
          <SettingsToggle
            label="Order updates"
            description="Status changes, shipping updates, and delivery events."
            checked={preferences.categories.order}
            onChange={(checked) => updateCategories({ order: checked })}
          />
          <SettingsToggle
            label="Payment updates"
            description="Payment confirmations, failures, and verification outcomes."
            checked={preferences.categories.payment}
            onChange={(checked) => updateCategories({ payment: checked })}
          />
          <SettingsToggle
            label="Review updates"
            description="Moderation updates about your submitted reviews."
            checked={preferences.categories.review}
            onChange={(checked) => updateCategories({ review: checked })}
          />
          <SettingsToggle
            label="Promotions"
            description="Deals, coupons, and promotional campaigns."
            checked={preferences.categories.promotion}
            onChange={(checked) => updateCategories({ promotion: checked })}
          />
          <SettingsToggle
            label="System updates"
            description="Important platform and account notices."
            checked={preferences.categories.system}
            onChange={(checked) => updateCategories({ system: checked })}
          />
          <SettingsToggle
            label="Stock alerts"
            description="Back-in-stock and inventory-related notices."
            checked={preferences.categories.stock}
            onChange={(checked) => updateCategories({ stock: checked })}
          />
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Checkout Preferences</h2>
            <p className="text-xs text-muted-foreground">
              Choose the payment method that should be preselected at checkout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCheckoutSettings()}
              disabled={loadingCheckout || savingCheckout}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => void saveCheckoutSettings()}
              disabled={loadingCheckout || savingCheckout || !selectedPaymentMethodAvailable}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingCheckout ? "Saving..." : "Save Checkout Preference"}
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-border bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Card Gateway
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  checkoutPaymentAvailability.cardPaymentProviderReady
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}
              >
                {checkoutPaymentAvailability.cardPaymentProviderReady ? "Ready" : "Needs setup"}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">
              {checkoutPaymentAvailability.cardPaymentProviderLabel}
            </p>
            {!checkoutPaymentAvailability.cardPaymentProviderReady ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {checkoutPaymentAvailability.cardPaymentProviderUnavailableReason ??
                  checkoutPaymentAvailability.cardUnavailableReason ??
                  "Card gateway is unavailable until configuration is completed."}
              </p>
            ) : null}
          </article>

          <article className="rounded-xl border border-border bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bank Transfer
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  checkoutPaymentAvailability.bankTransferEnabled
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}
              >
                {checkoutPaymentAvailability.bankTransferEnabled ? "Enabled" : "Needs setup"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload-proof bank transfer flow for manual verifications.
            </p>
            {!checkoutPaymentAvailability.bankTransferEnabled ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {checkoutPaymentAvailability.bankTransferUnavailableReason ??
                  "Bank transfer details are incomplete."}
              </p>
            ) : null}
          </article>
        </div>

        {loadingCheckout ? (
          <p className="text-xs text-muted-foreground">Loading checkout preferences...</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2 ${
                checkoutPaymentAvailability.cardEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              }`}
            >
              <input
                type="radio"
                name="preferred-payment-method"
                value="CARD"
                checked={preferredPaymentMethod === "CARD"}
                onChange={() => setPreferredPaymentMethod("CARD")}
                className="mt-1"
                disabled={!checkoutPaymentAvailability.cardEnabled}
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Card Payment
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Best for instant confirmation and quick checkout.
                </span>
                {!checkoutPaymentAvailability.cardEnabled ? (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                    {checkoutPaymentAvailability.cardUnavailableReason ??
                      "Card payment is temporarily unavailable."}
                  </span>
                ) : null}
              </span>
            </label>
            <label
              className={`flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2 ${
                checkoutPaymentAvailability.bankTransferEnabled
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-60"
              }`}
            >
              <input
                type="radio"
                name="preferred-payment-method"
                value="BANK_TRANSFER"
                checked={preferredPaymentMethod === "BANK_TRANSFER"}
                onChange={() => setPreferredPaymentMethod("BANK_TRANSFER")}
                className="mt-1"
                disabled={!checkoutPaymentAvailability.bankTransferEnabled}
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  Bank Transfer
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Useful when you prefer manual transfer with proof upload.
                </span>
                {!checkoutPaymentAvailability.bankTransferEnabled ? (
                  <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                    {checkoutPaymentAvailability.bankTransferUnavailableReason ??
                      "Bank transfer is temporarily unavailable."}
                  </span>
                ) : null}
              </span>
            </label>

            <div className="space-y-1 rounded-xl border border-border bg-background px-3 py-2 sm:col-span-2">
              <label className="text-sm font-medium">Default Shipping Method</label>
              <Select
                value={preferredShippingMethodCode}
                onChange={(event) => setPreferredShippingMethodCode(event.target.value)}
              >
                {availableShippingMethods.map((method) => (
                  <option key={method.code} value={method.code}>
                    {method.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                This shipping method will be preselected at checkout whenever available.
              </p>
            </div>

            {!selectedPaymentMethodAvailable ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300 sm:col-span-2">
                Selected payment option is currently unavailable. Choose an enabled option before
                saving.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Tip: If <strong>In-app notifications</strong> is turned off, the notification bell and
          notifications page will stop receiving new alerts until re-enabled.
        </p>
      </section>
    </div>
  );
}
