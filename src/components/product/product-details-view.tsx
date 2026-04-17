"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  GitCompareArrows,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { buildCartLineId, useCartStore } from "@/store/cart-store";
import { useCompareStore } from "@/store/compare-store";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";
import { useWishlistStore } from "@/store/wishlist-store";
import type {
  Product,
  ProductDetailsContent,
  ProductDetailsVariant,
  ProductReview,
} from "@/types/product";

type Props = {
  product: Product;
  related: Product[];
  details?: ProductDetailsContent;
  currency?: string;
};

type TabKey = "reviews" | "specs" | "description" | "store" | "more";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "reviews", label: "Customer Reviews" },
  { key: "specs", label: "Specifications" },
  { key: "description", label: "Description" },
  { key: "store", label: "Store" },
  { key: "more", label: "More to love" },
];

const sampleReviews: ProductReview[] = [
  {
    id: "r-1",
    author: "A***h",
    date: "2026-03-11",
    rating: 5,
    title: "Great value for the price",
    body: "Product quality is better than expected. Delivery was fast and package arrived safely.",
    isVerifiedPurchase: true,
  },
  {
    id: "r-2",
    author: "L***n",
    date: "2026-02-18",
    rating: 5,
    title: "Works exactly as described",
    body: "Tested it for daily usage and transfer speed is stable. Happy with the purchase.",
    isVerifiedPurchase: true,
  },
  {
    id: "r-3",
    author: "K***a",
    date: "2026-01-27",
    rating: 4,
    title: "Good but packaging could improve",
    body: "The item is original and functioning well. Packaging was average but no major damage.",
    isVerifiedPurchase: false,
  },
];

function renderStars(rating: number) {
  return Array.from({ length: 5 }).map((_, index) => (
    <Star
      key={`star-${rating}-${index + 1}`}
      className={cn(
        "h-4 w-4",
        index < Math.round(rating)
          ? "fill-amber-500 text-amber-500"
          : "fill-muted text-muted-foreground",
      )}
    />
  ));
}

function normalizeVariantOptionKey(value: string) {
  return value.trim().toLowerCase();
}

function getVariantOptionValue(
  options: Record<string, string>,
  normalizedKey: string,
) {
  const entry = Object.entries(options).find(
    ([key]) => normalizeVariantOptionKey(key) === normalizedKey,
  );
  return entry?.[1] ?? null;
}

function buildVariantLabel(variant: ProductDetailsVariant) {
  const explicitName = variant.name?.trim();
  if (explicitName) return explicitName;

  const optionText = Object.entries(variant.options)
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ");
  if (optionText) return optionText;

  return variant.sku;
}

export function ProductDetailsView({ product, related, details, currency = "LKR" }: Props) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const buyNowItem = useCartStore((state) => state.buyNowItem);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleCompare = useCompareStore((state) => state.toggleItem);
  const compareItems = useCompareStore((state) => state.items);
  const trackRecentlyViewed = useRecentlyViewedStore((state) => state.trackItem);
  const recentlyViewedItems = useRecentlyViewedStore((state) => state.items);

  const detailVariants = useMemo(() => details?.variants ?? [], [details?.variants]);
  const hasRealVariants = detailVariants.length > 0;
  const defaultVariantId = useMemo(
    () =>
      detailVariants.find((variant) => variant.isDefault)?.id ??
      detailVariants[0]?.id ??
      null,
    [detailVariants],
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(defaultVariantId);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("reviews");
  const [quantity, setQuantity] = useState(1);
  const [selectedStorage, setSelectedStorage] = useState("16TB");
  const [selectedColor, setSelectedColor] = useState("Silver");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedVariantId(defaultVariantId);
  }, [defaultVariantId]);

  const selectedVariant = useMemo(
    () =>
      detailVariants.find((variant) => variant.id === selectedVariantId) ??
      detailVariants[0] ??
      null,
    [detailVariants, selectedVariantId],
  );

  const variantOptionGroups = useMemo(() => {
    if (!hasRealVariants) return [] as Array<{ key: string; label: string; values: string[] }>;

    const groups = new Map<string, { label: string; values: Set<string> }>();
    for (const variant of detailVariants) {
      for (const [rawLabel, rawValue] of Object.entries(variant.options)) {
        const label = rawLabel.trim();
        const value = rawValue.trim();
        if (!label || !value) continue;

        const key = normalizeVariantOptionKey(label);
        const existing = groups.get(key);
        if (existing) {
          existing.values.add(value);
        } else {
          groups.set(key, {
            label,
            values: new Set([value]),
          });
        }
      }
    }

    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      label: group.label,
      values: Array.from(group.values),
    }));
  }, [detailVariants, hasRealVariants]);

  const selectedVariantOptionMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!selectedVariant) return map;

    for (const [key, value] of Object.entries(selectedVariant.options)) {
      map.set(normalizeVariantOptionKey(key), value);
    }
    return map;
  }, [selectedVariant]);

  const galleryImages = useMemo(() => {
    const pool = [
      selectedVariant?.imageUrl ?? "",
      ...(details?.galleryImages ?? []),
      product.imageUrl,
      ...related.map((item) => item.imageUrl),
    ].filter((imageUrl): imageUrl is string => Boolean(imageUrl && imageUrl.trim().length > 0));

    const unique = Array.from(new Set(pool));
    return unique.slice(0, 8);
  }, [details?.galleryImages, product.imageUrl, related, selectedVariant?.imageUrl]);

  useEffect(() => {
    setActiveImage(0);
  }, [selectedVariant?.id]);

  useEffect(() => {
    if (activeImage >= galleryImages.length) {
      setActiveImage(0);
    }
  }, [activeImage, galleryImages.length]);

  const resolvedPrice = selectedVariant?.price ?? product.price;
  const resolvedOldPrice = selectedVariant?.oldPrice ?? product.oldPrice ?? null;
  const resolvedInStock =
    hasRealVariants && selectedVariant
      ? selectedVariant.stockQuantity > 0
      : product.inStock;
  const resolvedVariantId =
    selectedVariant?.id ?? (hasRealVariants ? null : `${selectedStorage}-${selectedColor}`);
  const resolvedVariantLabel = selectedVariant
    ? buildVariantLabel(selectedVariant)
    : `Storage: ${selectedStorage} | Color: ${selectedColor}`;
  const resolvedImageUrl = selectedVariant?.imageUrl ?? product.imageUrl;
  const maxQuantityByStock = selectedVariant
    ? Math.max(1, Math.min(20, selectedVariant.stockQuantity || 1))
    : 20;

  useEffect(() => {
    setQuantity((current) => Math.max(1, Math.min(maxQuantityByStock, current)));
  }, [maxQuantityByStock]);

  const hasDiscount = !!(resolvedOldPrice && resolvedOldPrice > resolvedPrice);
  const discount = hasDiscount
    ? Math.round(((resolvedOldPrice! - resolvedPrice) / resolvedOldPrice!) * 100)
    : 0;
  const ratingBars = [
    { label: "Build quality", value: 92 },
    { label: "Value for money", value: 96 },
    { label: "Speed", value: 88 },
  ];

  const defaultSpecs = [
    { label: "Brand", value: product.brand },
    { label: "Category", value: product.category },
    ...(selectedVariant
      ? Object.entries(selectedVariant.options).map(([label, value]) => ({
          label,
          value,
        }))
      : [
          { label: "Storage", value: selectedStorage },
          { label: "Color", value: selectedColor },
        ]),
    { label: "Stock", value: resolvedInStock ? "In stock" : "Out of stock" },
    ...(selectedVariant ? [{ label: "Variant SKU", value: selectedVariant.sku }] : []),
    { label: "Delivery", value: "2-5 business days" },
    { label: "Warranty", value: "6 months seller warranty" },
    { label: "Return policy", value: "7-day return window" },
    { label: "SKU", value: `DB-${product.id.toUpperCase()}` },
  ];
  const specs = details?.specifications?.length ? details.specifications : defaultSpecs;
  const reviewItems = details?.reviews?.length ? details.reviews : sampleReviews;
  const descriptionParagraphs = useMemo(() => {
    const source = details?.description?.trim();
    if (!source) {
      return [
        `${product.shortDescription} Designed for daily high-speed usage, this product is optimized for consistent performance and compatibility with modern devices.`,
        "Deal Bazaar quality team validates this listing for authentic images, correct specs, and safe shipping standards. For best lifetime, avoid extreme heat and always eject storage devices safely before unplugging.",
      ];
    }
    const parts = source
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [source];
  }, [details?.description, product.shortDescription]);
  const storeName = details?.storeName?.trim() || `${product.brand} Official Store`;

  const canPurchase = resolvedInStock && (!hasRealVariants || Boolean(selectedVariant));
  const isWishlisted = wishlistItems.some((item) => item.productId === product.id);
  const isCompared = compareItems.some((item) => item.productId === product.id);
  const recentlyViewedOthers = recentlyViewedItems
    .filter((item) => item.productId !== product.id)
    .slice(0, 10);

  useEffect(() => {
    trackRecentlyViewed({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      imageUrl: product.imageUrl,
      unitPriceBase: product.price,
      oldPriceBase: product.oldPrice,
      rating: product.rating,
      inStock: product.inStock,
    });
  }, [
    product.brand,
    product.id,
    product.imageUrl,
    product.inStock,
    product.name,
    product.oldPrice,
    product.price,
    product.rating,
    product.slug,
    trackRecentlyViewed,
  ]);

  function handleAddToCart(quantityToAdd = 1) {
    if (!canPurchase) {
      setFeedbackMessage(
        hasRealVariants
          ? "Selected variant is out of stock"
          : "This product is currently out of stock",
      );
      return;
    }

    addItem({
      lineId: buildCartLineId(product.id, resolvedVariantId),
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      imageUrl: resolvedImageUrl,
      unitPriceBase: resolvedPrice,
      quantity: quantityToAdd,
      variantId: resolvedVariantId,
      variantLabel: resolvedVariantLabel,
    });

    setFeedbackMessage("Added to cart");
  }

  function handleBuyNow() {
    if (!canPurchase) {
      setFeedbackMessage(
        hasRealVariants
          ? "Selected variant is out of stock"
          : "This product is currently out of stock",
      );
      return;
    }

    buyNowItem({
      lineId: buildCartLineId(product.id, resolvedVariantId),
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      imageUrl: resolvedImageUrl,
      unitPriceBase: resolvedPrice,
      quantity,
      variantId: resolvedVariantId,
      variantLabel: resolvedVariantLabel,
    });
    router.push("/checkout");
  }

  function handleWishlistToggle() {
    toggleWishlist({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      imageUrl: product.imageUrl,
      unitPriceBase: product.price,
      oldPriceBase: product.oldPrice,
      rating: product.rating,
      inStock: product.inStock,
    });
  }

  function handleCompareToggle() {
    toggleCompare({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: product.imageUrl,
      unitPriceBase: product.price,
      oldPriceBase: product.oldPrice,
      rating: product.rating,
      reviewsCount: product.reviewsCount,
      inStock: product.inStock,
      shortDescription: product.shortDescription,
    });
  }

  function handleVariantOptionSelect(optionKey: string, optionValue: string) {
    if (!hasRealVariants || variantOptionGroups.length === 0) return;

    const nextSelection = new Map<string, string>();
    for (const group of variantOptionGroups) {
      const activeValue = selectedVariantOptionMap.get(group.key) ?? group.values[0];
      if (activeValue) {
        nextSelection.set(group.key, activeValue);
      }
    }
    nextSelection.set(optionKey, optionValue);

    const strictMatch = detailVariants.find((variant) =>
      Array.from(nextSelection.entries()).every(([normalizedKey, selectedValue]) => {
        const variantValue = getVariantOptionValue(variant.options, normalizedKey);
        return variantValue === selectedValue;
      }),
    );
    if (strictMatch) {
      setSelectedVariantId(strictMatch.id);
      return;
    }

    const looseMatch = detailVariants.find(
      (variant) => getVariantOptionValue(variant.options, optionKey) === optionValue,
    );
    if (looseMatch) {
      setSelectedVariantId(looseMatch.id);
    }
  }

  function decreaseQuantity() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(maxQuantityByStock, current + 1));
  }

  const renderReviewsSection = () => (
    <>
      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold">Reviews</h2>
          <div className="flex items-center gap-1">{renderStars(product.rating)}</div>
          <p className="text-lg font-semibold">{product.rating.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">{product.reviewsCount} verified ratings</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {ratingBars.map((bar) => (
            <div key={bar.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{bar.label}</p>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${bar.value}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {galleryImages.slice(0, 3).map((image, index) => (
            <div
              key={`review-gallery-${index + 1}`}
              className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted"
            >
              <Image
                src={image}
                alt={`Customer photo ${index + 1}`}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        {reviewItems.map((review) => (
          <Card key={review.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{review.author}</p>
                <p className="text-xs text-muted-foreground">{review.date}</p>
              </div>
              <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
            </div>
            {review.isVerifiedPurchase ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Verified Purchase
              </Badge>
            ) : null}
            <p className="font-semibold">{review.title}</p>
            <p className="text-sm text-muted-foreground">{review.body}</p>
            {review.image ? (
              <div className="relative h-28 w-28 overflow-hidden rounded-lg border border-border bg-muted">
                <Image
                  src={review.image}
                  alt={`${review.author} review`}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );

  const renderSpecsSection = () => (
    <Card className="p-5">
      <h2 className="text-2xl font-bold">Specifications</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        {specs.map((spec, index) => (
          <div
            key={spec.label}
            className={cn(
              "grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[180px_minmax(0,1fr)]",
              index % 2 === 0 ? "bg-muted/45" : "bg-background",
            )}
          >
            <p className="text-sm font-semibold">{spec.label}</p>
            <p className="text-sm text-muted-foreground">{spec.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderDescriptionSection = () => (
    <Card className="space-y-4 p-5">
      <h2 className="text-2xl font-bold">Description</h2>
      {descriptionParagraphs.map((paragraph, index) => (
        <p key={`desc-${index + 1}`} className="text-sm leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}
    </Card>
  );

  const renderStoreSection = () => (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{storeName}</h2>
          <p className="text-sm text-muted-foreground">97.8% positive feedback - 1,204 followers</p>
        </div>
        <Button variant="outline" size="sm">
          <MessageCircle className="mr-2 h-4 w-4" />
          Message
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3 text-center">
          <p className="text-xl font-bold">2.1K+</p>
          <p className="text-xs text-muted-foreground">Orders served</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold">24h</p>
          <p className="text-xs text-muted-foreground">Avg. response time</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold">6mo</p>
          <p className="text-xs text-muted-foreground">Warranty support</p>
        </Card>
      </div>
    </Card>
  );

  const renderMoreToLoveSection = () => (
    <>
      {recentlyViewedOthers.length > 0 ? (
        <Card className="space-y-4 p-5">
          <h2 className="text-2xl font-bold">Recently viewed</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentlyViewedOthers.map((item) => (
              <Link
                key={`recent-${item.productId}`}
                href={`/product/${item.slug}`}
                className="w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50"
              >
                <div className="relative aspect-square bg-muted">
                  <Image src={item.imageUrl} alt={item.name} fill sizes="160px" className="object-cover" />
                </div>
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 min-h-8 text-xs font-semibold">{item.name}</p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(item.unitPriceBase, currency)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4 p-5">
        <h2 className="text-2xl font-bold">More to love</h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {related.slice(0, 10).map((item) => (
            <Link
              key={item.id}
              href={`/product/${item.slug}`}
              className="w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50"
            >
              <div className="relative aspect-square bg-muted">
                <Image src={item.imageUrl} alt={item.name} fill sizes="160px" className="object-cover" />
              </div>
              <div className="space-y-1 p-2">
                <p className="line-clamp-2 min-h-8 text-xs font-semibold">{item.name}</p>
                <p className="text-sm font-bold text-primary">{formatCurrency(item.price, currency)}</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="grid gap-5 md:grid-cols-[84px_minmax(0,1fr)]">
              <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image}-${index + 1}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={cn(
                      "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted transition",
                      index === activeImage
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} preview ${index + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>

              <div className="order-1 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                  <Image
                    src={galleryImages[activeImage] ?? product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="object-cover"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Welcome Deal</Badge>
                    <Badge
                      className={
                        resolvedInStock
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-red-500/15 text-red-700 dark:text-red-300"
                      }
                    >
                      {resolvedInStock ? "In Stock" : "Out of stock"}
                    </Badge>
                    {hasDiscount ? (
                      <Badge className="bg-primary/15 text-primary">-{discount}% OFF</Badge>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {product.brand} / {product.category}
                    </p>
                    <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                      {product.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">{product.shortDescription}</p>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      Deal Price
                    </p>
                    <div className="mt-1 flex items-end gap-2">
                      <p className="text-3xl font-bold text-primary">
                        {formatCurrency(resolvedPrice, currency)}
                      </p>
                      {hasDiscount ? (
                        <p className="pb-1 text-sm text-muted-foreground line-through">
                          {formatCurrency(resolvedOldPrice!, currency)}
                        </p>
                      ) : null}
                    </div>
                    {selectedVariant ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Variant SKU: {selectedVariant.sku}
                        {` | Stock: ${selectedVariant.stockQuantity}`}
                      </p>
                    ) : null}
                  </div>

                  {hasRealVariants && variantOptionGroups.length > 0 ? (
                    variantOptionGroups.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <p className="text-sm font-semibold">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.values.map((value) => {
                            const isActive = selectedVariantOptionMap.get(group.key) === value;
                            return (
                              <button
                                key={`${group.key}-${value}`}
                                type="button"
                                onClick={() => handleVariantOptionSelect(group.key, value)}
                                className={cn(
                                  "rounded-lg border px-3 py-1.5 text-sm transition",
                                  isActive
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-background hover:border-primary/50",
                                )}
                              >
                                {value}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Storage</p>
                        <div className="flex flex-wrap gap-2">
                          {["8TB", "16TB", "32TB", "64TB"].map((storage) => (
                            <button
                              key={storage}
                              type="button"
                              onClick={() => setSelectedStorage(storage)}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-sm transition",
                                storage === selectedStorage
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background hover:border-primary/50",
                              )}
                            >
                              {storage}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Color</p>
                        <div className="flex flex-wrap gap-2">
                          {["Silver", "Space Gray", "Red"].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setSelectedColor(color)}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-sm transition",
                                color === selectedColor
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background hover:border-primary/50",
                              )}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid gap-2 rounded-xl border border-border bg-background p-3 text-sm">
                    <p className="inline-flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      Free shipping over {formatCurrency(10000, currency)}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Secure payment and verified seller support
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 lg:hidden">
            <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Quick buy</p>
                <p className="mt-1 text-xl font-bold text-primary">
                  {formatCurrency(resolvedPrice, currency)}
                </p>
              </div>
              {hasDiscount ? (
                <p className="text-xs text-muted-foreground line-through">
                  {formatCurrency(resolvedOldPrice!, currency)}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Quantity</p>
              <div className="flex items-center justify-between rounded-xl border border-border px-2 py-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={decreaseQuantity}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{quantity}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={increaseQuantity}
                  disabled={quantity >= maxQuantityByStock}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" onClick={handleBuyNow} disabled={!canPurchase}>
                <Zap className="mr-2 h-4 w-4" />
                Buy now
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleAddToCart(quantity)}
                disabled={!canPurchase}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to cart
              </Button>
              <Button type="button" variant="outline" onClick={handleWishlistToggle}>
                <Heart className={`mr-2 h-4 w-4 ${isWishlisted ? "fill-current text-primary" : ""}`} />
                {isWishlisted ? "Saved" : "Wishlist"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCompareToggle}>
                <GitCompareArrows className={`mr-2 h-4 w-4 ${isCompared ? "text-primary" : ""}`} />
                {isCompared ? "Compared" : "Compare"}
              </Button>
            </div>

            {feedbackMessage ? (
              <p className="text-xs font-medium text-emerald-600">{feedbackMessage}</p>
            ) : null}
          </section>

          <div className="space-y-3 md:hidden">
            <details open className="rounded-2xl border border-border bg-card p-3">
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Customer Reviews
              </summary>
              <div className="mt-3 space-y-4">{renderReviewsSection()}</div>
            </details>

            <details className="rounded-2xl border border-border bg-card p-3">
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Specifications
              </summary>
              <div className="mt-3 space-y-4">{renderSpecsSection()}</div>
            </details>

            <details className="rounded-2xl border border-border bg-card p-3">
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Description
              </summary>
              <div className="mt-3 space-y-4">{renderDescriptionSection()}</div>
            </details>

            <details className="rounded-2xl border border-border bg-card p-3">
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Store
              </summary>
              <div className="mt-3 space-y-4">{renderStoreSection()}</div>
            </details>

            <details className="rounded-2xl border border-border bg-card p-3">
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                More to love
              </summary>
              <div className="mt-3 space-y-4">{renderMoreToLoveSection()}</div>
            </details>
          </div>

          <nav className="sticky top-16 z-20 hidden overflow-x-auto rounded-2xl border border-border bg-card sm:top-[74px] md:block">
            <div className="flex min-w-max items-center gap-2 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          <section
            className={cn(
              "space-y-4 hidden md:block",
              activeTab === "reviews" ? "md:block" : "md:hidden",
            )}
          >
            {renderReviewsSection()}
          </section>

          <section
            className={cn(
              "space-y-4 hidden md:block",
              activeTab === "specs" ? "md:block" : "md:hidden",
            )}
          >
            {renderSpecsSection()}
          </section>

          <section
            className={cn(
              "space-y-4 hidden md:block",
              activeTab === "description" ? "md:block" : "md:hidden",
            )}
          >
            {renderDescriptionSection()}
          </section>

          <section
            className={cn(
              "space-y-4 hidden md:block",
              activeTab === "store" ? "md:block" : "md:hidden",
            )}
          >
            {renderStoreSection()}
          </section>

          <section
            className={cn(
              "space-y-4 hidden md:block",
              activeTab === "more" ? "md:block" : "md:hidden",
            )}
          >
            {renderMoreToLoveSection()}
          </section>
        </div>

        <aside className="hidden h-fit space-y-4 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-24 lg:block">
          <div className="space-y-2 border-b border-border pb-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Quick buy</p>
            <p className="line-clamp-2 text-sm font-semibold">{product.name}</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(resolvedPrice, currency)}
              </p>
              {hasDiscount ? (
                <p className="text-xs text-muted-foreground line-through">
                  {formatCurrency(resolvedOldPrice!, currency)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Quantity</p>
            <div className="flex items-center justify-between rounded-xl border border-border px-2 py-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={decreaseQuantity}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">{quantity}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={increaseQuantity}
                disabled={quantity >= maxQuantityByStock}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Button type="button" className="w-full" onClick={handleBuyNow} disabled={!canPurchase}>
              <Zap className="mr-2 h-4 w-4" />
              Buy now
            </Button>
            <Button
              type="button"
              className="w-full"
              variant="secondary"
              onClick={() => handleAddToCart(quantity)}
              disabled={!canPurchase}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to cart
            </Button>
            <Button type="button" className="w-full" variant="outline" onClick={handleWishlistToggle}>
              <Heart className={`mr-2 h-4 w-4 ${isWishlisted ? "fill-current text-primary" : ""}`} />
              {isWishlisted ? "Saved in wishlist" : "Save to wishlist"}
            </Button>
            <Button type="button" className="w-full" variant="outline" onClick={handleCompareToggle}>
              <GitCompareArrows className={`mr-2 h-4 w-4 ${isCompared ? "text-primary" : ""}`} />
              {isCompared ? "Added to compare" : "Add to compare"}
            </Button>
            {feedbackMessage ? (
              <p className="text-xs font-medium text-emerald-600">{feedbackMessage}</p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
            <p className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Delivery between Apr 19 - Apr 25
            </p>
            <p className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure payment protection
            </p>
            <p className="inline-flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              Sold by verified seller
            </p>
          </div>

          <Link
            href="/help-center"
            className="inline-flex items-center text-sm font-semibold text-primary hover:text-accent"
          >
            View delivery & return policy
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

