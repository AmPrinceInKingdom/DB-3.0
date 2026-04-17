"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BannerItem } from "@/types/banner";

const fallbackPromos: BannerItem[] = [
  {
    id: "promo-fallback-1",
    type: "PROMOTION",
    title: "Weekend Tech Offers",
    subtitle: "Laptops, accessories, and gadgets with extra discounts.",
    imageUrl:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
    mobileImageUrl: null,
    ctaText: "Shop Electronics",
    ctaUrl: "/shop?category=electronics",
    position: 1,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "promo-fallback-2",
    type: "PROMOTION",
    title: "Fashion Special Picks",
    subtitle: "Daily trending styles curated for quick checkout.",
    imageUrl:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
    mobileImageUrl: null,
    ctaText: "View Fashion",
    ctaUrl: "/shop?category=fashion",
    position: 2,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
];

export function PromoBannerRow() {
  const [items, setItems] = useState<BannerItem[]>(fallbackPromos);

  useEffect(() => {
    const controller = new AbortController();

    const loadPromotions = async () => {
      try {
        const response = await fetch("/api/banners?type=PROMOTION&limit=2", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (
          payload?.success &&
          Array.isArray(payload.data) &&
          payload.data.length > 0
        ) {
          setItems(payload.data.slice(0, 2));
        }
      } catch {
        // Keep fallback promo cards.
      }
    };

    void loadPromotions();

    return () => controller.abort();
  }, []);

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {items.map((promo) => (
        <article
          key={promo.id}
          className="relative overflow-hidden rounded-2xl border border-border"
        >
          <div
            className="min-h-[180px] bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(125deg, rgba(0,0,0,0.62), rgba(0,0,0,0.22)), url(${promo.imageUrl})`,
            }}
          />
          <div className="absolute inset-0 p-4 text-white md:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              Promo
            </p>
            <h3 className="mt-2 text-xl font-bold">{promo.title}</h3>
            {promo.subtitle ? (
              <p className="mt-1 max-w-sm text-xs text-white/90 md:text-sm">
                {promo.subtitle}
              </p>
            ) : null}
            <Button asChild size="sm" className="mt-4">
              <Link href={promo.ctaUrl ?? "/offers"}>
                {promo.ctaText ?? "Explore"}
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}

