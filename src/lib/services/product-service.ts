import { Prisma, ReviewStatus } from "@prisma/client";
import { allHomeProducts } from "@/lib/constants/mock-data";
import { db } from "@/lib/db";
import type {
  Product,
  ProductDetailsContent,
  ProductDetailsVariant,
  ProductReview,
  ProductSpecification,
} from "@/types/product";

export type ProductListQuery = {
  search?: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  brandName?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  inStock?: boolean;
  sortBy?:
    | "price_asc"
    | "price_desc"
    | "newest"
    | "best_selling"
    | "highest_rated"
    | "popular";
};

const productCardQuery = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  currentPrice: true,
  oldPrice: true,
  stockQuantity: true,
  featured: true,
  bestSeller: true,
  newArrival: true,
  averageRating: true,
  category: {
    select: {
      name: true,
    },
  },
  brand: {
    select: {
      name: true,
    },
  },
  images: {
    where: { isMain: true },
    select: {
      imageUrl: true,
    },
    take: 1,
  },
  _count: {
    select: {
      reviews: true,
    },
  },
} satisfies Prisma.ProductSelect;

type ProductCardRecord = Prisma.ProductGetPayload<{
  select: typeof productCardQuery;
}>;

const productDetailsQuery = {
  id: true,
  slug: true,
  name: true,
  sku: true,
  shortDescription: true,
  description: true,
  stockQuantity: true,
  category: {
    select: {
      name: true,
    },
  },
  brand: {
    select: {
      name: true,
    },
  },
  images: {
    select: {
      imageUrl: true,
      isMain: true,
      sortOrder: true,
    },
    orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
    take: 8,
  },
  attributeValues: {
    select: {
      value: true,
      attribute: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 12,
  },
  variants: {
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      options: true,
      sku: true,
      price: true,
      oldPrice: true,
      stockQuantity: true,
      imageUrl: true,
      isDefault: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    take: 8,
  },
  reviews: {
    where: { status: ReviewStatus.APPROVED },
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      isVerifiedPurchase: true,
      createdAt: true,
      images: {
        select: {
          imageUrl: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        take: 1,
      },
      user: {
        select: {
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 12,
  },
} satisfies Prisma.ProductSelect;

type ProductDetailsRecord = Prisma.ProductGetPayload<{
  select: typeof productDetailsQuery;
}>;

const fallbackImage = allHomeProducts[0]?.imageUrl ?? "/next.svg";

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : value.toNumber();

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeVariantOptions(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const options: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string" && typeof rawValue !== "number" && typeof rawValue !== "boolean") {
      continue;
    }
    const key = rawKey.trim();
    const normalizedValue = String(rawValue).trim();
    if (!key || !normalizedValue) continue;
    options[key] = normalizedValue;
  }
  return options;
}

function mapRecordToProduct(record: ProductCardRecord): Product {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    category: record.category.name,
    brand: record.brand?.name ?? "Deal Bazaar",
    imageUrl: record.images[0]?.imageUrl ?? fallbackImage,
    price: Number(record.currentPrice),
    oldPrice: record.oldPrice ? Number(record.oldPrice) : undefined,
    rating: Number(record.averageRating),
    reviewsCount: record._count.reviews,
    inStock: record.stockQuantity > 0,
    isFeatured: record.featured,
    isBestSeller: record.bestSeller,
    isNewArrival: record.newArrival,
    shortDescription: record.shortDescription?.trim() || "Top-rated product from Deal Bazaar.",
  };
}

function maskReviewAuthor(record: ProductDetailsRecord["reviews"][number]) {
  const firstName = record.user?.profile?.firstName?.trim();
  const lastName = record.user?.profile?.lastName?.trim();

  if (firstName || lastName) {
    const firstMasked = firstName ? `${firstName.charAt(0).toUpperCase()}***` : "";
    const lastMasked = lastName ? `${lastName.charAt(0).toUpperCase()}***` : "";
    return [firstMasked, lastMasked].filter(Boolean).join(" ");
  }

  const email = record.user?.email?.trim();
  if (!email) return "Verified Customer";
  const localPart = email.split("@")[0] ?? "user";
  if (!localPart) return "Verified Customer";
  return `${localPart.charAt(0).toUpperCase()}***`;
}

function buildSpecifications(record: ProductDetailsRecord): ProductSpecification[] {
  const specs: ProductSpecification[] = [
    { label: "Brand", value: record.brand?.name ?? "Deal Bazaar" },
    { label: "Category", value: record.category.name },
    { label: "SKU", value: record.sku },
    { label: "Stock", value: record.stockQuantity > 0 ? "In stock" : "Out of stock" },
  ];

  const dynamic = new Map<string, string>();
  for (const value of record.attributeValues) {
    const label = value.attribute.name.trim();
    const content = value.value.trim();
    if (!label || !content) continue;
    if (!dynamic.has(label)) {
      dynamic.set(label, content);
    }
  }

  for (const [label, value] of dynamic.entries()) {
    specs.push({ label, value });
  }

  const firstVariant = record.variants.find((variant) => variant.isDefault) ?? record.variants[0];
  if (firstVariant) {
    const options = firstVariant.options;
    if (options && typeof options === "object" && !Array.isArray(options)) {
      for (const [key, value] of Object.entries(options)) {
        const normalizedLabel = key.trim();
        const normalizedValue =
          typeof value === "string" || typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : "";
        if (!normalizedLabel || !normalizedValue) continue;
        const alreadyIncluded = specs.some((spec) => spec.label.toLowerCase() === normalizedLabel.toLowerCase());
        if (!alreadyIncluded) {
          specs.push({ label: normalizedLabel, value: normalizedValue });
        }
      }
    }
  }

  return specs.slice(0, 12);
}

function buildReviewItems(record: ProductDetailsRecord): ProductReview[] {
  return record.reviews.map((review) => ({
    id: review.id,
    author: maskReviewAuthor(review),
    date: review.createdAt.toISOString().slice(0, 10),
    rating: review.rating,
    title: review.title?.trim() || "Customer feedback",
    body: review.comment?.trim() || "Customer shared a positive experience with this product.",
    isVerifiedPurchase: review.isVerifiedPurchase,
    image: review.images[0]?.imageUrl,
  }));
}

function buildFallbackDetails(product: Product): ProductDetailsContent {
  return {
    description:
      `${product.shortDescription}\n\nThis item is curated by Deal Bazaar with quality checks for performance, reliability, and shipping safety.`,
    galleryImages: [product.imageUrl],
    specifications: [
      { label: "Brand", value: product.brand },
      { label: "Category", value: product.category },
      { label: "Stock", value: product.inStock ? "In stock" : "Out of stock" },
      { label: "SKU", value: `DB-${product.id.toUpperCase()}` },
    ],
    reviews: [],
    storeName: `${product.brand} Official Store`,
    variants: [],
  };
}

function buildVariantItems(record: ProductDetailsRecord): ProductDetailsVariant[] {
  return record.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.name?.trim() || null,
    options: normalizeVariantOptions(variant.options),
    price: toNumber(variant.price),
    oldPrice: variant.oldPrice === null ? null : toNumber(variant.oldPrice),
    stockQuantity: variant.stockQuantity,
    imageUrl: variant.imageUrl?.trim() || null,
    isDefault: variant.isDefault,
  }));
}

function sortProducts(products: Product[], sortBy: ProductListQuery["sortBy"] = "popular") {
  return [...products].sort((a, b) => {
    if (sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "price_desc") return b.price - a.price;
    if (sortBy === "newest") return Number(Boolean(b.isNewArrival)) - Number(Boolean(a.isNewArrival));
    if (sortBy === "best_selling") return b.reviewsCount - a.reviewsCount || b.rating - a.rating;
    if (sortBy === "highest_rated") return b.rating - a.rating || b.reviewsCount - a.reviewsCount;
    return b.rating * b.reviewsCount - a.rating * a.reviewsCount;
  });
}

function filterMockProducts(query: ProductListQuery) {
  const search = query.search?.trim().toLowerCase();

  const filtered = allHomeProducts.filter((product) => {
    if (search) {
      const searchable = [product.name, product.shortDescription, product.category, product.brand]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(search)) return false;
    }

    if (query.minPrice !== undefined && product.price < query.minPrice) return false;
    if (query.maxPrice !== undefined && product.price > query.maxPrice) return false;
    if (query.categoryName && product.category.toLowerCase() !== query.categoryName.trim().toLowerCase()) {
      return false;
    }
    if (query.brandName && product.brand.toLowerCase() !== query.brandName.trim().toLowerCase()) {
      return false;
    }
    if (query.featured && !product.isFeatured) return false;
    if (query.newArrival && !product.isNewArrival) return false;
    if (query.bestSeller && !product.isBestSeller) return false;
    if (query.inStock && !product.inStock) return false;

    return true;
  });

  return sortProducts(filtered, query.sortBy).slice(0, 48);
}

export async function listProducts(query: ProductListQuery) {
  try {
    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { shortDescription: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.categoryName
        ? {
            category: {
              name: {
                equals: query.categoryName,
                mode: "insensitive",
              },
            },
          }
        : {}),
      ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
      ...(query.brandName
        ? {
            brand: {
              name: {
                equals: query.brandName,
                mode: "insensitive",
              },
            },
          }
        : {}),
      ...(query.featured ? { featured: true } : {}),
      ...(query.newArrival ? { newArrival: true } : {}),
      ...(query.bestSeller ? { bestSeller: true } : {}),
      ...(query.inStock ? { stockQuantity: { gt: 0 } } : {}),
      ...(query.minPrice || query.maxPrice
        ? {
            currentPrice: {
              ...(query.minPrice ? { gte: query.minPrice } : {}),
              ...(query.maxPrice ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sortBy === "price_asc"
        ? [{ currentPrice: "asc" }]
        : query.sortBy === "price_desc"
          ? [{ currentPrice: "desc" }]
          : query.sortBy === "newest"
            ? [{ createdAt: "desc" }]
            : query.sortBy === "best_selling"
              ? [{ totalSold: "desc" }]
              : query.sortBy === "highest_rated"
                ? [{ averageRating: "desc" }]
                : [{ popularityScore: "desc" }, { createdAt: "desc" }];

    const rows = await db.product.findMany({
      where,
      orderBy,
      select: productCardQuery,
      take: 48,
    });

    return rows.map(mapRecordToProduct);
  } catch {
    return filterMockProducts(query);
  }
}

type ShopFilterOptions = {
  categories: string[];
  brands: string[];
};

function getMockShopFilterOptions(): ShopFilterOptions {
  return {
    categories: Array.from(new Set(allHomeProducts.map((product) => product.category))).sort((a, b) =>
      a.localeCompare(b),
    ),
    brands: Array.from(new Set(allHomeProducts.map((product) => product.brand))).sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

export async function getShopFilterOptions(): Promise<ShopFilterOptions> {
  try {
    const [categories, brands] = await Promise.all([
      db.category.findMany({
        where: {
          isActive: true,
          products: {
            some: {
              status: "ACTIVE",
            },
          },
        },
        select: {
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      db.brand.findMany({
        where: {
          isActive: true,
          products: {
            some: {
              status: "ACTIVE",
            },
          },
        },
        select: {
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    if (categories.length === 0 && brands.length === 0) {
      return getMockShopFilterOptions();
    }

    return {
      categories: categories.map((item) => item.name),
      brands: brands.map((item) => item.name),
    };
  } catch {
    return getMockShopFilterOptions();
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const normalizedSlug = slug.trim().toLowerCase();

  try {
    const row = await db.product.findUnique({
      where: { slug: normalizedSlug },
      select: productCardQuery,
    });

    if (row) {
      return mapRecordToProduct(row);
    }
  } catch {
    // Fallback to mock data if database is unavailable.
  }

  return allHomeProducts.find((item) => item.slug === normalizedSlug) ?? null;
}

export async function getRelatedProducts(slug: string, categoryName: string, limit = 12) {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedCategory = categoryName.trim();

  try {
    if (normalizedCategory) {
      const rows = await db.product.findMany({
        where: {
          status: "ACTIVE",
          slug: { not: normalizedSlug },
          category: {
            name: {
              equals: normalizedCategory,
              mode: "insensitive",
            },
          },
        },
        orderBy: [{ popularityScore: "desc" }, { createdAt: "desc" }],
        select: productCardQuery,
        take: limit,
      });

      if (rows.length > 0) {
        return rows.map(mapRecordToProduct);
      }
    }
  } catch {
    // Fallback to mock data if database is unavailable.
  }

  return allHomeProducts.filter((item) => item.slug !== normalizedSlug).slice(0, limit);
}

export async function getProductDetailsContentBySlug(slug: string): Promise<ProductDetailsContent | null> {
  const normalizedSlug = slug.trim().toLowerCase();

  try {
    const row = await db.product.findUnique({
      where: { slug: normalizedSlug },
      select: productDetailsQuery,
    });

    if (row) {
      const description =
        row.description?.trim() ||
        `${row.shortDescription?.trim() || "Top-rated product from Deal Bazaar."}\n\nDeal Bazaar quality team validates this listing for authentic specs and safe delivery standards.`;

      const galleryImages = Array.from(
        new Set(row.images.map((image) => image.imageUrl).filter((imageUrl) => imageUrl.trim().length > 0)),
      );

      return {
        description,
        galleryImages: galleryImages.length > 0 ? galleryImages : [fallbackImage],
        specifications: buildSpecifications(row),
        reviews: buildReviewItems(row),
        storeName: `${row.brand?.name ?? "Deal Bazaar"} Official Store`,
        variants: buildVariantItems(row),
      };
    }
  } catch {
    // Fallback to mock data if database is unavailable.
  }

  const fallbackProduct = allHomeProducts.find((item) => item.slug === normalizedSlug);
  return fallbackProduct ? buildFallbackDetails(fallbackProduct) : null;
}
