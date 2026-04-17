"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/constants/site";
import type { PublicSiteSettings } from "@/types/settings";

const footerGroups = [
  {
    title: "Customer Care",
    links: [
      { label: "Help Center", href: "/help-center" },
      { label: "Contact Us", href: "/contact" },
      { label: "Returns", href: "/return-policy" },
      { label: "Shipping", href: "/shipping-policy" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Business",
    links: [
      { label: "Become a Seller", href: "/seller/apply" },
      { label: "Seller Center", href: "/seller" },
      { label: "Admin Portal", href: "/admin" },
      { label: "Partner Program", href: "/partners" },
    ],
  },
];

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
};

const defaultPublicSettings: PublicSiteSettings = {
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

export function MainFooter() {
  const [settings, setSettings] = useState<PublicSiteSettings>(defaultPublicSettings);

  useEffect(() => {
    const controller = new AbortController();

    const loadPublicSettings = async () => {
      try {
        const response = await fetch("/api/public/settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as ApiEnvelope<PublicSiteSettings>;
        if (payload.success && payload.data) {
          setSettings(payload.data);
        }
      } catch {
        // Keep fallback values from static config.
      }
    };

    void loadPublicSettings();

    return () => {
      controller.abort();
    };
  }, []);

  const socialLinks = [
    { label: "Facebook", href: settings.social.facebookUrl },
    { label: "Instagram", href: settings.social.instagramUrl },
    { label: "YouTube", href: settings.social.youtubeUrl },
    { label: "TikTok", href: settings.social.tiktokUrl },
  ].filter((item) => item.href.trim().length > 0);

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="container-app py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-xl font-bold">{settings.siteName}</p>
            <p className="mt-3 text-sm text-muted-foreground">{settings.siteTagline}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Support:{" "}
              <a href={`mailto:${settings.supportEmail}`} className="text-foreground">
                {settings.supportEmail}
              </a>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Phone:{" "}
              <a href={`tel:${settings.supportPhone}`} className="text-foreground">
                {settings.supportPhone}
              </a>
            </p>
            {settings.whatsappNumber.trim().length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                WhatsApp: <span className="text-foreground">{settings.whatsappNumber}</span>
              </p>
            ) : null}
            {settings.businessAddress.trim().length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">{settings.businessAddress}</p>
            ) : null}
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold">{group.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {socialLinks.length > 0 ? (
          <div className="mt-8 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow Us</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground">
          (c) {new Date().getFullYear()} {settings.siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
