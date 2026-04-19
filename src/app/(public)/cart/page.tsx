"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, Minus, Plus, ShoppingBag, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  convertFromBaseCurrency,
  getCurrencyDecimals,
  roundMoney,
} from "@/lib/constants/exchange-rates";
import { formatCurrency } from "@/lib/utils";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import { useCartStore } from "@/store/cart-store";

type CheckoutOptionsResponse = {
  shippingMethods: Array<{
    code: string;
    name: string;
    baseFeeLkr: number;
  }>;
  taxRatePercentage: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export default function CartPage() {
  const router = useRouter();
  const currency = useUiPreferencesStore((state) => state.currency);
  const [checkoutOptions, setCheckoutOptions] = useState<CheckoutOptionsResponse | null>(null);
  const items = useCartStore((state) => state.items);
  const savedItems = useCartStore((state) => state.savedItems);
  const selectedLineIds = useCartStore((state) => state.selectedLineIds);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const saveForLater = useCartStore((state) => state.saveForLater);
  const moveSavedToCart = useCartStore((state) => state.moveSavedToCart);
  const removeSavedItem = useCartStore((state) => state.removeSavedItem);
  const clearSavedItems = useCartStore((state) => state.clearSavedItems);
  const toggleSelection = useCartStore((state) => state.toggleSelection);
  const selectAll = useCartStore((state) => state.selectAll);
  const clearSelection = useCartStore((state) => state.clearSelection);

  const selectedSet = new Set(selectedLineIds);
  const selectedItems = items.filter((item) => selectedSet.has(item.lineId));
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const currencyDecimals = getCurrencyDecimals(currency);

  useEffect(() => {
    let isCancelled = false;

    const loadCheckoutOptions = async () => {
      try {
        const response = await fetch("/api/checkout/options", { cache: "no-store" });
        const payload = (await response.json()) as ApiEnvelope<CheckoutOptionsResponse>;
        if (!response.ok || !payload.success || !payload.data) return;
        if (isCancelled) return;
        setCheckoutOptions(payload.data);
      } catch {
        // Keep fallback pricing defaults when options are unavailable.
      }
    };

    void loadCheckoutOptions();

    return () => {
      isCancelled = true;
    };
  }, []);

  const taxRatePercentage = checkoutOptions?.taxRatePercentage ?? 8;
  const defaultShippingFeeLkr = checkoutOptions?.shippingMethods[0]?.baseFeeLkr ?? 450;

  const subtotal = roundMoney(
    selectedItems.reduce(
      (sum, item) =>
        sum + convertFromBaseCurrency(item.unitPriceBase, currency) * item.quantity,
      0,
    ),
    currencyDecimals,
  );
  const shippingFee =
    selectedItems.length === 0
      ? 0
      : convertFromBaseCurrency(defaultShippingFeeLkr, currency);
  const taxTotal = roundMoney(
    (subtotal + shippingFee) * (taxRatePercentage / 100),
    currencyDecimals,
  );
  const grandTotal = roundMoney(subtotal + shippingFee + taxTotal, currencyDecimals);

  if (!items.length && !savedItems.length) {
    return (
      <section className="space-y-5 rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Your cart is empty</h1>
          <p className="text-sm text-muted-foreground">
            Browse products and add items to continue with checkout.
          </p>
        </div>
        <Button asChild>
          <Link href="/shop">Continue Shopping</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Cart</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={allSelected ? clearSelection : selectAll}
                disabled={items.length === 0}
              >
                {allSelected ? "Unselect All" : "Select All"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={clearCart}
                disabled={items.length === 0}
              >
                Clear Cart
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {items.length > 0
              ? `Tick items you want to checkout. Selected: ${selectedItems.length}/${items.length}`
              : "No active cart items. Move products from saved for later to checkout."}
          </p>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background p-5 text-center">
              <p className="text-sm text-muted-foreground">Your active cart is empty right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const unitPrice = convertFromBaseCurrency(item.unitPriceBase, currency);
                const isSelected = selectedSet.has(item.lineId);

                return (
                  <article
                    key={item.lineId}
                    className="grid gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[32px_100px_minmax(0,1fr)]"
                  >
                    <label className="flex items-center justify-center sm:pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(item.lineId)}
                        className="h-4 w-4 accent-primary"
                        aria-label={`Select ${item.name} for checkout`}
                      />
                    </label>

                    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">{item.brand}</p>
                          <Link href={`/product/${item.slug}`} className="text-sm font-semibold hover:text-primary">
                            {item.name}
                          </Link>
                          {item.variantLabel ? (
                            <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => removeItem(item.lineId)}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center rounded-lg border border-border">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="px-2 text-sm font-semibold">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(unitPrice, currency)} each
                          </p>
                          <p className="text-base font-bold text-primary">
                            {formatCurrency(unitPrice * item.quantity, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => saveForLater(item.lineId)}
                        >
                          <Bookmark className="mr-2 h-4 w-4" />
                          Save for Later
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {savedItems.length > 0 ? (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Saved for Later</h2>
              <Button variant="outline" size="sm" type="button" onClick={clearSavedItems}>
                Clear Saved
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {savedItems.length} saved item{savedItems.length === 1 ? "" : "s"}.
            </p>

            <div className="space-y-3">
              {savedItems.map((item) => {
                const unitPrice = convertFromBaseCurrency(item.unitPriceBase, currency);
                return (
                  <article
                    key={`saved-${item.lineId}`}
                    className="grid gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[100px_minmax(0,1fr)]"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{item.brand}</p>
                        <Link href={`/product/${item.slug}`} className="text-sm font-semibold hover:text-primary">
                          {item.name}
                        </Link>
                        {item.variantLabel ? (
                          <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                        ) : null}
                      </div>
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(unitPrice, currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saved on {new Date(item.savedAt).toLocaleDateString()}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => moveSavedToCart(item.lineId)}
                        >
                          <Undo2 className="mr-2 h-4 w-4" />
                          Move to Cart
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => removeSavedItem(item.lineId)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active Cart Items</span>
            <span>{items.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Saved for Later</span>
            <span>{savedItems.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Selected Items</span>
            <span>{selectedItems.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shipping (Estimated)</span>
            <span>{formatCurrency(shippingFee, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax ({taxRatePercentage}%)</span>
            <span>{formatCurrency(taxTotal, currency)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(grandTotal, currency)}</span>
          </div>
        </div>

        <Button
          className="w-full"
          type="button"
          disabled={selectedItems.length === 0}
          onClick={() => router.push("/checkout")}
        >
          Proceed to Checkout
        </Button>
        {selectedItems.length === 0 ? (
          <p className="text-xs text-red-600">Select at least one product to continue checkout.</p>
        ) : null}
        <Button variant="outline" className="w-full" asChild>
          <Link href="/shop">Continue Shopping</Link>
        </Button>
      </aside>
    </div>
  );
}
