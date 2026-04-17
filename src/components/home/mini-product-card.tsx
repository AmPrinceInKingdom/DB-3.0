"use client";

import Image from "next/image";
import Link from "next/link";
import { GitCompareArrows, Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { buildCartLineId, useCartStore } from "@/store/cart-store";
import { useCompareStore } from "@/store/compare-store";
import { useWishlistStore } from "@/store/wishlist-store";
import type { Product } from "@/types/product";

type Props = {
  product: Product;
  currency?: string;
};

export function MiniProductCard({ product, currency = "LKR" }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleCompare = useCompareStore((state) => state.toggleItem);
  const compareItems = useCompareStore((state) => state.items);
  const isWishlisted = wishlistItems.some((item) => item.productId === product.id);
  const isCompared = compareItems.some((item) => item.productId === product.id);
  const hasDiscount = !!(product.oldPrice && product.oldPrice > product.price);
  const discount = hasDiscount
    ? Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)
    : 0;

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-sm">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 16vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {hasDiscount ? (
            <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
              -{discount}%
            </span>
          ) : null}

          <div className="absolute right-2 top-2 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full border border-border/70 bg-background/90 p-0 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
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
              }}
              aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
            >
              <Heart
                className={`h-3 w-3 ${isWishlisted ? "fill-current text-primary" : "text-foreground/80"}`}
              />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full border border-border/70 bg-background/90 p-0 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
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
              }}
              aria-label={isCompared ? "Remove from compare" : "Add to compare"}
            >
              <GitCompareArrows className={`h-3 w-3 ${isCompared ? "text-primary" : "text-foreground/80"}`} />
            </Button>
          </div>
        </div>
      </Link>

      <div className="space-y-2 p-2.5">
        <Link
          href={`/product/${product.slug}`}
          className="line-clamp-2 min-h-9 text-xs font-semibold leading-4"
        >
          {product.name}
        </Link>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3 fill-current text-amber-500" />
          <span>{product.rating.toFixed(1)}</span>
          <span>({product.reviewsCount})</span>
        </div>

        <div className="flex items-end gap-1.5">
          <p className="text-sm font-bold text-primary">
            {formatCurrency(product.price, currency)}
          </p>
          {hasDiscount ? (
            <p className="text-[11px] text-muted-foreground line-through">
              {formatCurrency(product.oldPrice!, currency)}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          size="sm"
          className="h-8 w-full rounded-lg text-xs"
          onClick={() =>
            addItem({
              lineId: buildCartLineId(product.id),
              productId: product.id,
              slug: product.slug,
              name: product.name,
              brand: product.brand,
              imageUrl: product.imageUrl,
              unitPriceBase: product.price,
              quantity: 1,
            })
          }
        >
          Add to cart
        </Button>
      </div>
    </article>
  );
}
