"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertFromBaseCurrency, roundMoney } from "@/lib/constants/exchange-rates";
import { formatCurrency } from "@/lib/utils";
import { buildCartLineId, useCartStore } from "@/store/cart-store";
import { useRecentlyViewedStore } from "@/store/recently-viewed-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

export function RecentlyViewedManager() {
  const currency = useUiPreferencesStore((state) => state.currency);
  const items = useRecentlyViewedStore((state) => state.items);
  const removeItem = useRecentlyViewedStore((state) => state.removeItem);
  const clearItems = useRecentlyViewedStore((state) => state.clearItems);
  const addToCart = useCartStore((state) => state.addItem);

  if (!items.length) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Eye className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">No recently viewed products</h1>
          <p className="text-sm text-muted-foreground">
            Browse products and your recent history will appear here.
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
          <h1 className="text-2xl font-bold">Recently Viewed</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} product{items.length === 1 ? "" : "s"} from your latest browsing session.
          </p>
        </div>
        <Button variant="outline" type="button" onClick={clearItems}>
          Clear History
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
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
            <article key={item.productId} className="overflow-hidden rounded-2xl border border-border bg-card">
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

                <p className="text-xs text-muted-foreground">
                  Viewed on {new Date(item.viewedAt).toLocaleDateString()}
                </p>

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
                    aria-label={`Remove ${item.name} from recently viewed`}
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
