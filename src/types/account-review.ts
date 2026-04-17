import type { ReviewStatus } from "@prisma/client";

export type AccountReviewItem = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
  };
  orderItem: {
    id: string;
    orderNumber: string;
  } | null;
};

export type ReviewableOrderItem = {
  orderItemId: string;
  orderNumber: string;
  purchasedAt: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
  };
};

export type AccountReviewsPayload = {
  reviews: AccountReviewItem[];
  reviewableItems: ReviewableOrderItem[];
};
