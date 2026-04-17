import type { ReviewStatus } from "@prisma/client";

export type AdminReviewItem = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    id: string;
    email: string;
    profile: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  } | null;
  orderItem: {
    id: string;
    order: {
      id: string;
      orderNumber: string;
    };
  } | null;
  images: Array<{
    id: string;
    imageUrl: string;
  }>;
};
