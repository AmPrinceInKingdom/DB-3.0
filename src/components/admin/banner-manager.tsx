"use client";

import { useEffect, useMemo, useState } from "react";
import type { BannerItem } from "@/types/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type BannerFormState = {
  type: BannerItem["type"];
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  ctaText: string;
  ctaUrl: string;
  position: string;
  isActive: boolean;
};

const initialForm: BannerFormState = {
  type: "HERO",
  title: "",
  subtitle: "",
  imageUrl: "",
  mobileImageUrl: "",
  ctaText: "",
  ctaUrl: "",
  position: "0",
  isActive: true,
};

export function BannerManager() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormState>(initialForm);

  const bannerCount = useMemo(() => banners.length, [banners.length]);

  const loadBanners = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/banners", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load banners");
      }
      setBanners(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBanners();
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          subtitle: form.subtitle,
          imageUrl: form.imageUrl,
          mobileImageUrl: form.mobileImageUrl,
          ctaText: form.ctaText,
          ctaUrl: form.ctaUrl,
          position: Number(form.position || 0),
          isActive: form.isActive,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to create banner");
      }

      setForm(initialForm);
      await loadBanners();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create banner");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (banner: BannerItem) => {
    try {
      const response = await fetch(`/api/admin/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update banner");
      }
      await loadBanners();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update banner");
    }
  };

  const deleteBanner = async (bannerId: string) => {
    try {
      const response = await fetch(`/api/admin/banners/${bannerId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to delete banner");
      }
      await loadBanners();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete banner");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Add New Banner</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create homepage sliders and promotional banners from this panel.
        </p>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Type</label>
            <Select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as BannerItem["type"],
                }))
              }
            >
              <option value="HERO">Hero</option>
              <option value="PROMOTION">Promotion</option>
              <option value="CATEGORY">Category</option>
              <option value="FLASH_DEAL">Flash Deal</option>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Position</label>
            <Input
              type="number"
              min={0}
              value={form.position}
              onChange={(event) =>
                setForm((current) => ({ ...current, position: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Title</label>
            <Input
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Subtitle</label>
            <Input
              value={form.subtitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, subtitle: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Banner Image URL</label>
            <Input
              required
              type="url"
              value={form.imageUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">Mobile Image URL (Optional)</label>
            <Input
              type="url"
              value={form.mobileImageUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, mobileImageUrl: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">CTA Text</label>
            <Input
              value={form.ctaText}
              onChange={(event) =>
                setForm((current) => ({ ...current, ctaText: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">CTA URL</label>
            <Input
              type="url"
              value={form.ctaUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, ctaUrl: event.target.value }))
              }
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            Active banner
          </label>
          <Button type="submit" disabled={submitting} className="md:col-span-2">
            {submitting ? "Saving..." : "Add Banner"}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Existing Banners ({bannerCount})</h2>
          <Button variant="outline" size="sm" onClick={() => void loadBanners()}>
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading banners...</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-muted-foreground">No banners yet.</p>
        ) : (
          <div className="grid gap-3">
            {banners.map((banner) => (
              <article
                key={banner.id}
                className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[220px_1fr_auto]"
              >
                <div
                  className="h-24 rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${banner.imageUrl})` }}
                />
                <div>
                  <p className="text-sm font-semibold">{banner.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {banner.type} - Position {banner.position} -{" "}
                    {banner.isActive ? "Active" : "Inactive"}
                  </p>
                  {banner.subtitle ? (
                    <p className="mt-1 text-xs text-muted-foreground">{banner.subtitle}</p>
                  ) : null}
                </div>
                <div className="flex gap-2 md:flex-col">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void toggleStatus(banner)}
                  >
                    {banner.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => void deleteBanner(banner.id)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

