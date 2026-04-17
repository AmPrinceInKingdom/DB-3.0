"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useToastStore } from "@/store/toast-store";
import type { WishlistItem } from "@/types/wishlist";

type WishlistState = {
  items: WishlistItem[];
  setItems: (items: WishlistItem[]) => void;
  addItem: (item: Omit<WishlistItem, "addedAt">) => void;
  removeItem: (productId: string) => void;
  toggleItem: (item: Omit<WishlistItem, "addedAt">) => void;
  clearWishlist: () => void;
};

function normalizeWishlistItems(items: WishlistItem[]) {
  const byProductId = new Map<string, WishlistItem>();

  for (const item of items) {
    const existing = byProductId.get(item.productId);
    if (!existing) {
      byProductId.set(item.productId, item);
      continue;
    }

    const existingAt = new Date(existing.addedAt).getTime();
    const itemAt = new Date(item.addedAt).getTime();
    if (itemAt >= existingAt) {
      byProductId.set(item.productId, item);
    }
  }

  return Array.from(byProductId.values()).sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  );
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      setItems: (items) => set({ items: normalizeWishlistItems(items) }),
      addItem: (item) => {
        const alreadyExists = get().items.some((entry) => entry.productId === item.productId);
        if (alreadyExists) {
          useToastStore.getState().pushToast(`${item.name} is already in wishlist`, "info");
          return;
        }

        set((state) => ({
          items: [{ ...item, addedAt: new Date().toISOString() }, ...state.items],
        }));
        useToastStore.getState().pushToast(`${item.name} saved to wishlist`, "success");
      },
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        })),
      toggleItem: (item) => {
        const alreadyExists = get().items.some((entry) => entry.productId === item.productId);

        if (alreadyExists) {
          set((state) => ({
            items: state.items.filter((entry) => entry.productId !== item.productId),
          }));
          useToastStore.getState().pushToast(`${item.name} removed from wishlist`, "info");
          return;
        }

        set((state) => ({
          items: [{ ...item, addedAt: new Date().toISOString() }, ...state.items],
        }));
        useToastStore.getState().pushToast(`${item.name} saved to wishlist`, "success");
      },
      clearWishlist: () => {
        set({ items: [] });
        useToastStore.getState().pushToast("Wishlist cleared", "info");
      },
    }),
    { name: "deal-bazaar-wishlist" },
  ),
);
