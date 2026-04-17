"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { useToastStore } from "@/store/toast-store";
import type { SellerStoreProfilePayload } from "@/types/seller";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type StoreProfileForm = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  taxId: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
};

const defaultForm: StoreProfileForm = {
  storeName: "",
  supportEmail: "",
  supportPhone: "",
  taxId: "",
  description: "",
  logoUrl: "",
  bannerUrl: "",
};

function buildFormFromProfile(
  profile: NonNullable<SellerStoreProfilePayload["profile"]>,
): StoreProfileForm {
  return {
    storeName: profile.storeName,
    supportEmail: profile.supportEmail ?? "",
    supportPhone: profile.supportPhone ?? "",
    taxId: profile.taxId ?? "",
    description: profile.description ?? "",
    logoUrl: profile.logoUrl ?? "",
    bannerUrl: profile.bannerUrl ?? "",
  };
}

export function SellerStoreProfileManager() {
  const pushToast = useToastStore((state) => state.pushToast);
  const [profilePayload, setProfilePayload] = useState<SellerStoreProfilePayload | null>(null);
  const [form, setForm] = useState<StoreProfileForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/seller/store", { cache: "no-store" });
      const payload = (await response.json()) as ApiEnvelope<SellerStoreProfilePayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to fetch store profile");
      }
      setProfilePayload(payload.data);
      if (payload.data.profile) {
        setForm(buildFormFromProfile(payload.data.profile));
      } else {
        setForm(defaultForm);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to fetch store profile";
      setError(message);
      pushToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const hasChanges = useMemo(() => {
    if (!profilePayload?.profile) return false;
    const base = buildFormFromProfile(profilePayload.profile);
    return JSON.stringify(base) !== JSON.stringify(form);
  }, [form, profilePayload]);

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasChanges) {
      pushToast("No changes to save", "info");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/seller/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as ApiEnvelope<SellerStoreProfilePayload>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to update store profile");
      }
      setProfilePayload(payload.data);
      if (payload.data.profile) {
        setForm(buildFormFromProfile(payload.data.profile));
      }
      pushToast("Store profile updated successfully", "success");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to update profile";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    if (!profilePayload?.profile) return;
    setForm(buildFormFromProfile(profilePayload.profile));
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading store profile...</p>
      </section>
    );
  }

  if (!profilePayload?.profile) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Store profile not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please complete seller onboarding first, then reload this page.
        </p>
      </section>
    );
  }

  const profile = profilePayload.profile;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Store Overview</h2>
            <p className="text-sm text-muted-foreground">
              Keep your public store details accurate for better trust and conversions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill value={profile.status} />
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="text-muted-foreground">
            Store Slug: <span className="font-semibold text-foreground">{profile.storeSlug}</span>
          </p>
          <p className="text-muted-foreground">
            Commission: <span className="font-semibold text-foreground">{profile.commissionRate}%</span>
          </p>
          <p className="text-muted-foreground">
            Approved At:{" "}
            <span className="font-semibold text-foreground">
              {profile.approvedAt ? new Date(profile.approvedAt).toLocaleDateString() : "-"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Owner:{" "}
            <span className="font-semibold text-foreground">
              {profile.owner.firstName || profile.owner.lastName
                ? `${profile.owner.firstName ?? ""} ${profile.owner.lastName ?? ""}`.trim()
                : profile.owner.email}
            </span>
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <form onSubmit={submitProfile} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Editable Store Profile</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Store Name</label>
              <Input
                required
                value={form.storeName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, storeName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Support Email</label>
              <Input
                type="email"
                value={form.supportEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, supportEmail: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Support Phone</label>
              <Input
                value={form.supportPhone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, supportPhone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Tax ID</label>
              <Input
                value={form.taxId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, taxId: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">Logo URL</label>
              <Input
                type="url"
                placeholder="https://..."
                value={form.logoUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, logoUrl: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">Banner URL</label>
              <Input
                type="url"
                placeholder="https://..."
                value={form.bannerUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bannerUrl: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">Store Description</label>
              <textarea
                className="focus-ring min-h-[120px] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting || !hasChanges}>
              <Save className="mr-2 h-4 w-4" />
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={submitting || !hasChanges}>
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadProfile()} disabled={submitting}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Reload
            </Button>
          </div>
        </form>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Visual Preview</h3>

          <div
            className="h-28 w-full rounded-xl border border-border bg-cover bg-center"
            style={{
              backgroundImage: form.bannerUrl ? `url("${form.bannerUrl}")` : undefined,
            }}
          />

          <div className="flex items-center gap-3">
            <div
              className="h-14 w-14 rounded-full border border-border bg-cover bg-center"
              style={{
                backgroundImage: form.logoUrl ? `url("${form.logoUrl}")` : undefined,
              }}
            />
            <div>
              <p className="text-sm font-semibold">{form.storeName || "Store Name"}</p>
              <p className="text-xs text-muted-foreground">{profile.storeSlug}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            This preview helps you quickly check branding updates before saving.
          </p>
        </aside>
      </section>
    </div>
  );
}
