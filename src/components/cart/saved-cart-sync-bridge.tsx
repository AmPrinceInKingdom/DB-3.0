"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCartStore } from "@/store/cart-store";
import type { SavedCartItem } from "@/types/cart";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type SavedCartPayload = {
  items: SavedCartItem[];
};

function toSyncPayload(items: SavedCartItem[]) {
  return {
    items: items.map((item) => ({
      lineId: item.lineId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      savedAt: item.savedAt,
    })),
  };
}

function mergeSavedItems(localItems: SavedCartItem[], serverItems: SavedCartItem[]) {
  const byLineId = new Map<string, SavedCartItem>();

  for (const item of [...serverItems, ...localItems]) {
    if (!item.lineId) continue;

    const existing = byLineId.get(item.lineId);
    if (!existing) {
      byLineId.set(item.lineId, item);
      continue;
    }

    const itemTime = new Date(item.savedAt).getTime();
    const existingTime = new Date(existing.savedAt).getTime();
    if (itemTime >= existingTime) {
      byLineId.set(item.lineId, item);
    }
  }

  return Array.from(byLineId.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

function buildHash(items: SavedCartItem[]) {
  const normalized = items
    .map((item) => ({
      lineId: item.lineId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      savedAt: item.savedAt,
    }))
    .sort((a, b) => a.lineId.localeCompare(b.lineId));
  return JSON.stringify(normalized);
}

async function fetchSavedItemsFromServer(): Promise<SavedCartItem[]> {
  const response = await fetch("/api/account/saved-cart", { cache: "no-store" });
  if (!response.ok) return [];

  const payload = (await response.json()) as ApiEnvelope<SavedCartPayload>;
  if (!payload.success || !payload.data?.items) return [];
  return payload.data.items;
}

async function syncSavedItemsToServer(items: SavedCartItem[]): Promise<SavedCartItem[]> {
  const response = await fetch("/api/account/saved-cart", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toSyncPayload(items)),
  });

  if (!response.ok) {
    throw new Error("Saved cart sync failed");
  }

  const payload = (await response.json()) as ApiEnvelope<SavedCartPayload>;
  if (!payload.success || !payload.data?.items) {
    throw new Error(payload.error ?? "Saved cart sync failed");
  }

  return payload.data.items;
}

export function SavedCartSyncBridge() {
  const savedItems = useCartStore((state) => state.savedItems);
  const setSavedItems = useCartStore((state) => state.setSavedItems);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const lastSyncedHashRef = useRef("");

  const syncAndSet = useCallback(
    async (items: SavedCartItem[]) => {
      const syncedItems = await syncSavedItemsToServer(items);
      setSavedItems(syncedItems);
      lastSyncedHashRef.current = buildHash(syncedItems);
    },
    [setSavedItems],
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
        if (!active) return;

        if (!authResponse.ok) {
          setIsAuthenticated(false);
          setIsReady(true);
          return;
        }

        setIsAuthenticated(true);

        const [localItems, serverItems] = await Promise.all([
          Promise.resolve(useCartStore.getState().savedItems),
          fetchSavedItemsFromServer(),
        ]);
        if (!active) return;

        const merged = mergeSavedItems(localItems, serverItems);
        setSavedItems(merged);

        await syncAndSet(merged);
      } catch {
        // Keep local-only mode when sync is not available.
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [setSavedItems, syncAndSet]);

  useEffect(() => {
    if (!isAuthenticated || !isReady) return;

    const currentHash = buildHash(savedItems);
    if (currentHash === lastSyncedHashRef.current) return;

    const timer = setTimeout(() => {
      void syncAndSet(savedItems).catch(() => {
        // Keep local state and retry on the next change.
      });
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [isAuthenticated, isReady, savedItems, syncAndSet]);

  return null;
}
