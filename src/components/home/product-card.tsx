"use client";

import Image from "next/image";
import Link from "next/link";
import { GitCompareArrows, Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export function ProductCard({ product, currency = "LKR" }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleCompare = useCompareStore((state) => state.toggleItem);
  const compareItems = useCompareStore((state) => state.items);
  const isWishlisted = wishlistItems.some((item) => item.productId === product.id);
  const isCompared = compareItems.some((item) => item.productId === product.id);

  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)
    : 0;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block">
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </Link>

        <div className="absolute right-2 top-2 flex flex-col gap-2">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
            onClick={() =>
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
              })
            }
            aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          >
            <Heart
              className={`h-4 w-4 ${isWishlisted ? "fill-current text-primary" : "text-foreground/80"}`}
            />
          </Button>

          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
            onClick={() =>
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
              })
            }
            aria-label={isCompared ? "Remove from compare" : "Add to compare"}
          >
            <GitCompareArrows className={`h-4 w-4 ${isCompared ? "text-primary" : "text-foreground/80"}`} />
          </Button>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">{product.brand}</p>
        <Link href={`/product/${product.slug}`} className="line-clamp-2 text-sm font-semibold">
          {product.name}
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
            {product.rating.toFixed(1)}
          </span>
          <span>({product.reviewsCount})</span>
        </div>
        <div className="flex items-end gap-2">
          <p className="text-base font-bold">{formatCurrency(product.price, currency)}</p>
          {hasDiscount ? (
            <p className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.oldPrice!, currency)}
            </p>
          ) : null}
          {hasDiscount ? <Badge className="ml-auto">{discountPercent}% OFF</Badge> : null}
        </div>
        <Button
          className="mt-2 w-full"
          onClick={() =>
            addItem({
              lineId: buildCartLineId(product.id),
              productId: product.id,
              slug: product.slug,
              name: product.name,
              brand: product.brand,
              imageUrl: product.imageUrl,
              unitPriceBase: product.price,
            })
          }
        >
          Add to Cart
        </Button>
      </div>
    </article>
  );
}
