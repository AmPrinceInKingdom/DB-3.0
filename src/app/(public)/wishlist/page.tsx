"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertFromBaseCurrency, roundMoney } from "@/lib/constants/exchange-rates";
import { formatCurrency } from "@/lib/utils";
import { buildCartLineId, useCartStore } from "@/store/cart-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import { useWishlistStore } from "@/store/wishlist-store";

export default function WishlistPage() {
  const currency = useUiPreferencesStore((state) => state.currency);
  const wishlistItems = useWishlistStore((state) => state.items);
  const removeItem = useWishlistStore((state) => state.removeItem);
  const clearWishlist = useWishlistStore((state) => state.clearWishlist);
  const addToCart = useCartStore((state) => state.addItem);

  if (!wishlistItems.length) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Heart className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Your wishlist is empty</h1>
          <p className="text-sm text-muted-foreground">
            Save products you like and come back to buy them later.
          </p>
        </div>
        <Button asChild>
          <Link href="/shop">Explore Products</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h1 className="text-2xl font-bold">Wishlist</h1>
          <p className="text-sm text-muted-foreground">
            {wishlistItems.length} saved item{wishlistItems.length === 1 ? "" : "s"} ready to buy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/compare">Go to Compare</Link>
          </Button>
          <Button variant="outline" type="button" onClick={clearWishlist}>
            Clear Wishlist
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {wishlistItems.map((item) => {
          const price = roundMoney(
            convertFromBaseCurrency(item.unitPriceBase, currency),
            currency === "LKR" ? 0 : 2,
          );
          const oldPrice =
            typeof item.oldPriceBase === "number"
              ? roundMoney(
                  convertFromBaseCurrency(item.oldPriceBase, currency),
                  currency === "LKR" ? 0 : 2,
                )
              : undefined;
          const hasDiscount = typeof oldPrice === "number" && oldPrice > price;

          return (
            <article
              key={item.productId}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <Link href={`/product/${item.slug}`} className="block">
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              </Link>

              <div className="space-y-3 p-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{item.brand}</p>
                  <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-semibold">
                    {item.name}
                  </Link>
                </div>

                <div className="flex items-end gap-2">
                  <p className="text-base font-bold text-primary">{formatCurrency(price, currency)}</p>
                  {hasDiscount && typeof oldPrice === "number" ? (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatCurrency(oldPrice, currency)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() =>
                      addToCart({
                        lineId: buildCartLineId(item.productId),
                        productId: item.productId,
                        slug: item.slug,
                        name: item.name,
                        brand: item.brand,
                        imageUrl: item.imageUrl,
                        unitPriceBase: item.unitPriceBase,
                        quantity: 1,
                      })
                    }
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to Cart
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeItem(item.productId)}
                    aria-label={`Remove ${item.name} from wishlist`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
