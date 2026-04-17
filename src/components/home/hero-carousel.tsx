"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Gift, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BannerItem } from "@/types/banner";

const fallbackBanners: BannerItem[] = [
  {
    id: "fallback-1",
    type: "HERO",
    title: "Unbeatable Mobile Deals",
    subtitle: "Up to 15% off on trending smartphones and accessories.",
    imageUrl:
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1600&q=80",
    mobileImageUrl: null,
    ctaText: "Shop Now",
    ctaUrl: "/shop?category=electronics",
    position: 1,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "fallback-2",
    type: "HERO",
    title: "Flash Fashion Weekend",
    subtitle: "Save big on premium fashion picks selected for you.",
    imageUrl:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1600&q=80",
    mobileImageUrl: null,
    ctaText: "View Deals",
    ctaUrl: "/offers",
    position: 2,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "fallback-3",
    type: "HERO",
    title: "Home Essentials Sale",
    subtitle: "Kitchen, storage, and smart home offers in one place.",
    imageUrl:
      "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1600&q=80",
    mobileImageUrl: null,
    ctaText: "Explore",
    ctaUrl: "/shop?category=home-living",
    position: 3,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
];

const sideHighlights = [
  {
    icon: Gift,
    title: "Daily Vouchers",
    subtitle: "Claim special coupon bundles from Deals page.",
    href: "/offers",
  },
  {
    icon: Truck,
    title: "Fast Delivery",
    subtitle: "Island-wide dispatch with real-time order tracking.",
    href: "/shipping-policy",
  },
  {
    icon: ShieldCheck,
    title: "Trusted Payments",
    subtitle: "Card and bank transfer verification with admin review.",
    href: "/help-center",
  },
];

export function HeroCarousel() {
  const [banners, setBanners] = useState<BannerItem[]>(fallbackBanners);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadBanners = async () => {
      try {
        const response = await fetch("/api/banners?type=HERO&limit=6", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (
          payload?.success &&
          Array.isArray(payload.data) &&
          payload.data.length > 0
        ) {
          setBanners(payload.data);
          setActiveIndex(0);
        }
      } catch {
        // Keep fallback banners when API is unavailable.
      }
    };

    void loadBanners();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  const activeBanner = useMemo(
    () => banners[activeIndex] ?? banners[0],
    [banners, activeIndex],
  );

  if (!activeBanner) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-[1.75fr_0.75fr]">
      <article className="relative overflow-hidden rounded-3xl border border-border">
        <div
          className="min-h-[280px] bg-cover bg-center md:min-h-[360px]"
          style={{
            backgroundImage: `linear-gradient(120deg, rgba(0,0,0,0.6), rgba(0,0,0,0.15)), url(${activeBanner.imageUrl})`,
          }}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-5 text-white md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
            Deal Bazaar Spotlight
          </p>
          <h1 className="mt-2 max-w-2xl text-2xl font-bold leading-tight md:text-4xl">
            {activeBanner.title}
          </h1>
          {activeBanner.subtitle ? (
            <p className="mt-2 max-w-xl text-sm text-white/90 md:text-base">
              {activeBanner.subtitle}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button asChild className="bg-primary hover:bg-accent">
              <Link href={activeBanner.ctaUrl ?? "/shop"}>
                {activeBanner.ctaText ?? "Shop Now"}
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/50 bg-white/10 text-white hover:bg-white/20">
              <Link href="/offers">View All Deals</Link>
            </Button>
          </div>
        </div>

        {banners.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() =>
                setActiveIndex((current) => (current - 1 + banners.length) % banners.length)
              }
              className="focus-ring absolute left-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
              aria-label="Previous banner"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((current) => (current + 1) % banners.length)}
              className="focus-ring absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
              aria-label="Next banner"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
              {banners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === activeIndex ? "w-7 bg-white" : "w-2 bg-white/50"
                  }`}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </article>

      <aside className="grid gap-3">
        {sideHighlights.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
            </Link>
          );
        })}
      </aside>
    </section>
  );
}

