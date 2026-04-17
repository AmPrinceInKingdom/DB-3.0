import type { StockStatus } from "@prisma/client";

export type AdminInventoryItem = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  stockStatus: StockStatus;
  stockQuantity: number;
  minStockLevel: number;
  totalSold: number;
  currentPrice: number;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
  brand: {
    id: string;
    name: string;
  } | null;
  mainImage: {
    imageUrl: string;
    altText: string | null;
  } | null;
};

export type AdminInventoryLogItem = {
  id: string;
  productId: string;
  previousQuantity: number;
  changeAmount: number;
  newQuantity: number;
  reason: string | null;
  referenceType: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  actor: {
    id: string;
    email: string;
  } | null;
};

export type AdminInventoryPayload = {
  items: AdminInventoryItem[];
  stats: {
    totalProducts: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  recentLogs: AdminInventoryLogItem[];
};
