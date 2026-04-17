import type { ProductStatus, StockStatus } from "@prisma/client";

export type SellerProductItem = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: ProductStatus;
  stockStatus: StockStatus;
  stockQuantity: number;
  minStockLevel: number;
  currentPrice: number;
  oldPrice: number | null;
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  shortDescription: string | null;
  description: string | null;
  mainImageUrl: string | null;
  updatedAt: string;
};

export type SellerProductOption = {
  id: string;
  name: string;
};

export type SellerProductSubcategoryOption = SellerProductOption & {
  categoryId: string;
};

export type SellerProductsWorkspace = {
  items: SellerProductItem[];
  options: {
    categories: SellerProductOption[];
    subcategories: SellerProductSubcategoryOption[];
    brands: SellerProductOption[];
  };
};
