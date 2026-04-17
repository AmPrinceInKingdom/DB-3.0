import type { AccountStatus, ProductStatus, StockStatus } from "@prisma/client";

export type AdminCatalogOption = {
  id: string;
  name: string;
};

export type AdminCatalogSubcategoryOption = AdminCatalogOption & {
  categoryId: string;
};

export type AdminCatalogSellerOption = {
  id: string;
  name: string;
  status: AccountStatus;
};

export type AdminCatalogProductItem = {
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
  sellerId: string | null;
  sellerName: string | null;
  shortDescription: string | null;
  description: string | null;
  mainImageUrl: string | null;
  galleryImageUrls: string[];
  variants: AdminProductVariantItem[];
  updatedAt: string;
};

export type AdminProductVariantItem = {
  id: string;
  sku: string;
  name: string | null;
  options: Record<string, string>;
  price: number;
  oldPrice: number | null;
  stockQuantity: number;
  imageUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export type AdminProductsWorkspace = {
  items: AdminCatalogProductItem[];
  options: {
    categories: AdminCatalogOption[];
    subcategories: AdminCatalogSubcategoryOption[];
    brands: AdminCatalogOption[];
    sellers: AdminCatalogSellerOption[];
  };
};

export type AdminCategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  subcategoryCount: number;
  updatedAt: string;
};

export type AdminSubcategoryItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  updatedAt: string;
};

export type AdminCategoriesWorkspace = {
  categories: AdminCategoryItem[];
  subcategories: AdminSubcategoryItem[];
  categoryOptions: AdminCatalogOption[];
};

export type AdminBrandItem = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  productCount: number;
  updatedAt: string;
};

export type AdminBrandsWorkspace = {
  brands: AdminBrandItem[];
};
