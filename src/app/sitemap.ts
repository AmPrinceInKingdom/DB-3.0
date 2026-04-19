import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/constants/site";
import { listProducts } from "@/lib/services/product-service";

export const revalidate = 3600;

const publicRoutes = [
  "",
  "/shop",
  "/offers",
  "/new-arrivals",
  "/best-sellers",
  "/featured-products",
  "/about",
  "/contact",
  "/faq",
  "/privacy",
  "/terms",
  "/return-policy",
  "/shipping-policy",
  "/help-center",
  "/health",
];

function toAbsoluteUrl(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteConfig.url}${normalized}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((path) => ({
    url: toAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "" ? "hourly" : "daily",
    priority: path === "" ? 1 : 0.8,
  }));

  try {
    const products = await listProducts({ sortBy: "newest" });
    const productEntries: MetadataRoute.Sitemap = products.slice(0, 200).map((product) => ({
      url: toAbsoluteUrl(`/product/${product.slug}`),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    }));
    return [...staticEntries, ...productEntries];
  } catch {
    return staticEntries;
  }
}
