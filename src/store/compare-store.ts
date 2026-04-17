"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useToastStore } from "@/store/toast-store";
import type { CompareItem } from "@/types/compare";

const maxCompareItems = 4;

type CompareState = {
  items: CompareItem[];
  setItems: (items: CompareItem[]) => void;
  addItem: (item: Omit<CompareItem, "addedAt">) => void;
  removeItem: (productId: string) => void;
  toggleItem: (item: Omit<CompareItem, "addedAt">) => void;
  clearItems: () => void;
};

function normalizeCompareItems(items: CompareItem[]) {
  const byProductId = new Map<string, CompareItem>();

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

  return Array.from(byProductId.values())
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, maxCompareItems);
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      setItems: (items) => set({ items: normalizeCompareItems(items) }),
      addItem: (item) => {
        const state = get();
        const alreadyExists = state.items.some((entry) => entry.productId === item.productId);

        if (alreadyExists) {
          useToastStore.getState().pushToast(`${item.name} is already in compare list`, "info");
          return;
        }

        if (state.items.length >= maxCompareItems) {
          useToastStore
            .getState()
            .pushToast(`You can compare up to ${maxCompareItems} products`, "error");
          return;
        }

        set((current) => ({
          items: [{ ...item, addedAt: new Date().toISOString() }, ...current.items],
        }));
        useToastStore.getState().pushToast(`${item.name} added to compare`, "success");
      },
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        })),
      toggleItem: (item) => {
        const state = get();
        const alreadyExists = state.items.some((entry) => entry.productId === item.productId);

        if (alreadyExists) {
          set((current) => ({
            items: current.items.filter((entry) => entry.productId !== item.productId),
          }));
          useToastStore.getState().pushToast(`${item.name} removed from compare`, "info");
          return;
        }

        if (state.items.length >= maxCompareItems) {
          useToastStore
            .getState()
            .pushToast(`You can compare up to ${maxCompareItems} products`, "error");
          return;
        }

        set((current) => ({
          items: [{ ...item, addedAt: new Date().toISOString() }, ...current.items],
        }));
        useToastStore.getState().pushToast(`${item.name} added to compare`, "success");
      },
      clearItems: () => {
        set({ items: [] });
        useToastStore.getState().pushToast("Compare list cleared", "info");
      },
    }),
    { name: "deal-bazaar-compare" },
  ),
);
