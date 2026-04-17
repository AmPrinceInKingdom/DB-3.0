"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLineItem, SavedCartItem } from "@/types/cart";
import { useToastStore } from "@/store/toast-store";

type CartState = {
  items: CartLineItem[];
  savedItems: SavedCartItem[];
  selectedLineIds: string[];
  setSavedItems: (items: SavedCartItem[]) => void;
  addItem: (item: Omit<CartLineItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (lineId: string) => void;
  removeMany: (lineIds: string[]) => void;
  saveForLater: (lineId: string) => void;
  moveSavedToCart: (lineId: string) => void;
  removeSavedItem: (lineId: string) => void;
  clearSavedItems: () => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  toggleSelection: (lineId: string) => void;
  setSelectionOnly: (lineId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  buyNowItem: (item: Omit<CartLineItem, "quantity"> & { quantity: number }) => void;
  clearCart: () => void;
  getSubtotalBase: () => number;
  getTotalItems: () => number;
};

const maxQuantityPerLine = 20;

export function buildCartLineId(productId: string, variantId?: string | null) {
  return variantId ? `${productId}::${variantId}` : productId;
}

function toCartLineItem(item: SavedCartItem): CartLineItem {
  return {
    lineId: item.lineId,
    productId: item.productId,
    slug: item.slug,
    name: item.name,
    brand: item.brand,
    imageUrl: item.imageUrl,
    quantity: item.quantity,
    unitPriceBase: item.unitPriceBase,
    variantId: item.variantId,
    variantLabel: item.variantLabel,
  };
}

function normalizeSavedItems(items: SavedCartItem[]): SavedCartItem[] {
  const byLineId = new Map<string, SavedCartItem>();

  for (const item of items) {
    if (!item.lineId) continue;

    const normalizedItem: SavedCartItem = {
      ...item,
      quantity: Math.max(1, Math.min(maxQuantityPerLine, item.quantity)),
      savedAt:
        item.savedAt && !Number.isNaN(new Date(item.savedAt).getTime())
          ? new Date(item.savedAt).toISOString()
          : new Date().toISOString(),
    };

    const existing = byLineId.get(item.lineId);
    if (!existing) {
      byLineId.set(item.lineId, normalizedItem);
      continue;
    }

    const itemTime = new Date(normalizedItem.savedAt).getTime();
    const existingTime = new Date(existing.savedAt).getTime();
    if (itemTime >= existingTime) {
      byLineId.set(item.lineId, normalizedItem);
    }
  }

  return Array.from(byLineId.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      savedItems: [],
      selectedLineIds: [],
      setSavedItems: (items) => set({ savedItems: normalizeSavedItems(items) }),
      addItem: (item) => {
        const quantityToAdd = item.quantity ?? 1;

        set((state) => {
          const existing = state.items.find((line) => line.lineId === item.lineId);
          const savedItems = state.savedItems.filter((savedItem) => savedItem.lineId !== item.lineId);

          if (existing) {
            return {
              items: state.items.map((line) =>
                line.lineId === item.lineId
                  ? {
                      ...line,
                      quantity: Math.min(maxQuantityPerLine, line.quantity + quantityToAdd),
                    }
                  : line,
              ),
              selectedLineIds: Array.from(new Set([...state.selectedLineIds, item.lineId])),
              savedItems,
            };
          }

          return {
            items: [
              ...state.items,
              {
                ...item,
                quantity: Math.min(maxQuantityPerLine, Math.max(1, quantityToAdd)),
              },
            ],
            selectedLineIds: Array.from(new Set([...state.selectedLineIds, item.lineId])),
            savedItems,
          };
        });

        useToastStore.getState().pushToast(`${item.name} added to cart`, "success");
      },
      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter((item) => item.lineId !== lineId),
          selectedLineIds: state.selectedLineIds.filter((id) => id !== lineId),
        })),
      removeMany: (lineIds) =>
        set((state) => {
          const removeSet = new Set(lineIds);
          return {
            items: state.items.filter((item) => !removeSet.has(item.lineId)),
            selectedLineIds: state.selectedLineIds.filter((id) => !removeSet.has(id)),
          };
        }),
      saveForLater: (lineId) => {
        const line = get().items.find((item) => item.lineId === lineId);
        if (!line) return;

        set((state) => {
          const filteredSaved = state.savedItems.filter((item) => item.lineId !== lineId);
          return {
            items: state.items.filter((item) => item.lineId !== lineId),
            selectedLineIds: state.selectedLineIds.filter((id) => id !== lineId),
            savedItems: normalizeSavedItems([
              { ...line, savedAt: new Date().toISOString() },
              ...filteredSaved,
            ]),
          };
        });

        useToastStore.getState().pushToast(`${line.name} saved for later`, "info");
      },
      moveSavedToCart: (lineId) => {
        const saved = get().savedItems.find((item) => item.lineId === lineId);
        if (!saved) return;

        set((state) => {
          const filteredSaved = state.savedItems.filter((item) => item.lineId !== lineId);
          const existingInCart = state.items.find((item) => item.lineId === lineId);

          if (existingInCart) {
            return {
              items: state.items.map((item) =>
                item.lineId === lineId
                  ? {
                      ...item,
                      quantity: Math.min(maxQuantityPerLine, item.quantity + saved.quantity),
                    }
                  : item,
              ),
              selectedLineIds: Array.from(new Set([...state.selectedLineIds, lineId])),
              savedItems: filteredSaved,
            };
          }

          return {
            items: [...state.items, toCartLineItem(saved)],
            selectedLineIds: Array.from(new Set([...state.selectedLineIds, lineId])),
            savedItems: filteredSaved,
          };
        });

        useToastStore.getState().pushToast(`${saved.name} moved to cart`, "success");
      },
      removeSavedItem: (lineId) =>
        set((state) => ({
          savedItems: state.savedItems.filter((item) => item.lineId !== lineId),
        })),
      clearSavedItems: () => {
        set({ savedItems: [] });
        useToastStore.getState().pushToast("Saved for later cleared", "info");
      },
      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.lineId === lineId
              ? {
                  ...item,
                  quantity: Math.min(maxQuantityPerLine, Math.max(1, quantity)),
                }
              : item,
          ),
        })),
      toggleSelection: (lineId) =>
        set((state) => {
          const existsInCart = state.items.some((item) => item.lineId === lineId);
          if (!existsInCart) return state;

          const exists = state.selectedLineIds.includes(lineId);
          return {
            selectedLineIds: exists
              ? state.selectedLineIds.filter((id) => id !== lineId)
              : [...state.selectedLineIds, lineId],
          };
        }),
      setSelectionOnly: (lineId) =>
        set((state) => ({
          selectedLineIds: state.items.some((item) => item.lineId === lineId) ? [lineId] : [],
        })),
      selectAll: () => set((state) => ({ selectedLineIds: state.items.map((item) => item.lineId) })),
      clearSelection: () => set({ selectedLineIds: [] }),
      buyNowItem: (item) => {
        set((state) => {
          const existing = state.items.find((line) => line.lineId === item.lineId);
          const savedItems = state.savedItems.filter((savedItem) => savedItem.lineId !== item.lineId);

          if (existing) {
            return {
              items: state.items.map((line) =>
                line.lineId === item.lineId
                  ? {
                      ...line,
                      ...item,
                      quantity: Math.min(maxQuantityPerLine, Math.max(1, item.quantity)),
                    }
                  : line,
              ),
              selectedLineIds: [item.lineId],
              savedItems,
            };
          }

          return {
            items: [
              ...state.items,
              {
                ...item,
                quantity: Math.min(maxQuantityPerLine, Math.max(1, item.quantity)),
              },
            ],
            selectedLineIds: [item.lineId],
            savedItems,
          };
        });

        useToastStore.getState().pushToast("Ready to checkout this product", "info");
      },
      clearCart: () => set({ items: [], selectedLineIds: [] }),
      getSubtotalBase: () =>
        get().items.reduce((sum, item) => sum + item.unitPriceBase * item.quantity, 0),
      getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "deal-bazaar-cart" },
  ),
);
