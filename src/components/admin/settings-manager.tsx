"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, Save, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToastStore } from "@/store/toast-store";
import type { AdminSettingsPayload, AdminSettingsState } from "@/types/settings";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const languageLabels: Record<string, string> = {
  en: "English",
  si: "Sinhala",
  ta: "Tamil",
};

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function normalizePreviewLogoUrl(value: string) {
  const logo = value.trim();
  if (!logo) return "";
  if (logo.startsWith("/") || logo.startsWith("http://") || logo.startsWith("https://")) {
    return logo;
  }
  return "";
}

function toUnique(values: string[], transform: (value: string) => string) {
  return Array.from(new Set(values.map((item) => transform(item.trim())).filter(Boolean)));
}

function SettingsToggle({
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

export function SettingsManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [settings, setSettings] = useState<AdminSettingsState | null>(null);
  const [options, setOptions] = useState<AdminSettingsPayload["options"] | null>(null);
  const [paymentHealth, setPaymentHealth] = useState<AdminSettingsPayload["paymentHealth"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadFile, setLogoUploadFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<AdminSettingsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to load settings");
      }
      setSettings(payload.data.settings);
      setOptions(payload.data.options);
      setPaymentHealth(payload.data.paymentHealth);
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

  const updateGroup = useCallback(
    <K extends keyof AdminSettingsState>(group: K, patch: Partial<AdminSettingsState[K]>) => {
      setSettings((current) => {
        if (!current) return current;
        return {
          ...current,
          [group]: {
            ...current[group],
            ...patch,
          } as AdminSettingsState[K],
        };
      });
    },
    [],
  );

  const toggleCurrency = useCallback((code: string) => {
    setSettings((current) => {
      if (!current) return current;
      const normalized = code.toUpperCase();
      const defaultCurrency = current.localization.defaultCurrency.toUpperCase();
      const set = new Set(current.localization.enabledCurrencies.map((item) => item.toUpperCase()));

      if (set.has(normalized)) {
        if (normalized !== defaultCurrency && set.size > 1) {
          set.delete(normalized);
        }
      } else {
        set.add(normalized);
      }

      set.add(defaultCurrency);

      return {
        ...current,
        localization: {
          ...current.localization,
          enabledCurrencies: Array.from(set),
        },
      };
    });
  }, []);

  const toggleLanguage = useCallback((language: string) => {
    setSettings((current) => {
      if (!current) return current;
      const normalized = language.toLowerCase();
      const defaultLanguage = current.localization.defaultLanguage.toLowerCase();
      const set = new Set(current.localization.enabledLanguages.map((item) => item.toLowerCase()));

      if (set.has(normalized)) {
        if (normalized !== defaultLanguage && set.size > 1) {
          set.delete(normalized);
        }
      } else {
        set.add(normalized);
      }

      set.add(defaultLanguage);

      return {
        ...current,
        localization: {
          ...current.localization,
          enabledLanguages: Array.from(set),
        },
      };
    });
  }, []);

  const saveSettings = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json()) as ApiEnvelope<AdminSettingsPayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to save settings");
      }
      setSettings(payload.data.settings);
      setOptions(payload.data.options);
      setPaymentHealth(payload.data.paymentHealth);
      pushToast("Settings updated successfully", "success");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save settings";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  }, [pushToast, settings]);

  const uploadLogo = useCallback(async () => {
    if (!logoUploadFile) return;

    setUploadingLogo(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("logoFile", logoUploadFile);

      const response = await fetch("/api/admin/settings/logo-upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as ApiEnvelope<{ url: string }>;
      if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(payload.error ?? "Unable to upload logo");
      }

      updateGroup("general", { logoUrl: payload.data.url });
      setLogoUploadFile(null);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
      pushToast("Logo uploaded successfully", "success");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Unable to upload logo";
      setError(message);
      pushToast(message, "error");
    } finally {
      setUploadingLogo(false);
    }
  }, [logoUploadFile, pushToast, updateGroup]);

  const availableCurrencies = useMemo(() => {
    if (options?.availableCurrencies?.length) return options.availableCurrencies;
    return settings?.localization.enabledCurrencies ?? [];
  }, [options?.availableCurrencies, settings?.localization.enabledCurrencies]);

  const availableLanguages = useMemo(() => {
    if (options?.availableLanguages?.length) return options.availableLanguages;
    return settings?.localization.enabledLanguages ?? [];
  }, [options?.availableLanguages, settings?.localization.enabledLanguages]);

  const logoPreviewUrl = useMemo(
    () => normalizePreviewLogoUrl(settings?.general.logoUrl ?? ""),
    [settings?.general.logoUrl],
  );

  const selectedProviderReady = useMemo(() => {
    if (!settings) return true;
    if (settings.payment.cardPaymentProvider === "SANDBOX") {
      return paymentHealth?.sandboxReady ?? true;
    }
    return paymentHealth?.stripeReady ?? false;
  }, [paymentHealth?.sandboxReady, paymentHealth?.stripeReady, settings]);

  if (loading && !settings) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-red-600 dark:text-red-300">
          {error ?? "Unable to load settings data."}
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
        <p className="text-sm text-muted-foreground">
          Update global website behavior, payments, currencies, and homepage visibility from one panel.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void loadSettings()}
            disabled={saving || loading || uploadingLogo}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void saveSettings()} disabled={saving || loading || uploadingLogo}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="text-sm font-semibold">General</CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Site Name</label>
              <Input
                value={settings.general.siteName}
                onChange={(event) => updateGroup("general", { siteName: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Site Tagline</label>
              <Input
                value={settings.general.siteTagline}
                onChange={(event) => updateGroup("general", { siteTagline: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Logo URL</label>
              <Input
                type="text"
                placeholder="https://... or /uploads/logos/..."
                value={settings.general.logoUrl}
                onChange={(event) => updateGroup("general", { logoUrl: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Upload Logo Image</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setLogoUploadFile(nextFile);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => void uploadLogo()}
                  disabled={!logoUploadFile || uploadingLogo || saving || loading}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {uploadingLogo ? "Uploading..." : "Upload"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {logoUploadFile
                  ? `Selected: ${logoUploadFile.name} (${formatFileSize(logoUploadFile.size)})`
                  : "Supported formats: PNG, JPG, WEBP, SVG. Max size 3MB."}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Logo Preview</p>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
                {logoPreviewUrl ? (
                  <span
                    className="inline-flex h-10 w-10 rounded-lg border border-border bg-muted bg-cover bg-center"
                    style={{ backgroundImage: `url("${logoPreviewUrl}")` }}
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                    {settings.general.siteName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("") || "DB"}
                  </span>
                )}
                <p className="text-xs text-muted-foreground">
                  {logoPreviewUrl
                    ? "Live brand icon preview for header and public pages."
                    : "Add a valid image URL (https://...) to preview custom logo."}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Theme Mode</label>
              <Select
                value={settings.general.themeMode}
                onChange={(event) =>
                  updateGroup("general", {
                    themeMode: event.target.value as AdminSettingsState["general"]["themeMode"],
                  })
                }
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Contact</CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Support Email</label>
              <Input
                type="email"
                value={settings.contact.supportEmail}
                onChange={(event) => updateGroup("contact", { supportEmail: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Support Phone</label>
              <Input
                value={settings.contact.supportPhone}
                onChange={(event) => updateGroup("contact", { supportPhone: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">WhatsApp Number</label>
              <Input
                value={settings.contact.whatsappNumber}
                onChange={(event) => updateGroup("contact", { whatsappNumber: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Business Address</label>
              <textarea
                className="focus-ring min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
                value={settings.contact.businessAddress}
                onChange={(event) => updateGroup("contact", { businessAddress: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Localization</CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Default Language</label>
              <Select
                value={settings.localization.defaultLanguage}
                onChange={(event) => {
                  const nextDefault = event.target.value.toLowerCase();
                  const merged = toUnique(
                    [...settings.localization.enabledLanguages, nextDefault],
                    (item) => item.toLowerCase(),
                  );
                  updateGroup("localization", {
                    defaultLanguage: nextDefault,
                    enabledLanguages: merged,
                  });
                }}
              >
                {availableLanguages.map((language) => {
                  const normalized = language.toLowerCase();
                  return (
                    <option key={normalized} value={normalized}>
                      {languageLabels[normalized] ?? normalized.toUpperCase()}
                    </option>
                  );
                })}
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium">Enabled Languages</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableLanguages.map((language) => {
                  const normalized = language.toLowerCase();
                  const checked = settings.localization.enabledLanguages
                    .map((item) => item.toLowerCase())
                    .includes(normalized);
                  return (
                    <label
                      key={normalized}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLanguage(normalized)}
                      />
                      {languageLabels[normalized] ?? normalized.toUpperCase()}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Default Currency</label>
              <Select
                value={settings.localization.defaultCurrency}
                onChange={(event) => {
                  const nextDefault = event.target.value.toUpperCase();
                  const merged = toUnique(
                    [...settings.localization.enabledCurrencies, nextDefault],
                    (item) => item.toUpperCase(),
                  );
                  updateGroup("localization", {
                    defaultCurrency: nextDefault,
                    enabledCurrencies: merged,
                  });
                }}
              >
                {availableCurrencies.map((currency) => {
                  const normalized = currency.toUpperCase();
                  return (
                    <option key={normalized} value={normalized}>
                      {normalized}
                    </option>
                  );
                })}
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium">Enabled Currencies</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {availableCurrencies.map((currency) => {
                  const normalized = currency.toUpperCase();
                  const checked = settings.localization.enabledCurrencies
                    .map((item) => item.toUpperCase())
                    .includes(normalized);
                  return (
                    <label
                      key={normalized}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCurrency(normalized)}
                      />
                      {normalized}
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Checkout & Shipping</CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Tax Rate (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={settings.checkout.taxRatePercentage}
                  onChange={(event) =>
                    updateGroup("checkout", {
                      taxRatePercentage: parseNumber(event.target.value, 0),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Standard Delivery Fee</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.shipping.standardDeliveryFee}
                  onChange={(event) =>
                    updateGroup("shipping", {
                      standardDeliveryFee: parseNumber(event.target.value, 0),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Express Delivery Fee</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.shipping.expressDeliveryFee}
                  onChange={(event) =>
                    updateGroup("shipping", {
                      expressDeliveryFee: parseNumber(event.target.value, 0),
                    })
                  }
                />
              </div>
            </div>

            <SettingsToggle
              label="Allow Guest Checkout"
              description="Customers can place orders without creating an account."
              checked={settings.checkout.allowGuestCheckout}
              onChange={(checked) => updateGroup("checkout", { allowGuestCheckout: checked })}
            />
            <SettingsToggle
              label="Enable Store Pickup"
              description="Show pickup shipping option in checkout."
              checked={settings.shipping.pickupEnabled}
              onChange={(checked) => updateGroup("shipping", { pickupEnabled: checked })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Payment Settings</CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Card Payment Provider</label>
              <Select
                value={settings.payment.cardPaymentProvider}
                onChange={(event) =>
                  updateGroup("payment", {
                    cardPaymentProvider: event.target.value as AdminSettingsState["payment"]["cardPaymentProvider"],
                  })
                }
              >
                <option value="SANDBOX">Sandbox (Internal test page)</option>
                <option value="STRIPE_CHECKOUT">Stripe Checkout (Hosted)</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sandbox is recommended for local testing. Use Stripe Checkout in production with Stripe keys and webhook configured.
              </p>
            </div>

            <div
              className={
                selectedProviderReady
                  ? "rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3"
                  : "rounded-xl border border-red-400/30 bg-red-500/10 p-3"
              }
            >
              <p
                className={
                  selectedProviderReady
                    ? "text-sm font-medium text-emerald-700 dark:text-emerald-300"
                    : "text-sm font-medium text-red-700 dark:text-red-300"
                }
              >
                {settings.payment.cardPaymentProvider === "SANDBOX"
                  ? "Sandbox provider is ready."
                  : selectedProviderReady
                    ? "Stripe provider is ready."
                    : "Stripe provider is not fully configured."}
              </p>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                <span>
                  STRIPE_SECRET_KEY: {paymentHealth?.stripeSecretKeyConfigured ? "OK" : "Missing"}
                </span>
                <span>
                  STRIPE_WEBHOOK_SECRET:{" "}
                  {paymentHealth?.stripeWebhookSecretConfigured ? "OK" : "Missing"}
                </span>
                <span>
                  NEXT_PUBLIC_APP_URL: {paymentHealth?.appUrlConfigured ? "OK" : "Missing"}
                </span>
              </div>
              {settings.payment.cardPaymentProvider === "STRIPE_CHECKOUT" && !selectedProviderReady ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-300">
                  Configure the missing environment values and restart the server before using live Stripe checkout.
                </p>
              ) : null}
            </div>

            <SettingsToggle
              label="Enable Card Payment"
              checked={settings.payment.cardPaymentEnabled}
              onChange={(checked) => updateGroup("payment", { cardPaymentEnabled: checked })}
            />
            <SettingsToggle
              label="Enable Bank Transfer"
              checked={settings.payment.bankTransferEnabled}
              onChange={(checked) => updateGroup("payment", { bankTransferEnabled: checked })}
            />
            <SettingsToggle
              label="Enable Cash On Delivery (Coming Soon)"
              checked={settings.payment.cashOnDeliveryEnabled}
              onChange={(checked) => updateGroup("payment", { cashOnDeliveryEnabled: checked })}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Bank Account Name</label>
                <Input
                  value={settings.payment.bankTransferAccountName}
                  onChange={(event) =>
                    updateGroup("payment", { bankTransferAccountName: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Bank Name</label>
                <Input
                  value={settings.payment.bankTransferBankName}
                  onChange={(event) =>
                    updateGroup("payment", { bankTransferBankName: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Account Number</label>
                <Input
                  value={settings.payment.bankTransferAccountNumber}
                  onChange={(event) =>
                    updateGroup("payment", { bankTransferAccountNumber: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Branch</label>
                <Input
                  value={settings.payment.bankTransferBranch}
                  onChange={(event) =>
                    updateGroup("payment", { bankTransferBranch: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">SWIFT Code</label>
                <Input
                  value={settings.payment.bankTransferSwift}
                  onChange={(event) =>
                    updateGroup("payment", { bankTransferSwift: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">Bank Transfer Note</label>
                <textarea
                  className="focus-ring min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
                  value={settings.payment.bankTransferNote}
                  onChange={(event) =>
                    updateGroup("payment", { bankTransferNote: event.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Homepage Sections</CardHeader>
          <CardContent className="space-y-3">
            <SettingsToggle
              label="Show Hero Section"
              description="Enable or disable homepage hero/banner zone."
              checked={settings.homepage.heroEnabled}
              onChange={(checked) => updateGroup("homepage", { heroEnabled: checked })}
            />
            <SettingsToggle
              label="Show Featured Categories"
              checked={settings.homepage.featuredCategoriesEnabled}
              onChange={(checked) =>
                updateGroup("homepage", { featuredCategoriesEnabled: checked })
              }
            />
            <SettingsToggle
              label="Show New Arrivals"
              checked={settings.homepage.newArrivalsEnabled}
              onChange={(checked) => updateGroup("homepage", { newArrivalsEnabled: checked })}
            />
            <SettingsToggle
              label="Show Best Sellers"
              checked={settings.homepage.bestSellersEnabled}
              onChange={(checked) => updateGroup("homepage", { bestSellersEnabled: checked })}
            />
            <SettingsToggle
              label="Show Promo Banner Blocks"
              checked={settings.banners.promoBannerEnabled}
              onChange={(checked) => updateGroup("banners", { promoBannerEnabled: checked })}
            />
            <div className="space-y-1">
              <label className="text-xs font-medium">Hero Auto Rotate Seconds</label>
              <Input
                type="number"
                min={2}
                max={30}
                value={settings.banners.heroAutoRotateSeconds}
                onChange={(event) =>
                  updateGroup("banners", {
                    heroAutoRotateSeconds: parseNumber(event.target.value, 6),
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Notification Settings</CardHeader>
          <CardContent className="space-y-3">
            <SettingsToggle
              label="Auto Stock Alerts"
              description="Create low-stock and out-of-stock alerts for admins automatically."
              checked={settings.notifications.autoStockAlertsEnabled}
              onChange={(checked) =>
                updateGroup("notifications", { autoStockAlertsEnabled: checked })
              }
            />
            <div className="space-y-1">
              <label className="text-xs font-medium">Low Stock Threshold (Units)</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={settings.notifications.lowStockThreshold}
                onChange={(event) =>
                  updateGroup("notifications", {
                    lowStockThreshold: parseInteger(
                      event.target.value,
                      settings.notifications.lowStockThreshold,
                      1,
                      500,
                    ),
                  })
                }
              />
            </div>
            <SettingsToggle
              label="Order Alerts"
              description="Send customer notifications for order status and tracking updates."
              checked={settings.notifications.orderAlertsEnabled}
              onChange={(checked) => updateGroup("notifications", { orderAlertsEnabled: checked })}
            />
            <SettingsToggle
              label="Payment Alerts"
              description="Send customer notifications for payment verification and rejection outcomes."
              checked={settings.notifications.paymentAlertsEnabled}
              onChange={(checked) => updateGroup("notifications", { paymentAlertsEnabled: checked })}
            />
            <SettingsToggle
              label="Review Alerts"
              description="Send customer notifications when reviews are approved or rejected."
              checked={settings.notifications.reviewAlertsEnabled}
              onChange={(checked) => updateGroup("notifications", { reviewAlertsEnabled: checked })}
            />
            <SettingsToggle
              label="Promotion Alerts"
              description="Allow promotional campaign notifications."
              checked={settings.notifications.promotionAlertsEnabled}
              onChange={(checked) =>
                updateGroup("notifications", { promotionAlertsEnabled: checked })
              }
            />
            <SettingsToggle
              label="System Alerts"
              description="Allow system and platform health notifications."
              checked={settings.notifications.systemAlertsEnabled}
              onChange={(checked) => updateGroup("notifications", { systemAlertsEnabled: checked })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Social Links</CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Facebook URL</label>
              <Input
                type="url"
                value={settings.social.facebookUrl}
                onChange={(event) => updateGroup("social", { facebookUrl: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Instagram URL</label>
              <Input
                type="url"
                value={settings.social.instagramUrl}
                onChange={(event) => updateGroup("social", { instagramUrl: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">YouTube URL</label>
              <Input
                type="url"
                value={settings.social.youtubeUrl}
                onChange={(event) => updateGroup("social", { youtubeUrl: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">TikTok URL</label>
              <Input
                type="url"
                value={settings.social.tiktokUrl}
                onChange={(event) => updateGroup("social", { tiktokUrl: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
