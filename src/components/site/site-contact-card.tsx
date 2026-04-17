"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/constants/site";
import type { PublicSiteSettings } from "@/types/settings";

type PublicSettingsResponse = {
  success: boolean;
  data?: PublicSiteSettings;
};

type Props = {
  className?: string;
  title?: string;
  description?: string;
};

const fallbackSettings: PublicSiteSettings = {
  siteName: siteConfig.name,
  siteTagline: siteConfig.description,
  logoUrl: "",
  supportEmail: siteConfig.supportEmail,
  supportPhone: siteConfig.supportPhone,
  whatsappNumber: siteConfig.supportPhone,
  businessAddress: "",
  social: {
    facebookUrl: siteConfig.socialLinks.facebook,
    instagramUrl: siteConfig.socialLinks.instagram,
    youtubeUrl: "",
    tiktokUrl: "",
  },
  homepage: {
    heroEnabled: false,
    featuredCategoriesEnabled: true,
    newArrivalsEnabled: true,
    bestSellersEnabled: true,
    promoBannerEnabled: true,
  },
};

export function SiteContactCard({
  className,
  title = "Contact",
  description = "For inquiries, feedback, or support, please contact us:",
}: Props) {
  const [settings, setSettings] = useState<PublicSiteSettings>(fallbackSettings);

  useEffect(() => {
    const controller = new AbortController();

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/public/settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as PublicSettingsResponse;
        if (payload.success && payload.data) {
          setSettings(payload.data);
        }
      } catch {
        // Keep fallback settings.
      }
    };

    void loadSettings();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <article className={className}>
      <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>

      <div className="mt-3 space-y-1 text-sm sm:text-base">
        <p className="font-semibold">
          Email:{" "}
          <a href={`mailto:${settings.supportEmail}`} className="text-foreground underline-offset-2 hover:underline">
            {settings.supportEmail}
          </a>
        </p>
        <p className="font-semibold">
          Phone:{" "}
          <a href={`tel:${settings.supportPhone}`} className="text-foreground underline-offset-2 hover:underline">
            {settings.supportPhone}
          </a>
        </p>
        {settings.whatsappNumber.trim().length > 0 ? (
          <p className="font-semibold">WhatsApp: {settings.whatsappNumber}</p>
        ) : null}
        {settings.businessAddress.trim().length > 0 ? (
          <p className="font-medium text-muted-foreground">Address: {settings.businessAddress}</p>
        ) : null}
      </div>
    </article>
  );
}
