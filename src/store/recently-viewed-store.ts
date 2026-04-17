"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecentlyViewedItem } from "@/types/recently-viewed";

const maxItems = 30;

type RecentlyViewedState = {
  items: RecentlyViewedItem[];
  trackItem: (item: Omit<RecentlyViewedItem, "viewedAt">) => void;
  removeItem: (productId: string) => void;
  clearItems: () => void;
};

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      trackItem: (item) =>
        set((state) => {
          const nextItems = state.items.filter((entry) => entry.productId !== item.productId);
          return {
            items: [{ ...item, viewedAt: new Date().toISOString() }, ...nextItems].slice(
              0,
              maxItems,
            ),
          };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        })),
      clearItems: () => set({ items: [] }),
    }),
    { name: "deal-bazaar-recently-viewed" },
  ),
);
