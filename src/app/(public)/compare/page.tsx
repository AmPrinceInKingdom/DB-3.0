"use client";

import Image from "next/image";
import Link from "next/link";
import { GitCompareArrows, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertFromBaseCurrency, roundMoney } from "@/lib/constants/exchange-rates";
import { formatCurrency } from "@/lib/utils";
import { buildCartLineId, useCartStore } from "@/store/cart-store";
import { useCompareStore } from "@/store/compare-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

const compareRows: Array<{ key: string; label: string }> = [
  { key: "price", label: "Price" },
  { key: "discount", label: "Discount" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "rating", label: "Rating" },
  { key: "availability", label: "Availability" },
  { key: "description", label: "Description" },
];

export default function ComparePage() {
  const currency = useUiPreferencesStore((state) => state.currency);
  const items = useCompareStore((state) => state.items);
  const removeItem = useCompareStore((state) => state.removeItem);
  const clearItems = useCompareStore((state) => state.clearItems);
  const addItemToCart = useCartStore((state) => state.addItem);

  if (!items.length) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GitCompareArrows className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">No products in compare</h1>
          <p className="text-sm text-muted-foreground">
            Add up to 4 products and compare features side-by-side.
          </p>
        </div>
        <Button asChild>
          <Link href="/shop">Browse Products</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h1 className="text-2xl font-bold">Compare Products</h1>
          <p className="text-sm text-muted-foreground">
            Comparing {items.length} product{items.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/shop">Add More Products</Link>
          </Button>
          <Button variant="outline" type="button" onClick={clearItems}>
            Clear Compare
          </Button>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="min-w-[960px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-48 border-b border-r border-border bg-card px-4 py-3 text-left text-sm font-semibold">
                Feature
              </th>
              {items.map((item) => {
                const convertedPrice = roundMoney(
                  convertFromBaseCurrency(item.unitPriceBase, currency),
                  currency === "LKR" ? 0 : 2,
                );

                return (
                  <th key={item.productId} className="w-64 border-b border-border px-4 py-3 align-top">
                    <div className="space-y-3">
                      <Link href={`/product/${item.slug}`} className="block space-y-2 text-left">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="256px"
                            className="object-cover"
                          />
                        </div>
                        <p className="line-clamp-2 text-sm font-semibold">{item.name}</p>
                      </Link>

                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(convertedPrice, currency)}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            addItemToCart({
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
                          Add
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeItem(item.productId)}
                          aria-label={`Remove ${item.name} from compare`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {compareRows.map((row) => (
              <tr key={row.key}>
                <td className="sticky left-0 z-10 border-r border-t border-border bg-card px-4 py-3 text-sm font-semibold">
                  {row.label}
                </td>
                {items.map((item) => {
                  const currentPrice = roundMoney(
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
                  const discountPercent =
                    typeof oldPrice === "number" && oldPrice > currentPrice
                      ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
                      : 0;

                  let value: string;
                  switch (row.key) {
                    case "price":
                      value = formatCurrency(currentPrice, currency);
                      break;
                    case "discount":
                      value = discountPercent > 0 ? `${discountPercent}% OFF` : "No discount";
                      break;
                    case "brand":
                      value = item.brand;
                      break;
                    case "category":
                      value = item.category;
                      break;
                    case "rating":
                      value = `${item.rating.toFixed(1)} (${item.reviewsCount} reviews)`;
                      break;
                    case "availability":
                      value = item.inStock ? "In stock" : "Out of stock";
                      break;
                    case "description":
                      value = item.shortDescription;
                      break;
                    default:
                      value = "-";
                  }

                  return (
                    <td
                      key={`${item.productId}-${row.key}`}
                      className="border-t border-border px-4 py-3 text-sm text-muted-foreground"
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
