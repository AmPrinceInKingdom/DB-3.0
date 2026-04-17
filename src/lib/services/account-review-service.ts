import { OrderStatus, Prisma, ReviewStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type {
  AccountReviewItem,
  AccountReviewsPayload,
  ReviewableOrderItem,
} from "@/types/account-review";
import type {
  CreateAccountReviewInput,
  UpdateAccountReviewInput,
} from "@/lib/validators/account-review";

type ReviewRecord = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    slug: string;
    images: Array<{
      imageUrl: string;
    }>;
  };
  orderItem: {
    id: string;
    order: {
      orderNumber: string;
    };
  } | null;
};

function mapReview(record: ReviewRecord): AccountReviewItem {
  return {
    id: record.id,
    rating: record.rating,
    title: record.title,
    comment: record.comment,
    status: record.status,
    isVerifiedPurchase: record.isVerifiedPurchase,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    product: {
      id: record.product.id,
      name: record.product.name,
      slug: record.product.slug,
      imageUrl: record.product.images[0]?.imageUrl ?? null,
    },
    orderItem: record.orderItem
      ? {
          id: record.orderItem.id,
          orderNumber: record.orderItem.order.orderNumber,
        }
      : null,
  };
}

async function ensureOrderItemReviewable(
  tx: Prisma.TransactionClient,
  userId: string,
  orderItemId: string,
) {
  const orderItem = await tx.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      id: true,
      productId: true,
      productName: true,
      order: {
        select: {
          id: true,
          userId: true,
          status: true,
          orderNumber: true,
        },
      },
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      reviews: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!orderItem) {
    throw new NotFoundError("Order item not found");
  }

  if (!orderItem.order || orderItem.order.userId !== userId) {
    throw new AppError("You are not allowed to review this order item.", 403, "ORDER_ITEM_FORBIDDEN");
  }

  if (orderItem.order.status !== OrderStatus.DELIVERED) {
    throw new AppError(
      "You can submit a review after order delivery.",
      400,
      "ORDER_NOT_DELIVERED",
    );
  }

  if (orderItem.reviews.length > 0) {
    throw new AppError("You have already submitted a review for this item.", 400, "REVIEW_EXISTS");
  }

  if (!orderItem.productId) {
    throw new AppError("Product data is unavailable for this item.", 400, "PRODUCT_NOT_FOUND");
  }

  return {
    orderItemId: orderItem.id,
    productId: orderItem.productId,
    productName: orderItem.product?.name ?? orderItem.productName,
    productSlug: orderItem.product?.slug ?? "",
    orderNumber: orderItem.order.orderNumber,
  };
}

async function listMyReviews(userId: string): Promise<AccountReviewItem[]> {
  const reviews = await db.review.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      status: true,
      isVerifiedPurchase: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { imageUrl: true },
            take: 1,
          },
        },
      },
      orderItem: {
        select: {
          id: true,
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
      },
    },
  });

  return reviews.map((review) => mapReview(review as ReviewRecord));
}

async function listReviewableItems(userId: string): Promise<ReviewableOrderItem[]> {
  const items = await db.orderItem.findMany({
    where: {
      order: {
        userId,
        status: OrderStatus.DELIVERED,
      },
      reviews: {
        none: {
          userId,
        },
      },
      productId: {
        not: null,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      quantity: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { imageUrl: true },
            take: 1,
          },
        },
      },
      order: {
        select: {
          orderNumber: true,
          createdAt: true,
        },
      },
    },
  });

  return items
    .filter((item) => Boolean(item.product))
    .map((item) => ({
      orderItemId: item.id,
      orderNumber: item.order.orderNumber,
      purchasedAt: item.order.createdAt.toISOString(),
      quantity: item.quantity,
      product: {
        id: item.product!.id,
        name: item.product!.name,
        slug: item.product!.slug,
        imageUrl: item.product!.images[0]?.imageUrl ?? null,
      },
    }));
}

export async function getAccountReviewsPayload(userId: string): Promise<AccountReviewsPayload> {
  const [reviews, reviewableItems] = await Promise.all([
    listMyReviews(userId),
    listReviewableItems(userId),
  ]);

  return {
    reviews,
    reviewableItems,
  };
}

export async function createAccountReview(userId: string, input: CreateAccountReviewInput) {
  const created = await db.$transaction(async (tx) => {
    const reviewable = await ensureOrderItemReviewable(tx, userId, input.orderItemId);

    const review = await tx.review.create({
      data: {
        productId: reviewable.productId,
        userId,
        orderItemId: reviewable.orderItemId,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        status: ReviewStatus.PENDING,
        isVerifiedPurchase: true,
      },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        status: true,
        isVerifiedPurchase: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: { imageUrl: true },
              take: 1,
            },
          },
        },
        orderItem: {
          select: {
            id: true,
            order: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "REVIEW",
        title: "Review submitted",
        message: `Your review for ${reviewable.productName} is pending moderation.`,
        linkUrl: "/account/reviews",
        metadata: {
          reviewId: review.id,
          orderItemId: reviewable.orderItemId,
          orderNumber: reviewable.orderNumber,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return review;
  });

  return mapReview(created as ReviewRecord);
}

export async function updateAccountReview(
  userId: string,
  reviewId: string,
  input: UpdateAccountReviewInput,
) {
  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        userId: true,
        product: {
          select: { name: true },
        },
      },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundError("Review not found");
    }

    const review = await tx.review.update({
      where: { id: reviewId },
      data: {
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        status: ReviewStatus.PENDING,
      },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        status: true,
        isVerifiedPurchase: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: { imageUrl: true },
              take: 1,
            },
          },
        },
        orderItem: {
          select: {
            id: true,
            order: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "REVIEW",
        title: "Review updated",
        message: `Your review for ${existing.product.name} was updated and sent for moderation.`,
        linkUrl: "/account/reviews",
        metadata: {
          reviewId: existing.id,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return review;
  });

  return mapReview(updated as ReviewRecord);
}

export async function deleteAccountReview(userId: string, reviewId: string) {
  await db.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        userId: true,
        product: { select: { name: true } },
      },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundError("Review not found");
    }

    await tx.review.delete({
      where: { id: reviewId },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "REVIEW",
        title: "Review deleted",
        message: `Your review for ${existing.product.name} has been removed.`,
        linkUrl: "/account/reviews",
        metadata: {
          reviewId: existing.id,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return { id: reviewId };
}
