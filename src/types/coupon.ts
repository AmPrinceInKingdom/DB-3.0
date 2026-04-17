import type { DiscountScope, DiscountType } from "@prisma/client";

export type CouponCatalogItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: DiscountType;
  discountScope: DiscountScope;
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usageLimitPerUser: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  applicableCategory: {
    id: string;
    name: string;
    slug: string;
  } | null;
  applicableProduct: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type CouponSelectOption = {
  id: string;
  name: string;
  slug: string;
};

export type CouponAdminPayload = {
  coupons: CouponCatalogItem[];
  categories: CouponSelectOption[];
  products: CouponSelectOption[];
};
