"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToastStore } from "@/store/toast-store";
import type { AdminPaymentGatewayPayload, AdminPaymentGatewaySettings } from "@/types/admin-payment-gateway";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

function normalizeOptionalText(value: string) {
  return value.trim();
}

function GatewayToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function PaymentGatewayManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [settings, setSettings] = useState<AdminPaymentGatewaySettings | null>(null);
  const [health, setHealth] = useState<AdminPaymentGatewayPayload["health"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPanel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/payment-gateway", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<AdminPaymentGatewayPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load payment gateway settings");
      }

      setSettings(payload.data.settings);
      setHealth(payload.data.health);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load payment gateway settings";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const updateSettings = useCallback((patch: Partial<AdminPaymentGatewaySettings>) => {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        ...patch,
      };
    });
  }, []);

  const saveSettings = useCallback(async () => {
    if (!settings) return;

    setSaving(true);
    setError(null);
    try {
      const normalized: AdminPaymentGatewaySettings = {
        ...settings,
        bankTransferAccountName: normalizeOptionalText(settings.bankTransferAccountName),
        bankTransferBankName: normalizeOptionalText(settings.bankTransferBankName),
        bankTransferAccountNumber: normalizeOptionalText(settings.bankTransferAccountNumber),
        bankTransferBranch: normalizeOptionalText(settings.bankTransferBranch),
        bankTransferSwift: normalizeOptionalText(settings.bankTransferSwift),
        bankTransferNote: normalizeOptionalText(settings.bankTransferNote),
      };

      const response = await fetch("/api/admin/payment-gateway", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const payload = (await response.json()) as ApiEnvelope<AdminPaymentGatewayPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to save payment gateway settings");
      }

      setSettings(payload.data.settings);
      setHealth(payload.data.health);
      pushToast("Payment gateway settings updated", "success");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save payment gateway settings";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  }, [pushToast, settings]);

  const copyWebhookUrl = useCallback(async () => {
    const url = health?.stripeWebhookUrl;
    if (!url) {
      pushToast("NEXT_PUBLIC_APP_URL not configured yet.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      pushToast("Webhook URL copied", "success");
    } catch {
      pushToast("Unable to copy webhook URL", "error");
    }
  }, [health?.stripeWebhookUrl, pushToast]);

  const selectedProviderReady = useMemo(() => {
    if (!health || !settings) return true;
    return settings.cardPaymentProvider === "SANDBOX"
      ? health.sandboxReady
      : health.stripeReady;
  }, [health, settings]);

  const stripeHasBlockingIssue =
    settings?.cardPaymentProvider === "STRIPE_CHECKOUT" && !(health?.stripeReady ?? true);
  const bankTransferHasBlockingIssue = Boolean(
    settings?.bankTransferEnabled && !(health?.bankTransferDetailsReady ?? true),
  );

  if (loading && !settings) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading payment gateway panel...</p>
      </section>
    );
  }

  if (!settings || !health) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-red-600 dark:text-red-300">
          {error ?? "Unable to load payment gateway settings."}
        </p>
        <Button variant="outline" onClick={() => void loadPanel()}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Configure card gateway provider and bank transfer details from one place.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadPanel()} disabled={saving || loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void saveSettings()} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Gateway"}
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section
        className={
          selectedProviderReady
            ? "rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4"
            : "rounded-2xl border border-red-400/40 bg-red-500/10 p-4"
        }
      >
        <p
          className={
            selectedProviderReady
              ? "text-sm font-semibold text-emerald-700 dark:text-emerald-300"
              : "text-sm font-semibold text-red-700 dark:text-red-300"
          }
        >
          {selectedProviderReady
            ? "Selected payment provider is ready."
            : settings.cardPaymentProvider === "STRIPE_CHECKOUT"
              ? "Stripe setup is incomplete."
              : "Sandbox provider unavailable."}
        </p>
        <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
          <span>STRIPE_SECRET_KEY: {health.stripeSecretKeyConfigured ? "OK" : "Missing"}</span>
          <span>STRIPE_WEBHOOK_SECRET: {health.stripeWebhookSecretConfigured ? "OK" : "Missing"}</span>
          <span>NEXT_PUBLIC_APP_URL: {health.appUrlConfigured ? "OK" : "Missing"}</span>
        </div>
        {health.missingStripeRequirements.length > 0 ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-300">
            Missing Stripe config: {health.missingStripeRequirements.join(", ")}
          </p>
        ) : null}
      </section>

      {bankTransferHasBlockingIssue ? (
        <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Bank transfer is enabled, but checkout details are incomplete.
          </p>
          <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-300/90">
            Missing fields: {health.missingBankTransferFields.join(", ")}
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <header>
            <h2 className="text-base font-semibold">Card Gateway</h2>
            <p className="text-xs text-muted-foreground">
              Pick provider mode and control available payment methods.
            </p>
          </header>

          <div className="space-y-1">
            <label className="text-xs font-medium">Card Payment Provider</label>
            <Select
              value={settings.cardPaymentProvider}
              onChange={(event) =>
                updateSettings({
                  cardPaymentProvider: event.target.value as AdminPaymentGatewaySettings["cardPaymentProvider"],
                })
              }
            >
              <option value="SANDBOX">Sandbox (Internal test flow)</option>
              <option value="STRIPE_CHECKOUT">Stripe Checkout (Hosted)</option>
            </Select>
          </div>

          <div className="space-y-2">
            <GatewayToggle
              label="Enable Card Payment"
              checked={settings.cardPaymentEnabled}
              onChange={(checked) => updateSettings({ cardPaymentEnabled: checked })}
            />
            {stripeHasBlockingIssue && settings.cardPaymentEnabled ? (
              <p className="text-xs text-red-600 dark:text-red-300">
                Stripe Checkout cannot be saved while required env values are missing.
              </p>
            ) : null}
            <GatewayToggle
              label="Enable Bank Transfer"
              checked={settings.bankTransferEnabled}
              onChange={(checked) => updateSettings({ bankTransferEnabled: checked })}
            />
            {bankTransferHasBlockingIssue ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Complete bank fields before saving while bank transfer is enabled.
              </p>
            ) : null}
            <GatewayToggle
              label="Enable Cash On Delivery (Coming Soon)"
              checked={settings.cashOnDeliveryEnabled}
              description="Leave disabled for now unless COD rollout is complete."
              onChange={(checked) => updateSettings({ cashOnDeliveryEnabled: checked })}
            />
          </div>
        </article>

        <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <header>
            <h2 className="text-base font-semibold">Stripe Webhook Setup</h2>
            <p className="text-xs text-muted-foreground">
              Configure this URL inside Stripe dashboard to receive payment confirmations.
            </p>
          </header>

          <div className="space-y-1">
            <label className="text-xs font-medium">App Base URL</label>
            <Input value={health.appUrl ?? "Not configured"} readOnly />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Webhook Path</label>
            <Input value={health.stripeWebhookPath} readOnly />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Webhook URL</label>
            <div className="flex gap-2">
              <Input value={health.stripeWebhookUrl ?? "Set NEXT_PUBLIC_APP_URL to generate"} readOnly />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void copyWebhookUrl()}
                disabled={!health.stripeWebhookUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
            <p>1. In Stripe dashboard, add the webhook URL above.</p>
            <p>2. Subscribe at minimum to `checkout.session.completed` and failed events.</p>
            <p>3. Paste webhook signing secret into `STRIPE_WEBHOOK_SECRET` and restart server.</p>
          </div>
        </article>

        <article className="space-y-3 rounded-2xl border border-border bg-card p-4 xl:col-span-2">
          <header>
            <h2 className="text-base font-semibold">Bank Transfer Details</h2>
            <p className="text-xs text-muted-foreground">
              Customers will see these details during checkout when bank transfer is selected.
            </p>
          </header>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Account Name</label>
              <Input
                value={settings.bankTransferAccountName}
                onChange={(event) => updateSettings({ bankTransferAccountName: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Bank Name</label>
              <Input
                value={settings.bankTransferBankName}
                onChange={(event) => updateSettings({ bankTransferBankName: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Account Number</label>
              <Input
                value={settings.bankTransferAccountNumber}
                onChange={(event) => updateSettings({ bankTransferAccountNumber: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Branch</label>
              <Input
                value={settings.bankTransferBranch}
                onChange={(event) => updateSettings({ bankTransferBranch: event.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium">SWIFT Code</label>
              <Input
                value={settings.bankTransferSwift}
                onChange={(event) => updateSettings({ bankTransferSwift: event.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium">Checkout Note</label>
              <textarea
                className="focus-ring min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
                value={settings.bankTransferNote}
                onChange={(event) => updateSettings({ bankTransferNote: event.target.value })}
                placeholder="Instructions to customer after transfer"
              />
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
