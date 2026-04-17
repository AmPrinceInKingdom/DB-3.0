"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCompareStore } from "@/store/compare-store";
import { useWishlistStore } from "@/store/wishlist-store";
import type { WishlistItem } from "@/types/wishlist";
import type { CompareItem } from "@/types/compare";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type WishlistPayload = {
  items: WishlistItem[];
};

type ComparePayload = {
  items: CompareItem[];
};

const maxCompareItems = 4;

function mergeWishlist(localItems: WishlistItem[], serverItems: WishlistItem[]) {
  const byProductId = new Map<string, WishlistItem>();

  for (const item of [...serverItems, ...localItems]) {
    if (!item.productId) continue;
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

function mergeCompare(localItems: CompareItem[], serverItems: CompareItem[]) {
  const byProductId = new Map<string, CompareItem>();

  for (const item of [...serverItems, ...localItems]) {
    if (!item.productId) continue;
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

function buildWishlistHash(items: WishlistItem[]) {
  return JSON.stringify(
    items
      .map((item) => ({ productId: item.productId, addedAt: item.addedAt }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
  );
}

function buildCompareHash(items: CompareItem[]) {
  return JSON.stringify(
    items
      .map((item) => ({ productId: item.productId, addedAt: item.addedAt }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
  );
}

async function fetchWishlist(): Promise<WishlistItem[]> {
  const response = await fetch("/api/account/wishlist", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as ApiEnvelope<WishlistPayload>;
  return payload.success && payload.data?.items ? payload.data.items : [];
}

async function fetchCompare(): Promise<CompareItem[]> {
  const response = await fetch("/api/account/compare", { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as ApiEnvelope<ComparePayload>;
  return payload.success && payload.data?.items ? payload.data.items : [];
}

async function syncWishlist(items: WishlistItem[]): Promise<WishlistItem[]> {
  const response = await fetch("/api/account/wishlist", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((item) => ({
        productId: item.productId,
        addedAt: item.addedAt,
      })),
    }),
  });
  if (!response.ok) throw new Error("Wishlist sync failed");

  const payload = (await response.json()) as ApiEnvelope<WishlistPayload>;
  if (!payload.success || !payload.data?.items) {
    throw new Error(payload.error ?? "Wishlist sync failed");
  }

  return payload.data.items;
}

async function syncCompare(items: CompareItem[]): Promise<CompareItem[]> {
  const response = await fetch("/api/account/compare", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((item) => ({
        productId: item.productId,
        addedAt: item.addedAt,
      })),
    }),
  });
  if (!response.ok) throw new Error("Compare sync failed");

  const payload = (await response.json()) as ApiEnvelope<ComparePayload>;
  if (!payload.success || !payload.data?.items) {
    throw new Error(payload.error ?? "Compare sync failed");
  }

  return payload.data.items;
}

export function AccountCollectionsSyncBridge() {
  const wishlistItems = useWishlistStore((state) => state.items);
  const setWishlistItems = useWishlistStore((state) => state.setItems);
  const compareItems = useCompareStore((state) => state.items);
  const setCompareItems = useCompareStore((state) => state.setItems);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const wishlistHashRef = useRef("");
  const compareHashRef = useRef("");

  const syncBothAndSet = useCallback(
    async (nextWishlist: WishlistItem[], nextCompare: CompareItem[]) => {
      const [syncedWishlist, syncedCompare] = await Promise.all([
        syncWishlist(nextWishlist),
        syncCompare(nextCompare),
      ]);

      setWishlistItems(syncedWishlist);
      setCompareItems(syncedCompare);
      wishlistHashRef.current = buildWishlistHash(syncedWishlist);
      compareHashRef.current = buildCompareHash(syncedCompare);
    },
    [setCompareItems, setWishlistItems],
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

        const [localWishlist, localCompare, serverWishlist, serverCompare] = await Promise.all([
          Promise.resolve(useWishlistStore.getState().items),
          Promise.resolve(useCompareStore.getState().items),
          fetchWishlist(),
          fetchCompare(),
        ]);
        if (!active) return;

        const mergedWishlist = mergeWishlist(localWishlist, serverWishlist);
        const mergedCompare = mergeCompare(localCompare, serverCompare);

        setWishlistItems(mergedWishlist);
        setCompareItems(mergedCompare);
        await syncBothAndSet(mergedWishlist, mergedCompare);
      } catch {
        // Keep local-only mode when sync is unavailable.
      } finally {
        if (active) setIsReady(true);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [setCompareItems, setWishlistItems, syncBothAndSet]);

  useEffect(() => {
    if (!isAuthenticated || !isReady) return;

    const currentWishlistHash = buildWishlistHash(wishlistItems);
    const currentCompareHash = buildCompareHash(compareItems);
    const wishlistChanged = currentWishlistHash !== wishlistHashRef.current;
    const compareChanged = currentCompareHash !== compareHashRef.current;

    if (!wishlistChanged && !compareChanged) return;

    const timer = setTimeout(() => {
      void syncBothAndSet(wishlistItems, compareItems).catch(() => {
        // Retry on next state change.
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [compareItems, isAuthenticated, isReady, syncBothAndSet, wishlistItems]);

  return null;
}
