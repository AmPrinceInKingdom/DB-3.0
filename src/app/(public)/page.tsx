import Link from "next/link";
import { CategoryChips } from "@/components/home/category-chips";
import { MiniProductCard } from "@/components/home/mini-product-card";
import { ProductStripSection } from "@/components/home/product-strip-section";
import { PromoBannerRow } from "@/components/home/promo-banner-row";
import { getPublicSiteSettings } from "@/lib/services/public-settings-service";
import { listProducts } from "@/lib/services/product-service";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

function withFallbackProducts(primary: Product[], fallback: Product[], minCount = 10) {
  if (primary.length >= minCount) return primary.slice(0, minCount);

  const merged = [...primary];
  const seen = new Set(primary.map((item) => item.id));
  for (const item of fallback) {
    if (seen.has(item.id)) continue;
    merged.push(item);
    seen.add(item.id);
    if (merged.length >= minCount) break;
  }
  return merged;
}

export default async function HomePage() {
  const publicSettings = await getPublicSiteSettings();
  const homepage = publicSettings.homepage;

  const showcaseProducts = await listProducts({ sortBy: "popular" });
  const dealsPrimary = await listProducts({ sortBy: "popular" });
  const trendingPrimary = await listProducts({ sortBy: "best_selling" });
  const featuredPrimary = await listProducts({ featured: true, sortBy: "highest_rated" });
  const offersPrimary = await listProducts({ sortBy: "highest_rated" });
  const newArrivalsPrimary = await listProducts({ newArrival: true, sortBy: "newest" });

  const discountedProducts = dealsPrimary.filter(
    (product) => Boolean(product.oldPrice && product.oldPrice > product.price),
  );

  const fallbackPool = showcaseProducts.length > 0 ? showcaseProducts : dealsPrimary;
  const homeProducts = showcaseProducts.length > 0 ? showcaseProducts : fallbackPool;
  const newArrivalProducts = withFallbackProducts(newArrivalsPrimary, fallbackPool, 10);
  const dealProducts = withFallbackProducts(discountedProducts, fallbackPool, 10);
  const trendingProducts = withFallbackProducts(trendingPrimary, fallbackPool, 10);
  const featuredProducts = withFallbackProducts(featuredPrimary, fallbackPool, 10);
  const offerProducts = withFallbackProducts(
    offersPrimary.filter(
      (product) =>
        !discountedProducts.some((discounted) => discounted.id === product.id) &&
        !featuredProducts.some((featured) => featured.id === product.id),
    ),
    fallbackPool,
    10,
  );

  return (
    <div className="space-y-9">
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/75 p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 -bottom-28 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Deal Bazaar Picks
            </p>
            <h2 className="text-2xl font-bold md:text-3xl">Top Finds For Smart Shoppers</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Quick-scan product cards with daily deal pricing, fast add-to-cart, and trusted seller
              highlights.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border bg-background/75 px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
              {homeProducts.length}+ products live
            </span>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-accent"
            >
              Explore all products
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {homeProducts.map((product) => (
            <MiniProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {homepage.promoBannerEnabled ? <PromoBannerRow /> : null}

      {homepage.newArrivalsEnabled ? (
        <ProductStripSection
          title="New Arrivals"
          subtitle="Freshly added products with new deals every day."
          href="/new-arrivals"
          products={newArrivalProducts}
        />
      ) : null}

      <ProductStripSection
        title="Deals"
        subtitle="Daily discounted picks with limited-time pricing."
        href="/offers"
        products={dealProducts}
      />

      {homepage.bestSellersEnabled ? (
        <ProductStripSection
          title="Trending"
          subtitle="What customers are buying the most right now."
          href="/best-sellers"
          products={trendingProducts}
        />
      ) : null}

      <ProductStripSection
        title="Featured"
        subtitle="Handpicked premium products from trusted sellers."
        href="/featured-products"
        products={featuredProducts}
      />

      <ProductStripSection
        title="Offers"
        subtitle="Extra campaign offers and price drops."
        href="/offers"
        products={offerProducts}
      />

      {homepage.featuredCategoriesEnabled ? <CategoryChips /> : null}
    </div>
  );
}
