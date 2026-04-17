"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, RefreshCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToastStore } from "@/store/toast-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import type { AccountProfilePayload } from "@/types/account-profile";
import type { CurrencyCode } from "@/lib/constants/currency";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredCurrency: string;
  preferredLanguage: "en" | "si";
  themePreference: "system" | "light" | "dark";
};

const supportedCurrencyCodes: CurrencyCode[] = ["LKR", "USD", "EUR", "GBP", "INR"];

function buildFormFromPayload(payload: AccountProfilePayload): ProfileFormState {
  return {
    firstName: payload.profile.firstName ?? "",
    lastName: payload.profile.lastName ?? "",
    email: payload.profile.email,
    phone: payload.profile.phone ?? "",
    preferredCurrency: payload.profile.preferredCurrency,
    preferredLanguage: payload.profile.preferredLanguage,
    themePreference: payload.profile.themePreference,
  };
}

export function ProfileManager() {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.pushToast);
  const setCurrency = useUiPreferencesStore((state) => state.setCurrency);
  const setLanguage = useUiPreferencesStore((state) => state.setLanguage);
  const { setTheme } = useTheme();

  const [payload, setPayload] = useState<AccountProfilePayload | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [initialForm, setInitialForm] = useState<ProfileFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!form || !initialForm) return false;
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account/profile", { cache: "no-store" });
      const result = (await response.json()) as ApiEnvelope<AccountProfilePayload>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Unable to load profile");
      }

      const nextForm = buildFormFromPayload(result.data);
      setPayload(result.data);
      setForm(nextForm);
      setInitialForm(nextForm);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load profile";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function setField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: value,
      };
    });
  }

  async function saveProfile() {
    if (!form) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          preferredCurrency: form.preferredCurrency,
          preferredLanguage: form.preferredLanguage,
          themePreference: form.themePreference,
        }),
      });

      const result = (await response.json()) as ApiEnvelope<AccountProfilePayload>;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Unable to update profile");
      }

      const nextForm = buildFormFromPayload(result.data);
      setPayload(result.data);
      setForm(nextForm);
      setInitialForm(nextForm);

      if (supportedCurrencyCodes.includes(nextForm.preferredCurrency as CurrencyCode)) {
        setCurrency(nextForm.preferredCurrency as CurrencyCode);
      }
      setLanguage(nextForm.preferredLanguage);
      setTheme(nextForm.themePreference);

      pushToast("Profile updated successfully", "success");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to update profile";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function logoutUser() {
    setLoggingOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      const result = (await response.json()) as ApiEnvelope<null>;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to log out");
      }

      pushToast("Logged out successfully", "success");
      router.replace("/login");
      router.refresh();
    } catch (logoutError) {
      const message = logoutError instanceof Error ? logoutError.message : "Unable to log out";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading && !form) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </section>
    );
  }

  if (!form || !payload) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-red-600 dark:text-red-300">
          {error ?? "Unable to load profile."}
        </p>
        <Button variant="outline" onClick={() => void loadProfile()}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h1 className="text-2xl font-bold">Profile Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your profile and default shopping preferences.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Joined: {new Date(payload.profile.createdAt).toLocaleDateString()}
            {payload.profile.lastLoginAt
              ? ` · Last login: ${new Date(payload.profile.lastLoginAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadProfile()} disabled={loading || saving}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void saveProfile()} disabled={!isDirty || saving || loading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="danger"
            onClick={() => void logoutUser()}
            disabled={loggingOut || saving || loading}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {loggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Basic Information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">First Name</span>
              <Input
                value={form.firstName}
                onChange={(event) => setField("firstName", event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Last Name</span>
              <Input
                value={form.lastName}
                onChange={(event) => setField("lastName", event.target.value)}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Email (read only)</span>
              <Input value={form.email} disabled />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <Input value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
            </label>
          </div>
        </article>

        <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Preferences</h2>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Preferred Currency</span>
            <Select
              value={form.preferredCurrency}
              onChange={(event) => setField("preferredCurrency", event.target.value)}
            >
              {payload.options.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Preferred Language</span>
            <Select
              value={form.preferredLanguage}
              onChange={(event) =>
                setField("preferredLanguage", event.target.value as "en" | "si")
              }
            >
              {payload.options.languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Theme Preference</span>
            <Select
              value={form.themePreference}
              onChange={(event) =>
                setField(
                  "themePreference",
                  event.target.value as "system" | "light" | "dark",
                )
              }
            >
              {payload.options.themeModes.map((themeMode) => (
                <option key={themeMode} value={themeMode}>
                  {themeMode[0].toUpperCase()}
                  {themeMode.slice(1)}
                </option>
              ))}
            </Select>
          </label>
        </article>
      </section>
    </div>
  );
}
