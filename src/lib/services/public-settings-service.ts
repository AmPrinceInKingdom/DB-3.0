import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { siteConfig } from "@/lib/constants/site";
import type { PublicSiteSettings } from "@/types/settings";

export const PUBLIC_SETTINGS_CACHE_TAG = "public-site-settings";

function toStringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function toBooleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

async function loadPublicSiteSettings(): Promise<PublicSiteSettings> {
  const fallback: PublicSiteSettings = {
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

  try {
    const [siteSettings, homepageSections] = await Promise.all([
      db.siteSetting.findMany({
        where: {
          settingKey: {
            in: [
              "site_name",
              "site_tagline",
              "logo_url",
              "support_email",
              "support_phone",
              "whatsapp_number",
              "business_address",
              "facebook_url",
              "instagram_url",
              "youtube_url",
              "tiktok_url",
              "promo_banner_enabled",
            ],
          },
        },
        select: {
          settingKey: true,
          settingValue: true,
        },
      }),
      db.homepageSection.findMany({
        where: {
          sectionKey: {
            in: ["hero", "featured_categories", "new_arrivals", "best_sellers"],
          },
        },
        select: {
          sectionKey: true,
          isActive: true,
        },
      }),
    ]);

    const settingsMap = new Map(siteSettings.map((item) => [item.settingKey, item.settingValue]));
    const homepageMap = new Map(homepageSections.map((item) => [item.sectionKey, item.isActive]));

    const siteName = toStringValue(settingsMap.get("site_name"), fallback.siteName) || fallback.siteName;
    const siteTagline =
      toStringValue(settingsMap.get("site_tagline"), fallback.siteTagline) || fallback.siteTagline;
    const logoUrl = toStringValue(settingsMap.get("logo_url"), fallback.logoUrl);
    const supportEmail =
      toStringValue(settingsMap.get("support_email"), fallback.supportEmail) || fallback.supportEmail;
    const supportPhone =
      toStringValue(settingsMap.get("support_phone"), fallback.supportPhone) || fallback.supportPhone;
    const whatsappNumber = toStringValue(
      settingsMap.get("whatsapp_number"),
      fallback.whatsappNumber,
    );
    const businessAddress = toStringValue(
      settingsMap.get("business_address"),
      fallback.businessAddress,
    );

    return {
      siteName,
      siteTagline,
      logoUrl,
      supportEmail,
      supportPhone,
      whatsappNumber,
      businessAddress,
      social: {
        facebookUrl:
          toStringValue(settingsMap.get("facebook_url"), fallback.social.facebookUrl) ||
          fallback.social.facebookUrl,
        instagramUrl:
          toStringValue(settingsMap.get("instagram_url"), fallback.social.instagramUrl) ||
          fallback.social.instagramUrl,
        youtubeUrl: toStringValue(settingsMap.get("youtube_url"), fallback.social.youtubeUrl),
        tiktokUrl: toStringValue(settingsMap.get("tiktok_url"), fallback.social.tiktokUrl),
      },
      homepage: {
        heroEnabled: homepageMap.get("hero") ?? fallback.homepage.heroEnabled,
        featuredCategoriesEnabled:
          homepageMap.get("featured_categories") ?? fallback.homepage.featuredCategoriesEnabled,
        newArrivalsEnabled: homepageMap.get("new_arrivals") ?? fallback.homepage.newArrivalsEnabled,
        bestSellersEnabled: homepageMap.get("best_sellers") ?? fallback.homepage.bestSellersEnabled,
        promoBannerEnabled: toBooleanValue(
          settingsMap.get("promo_banner_enabled"),
          fallback.homepage.promoBannerEnabled,
        ),
      },
    };
  } catch {
    return fallback;
  }
}

const getCachedPublicSiteSettings = unstable_cache(
  loadPublicSiteSettings,
  ["public-site-settings-cache"],
  {
    tags: [PUBLIC_SETTINGS_CACHE_TAG],
    revalidate: 300,
  },
);

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  return getCachedPublicSiteSettings();
}
