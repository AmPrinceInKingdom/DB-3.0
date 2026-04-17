import {
  DiscountScope,
  NotificationType,
  Prisma,
  ProductStatus,
  ReviewStatus,
} from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  getNotificationSettings,
  isNotificationTypeEnabled,
} from "@/lib/services/notification-settings-service";
import { canSendInAppNotification } from "@/lib/services/user-notification-preferences-service";

type DecimalLike = Prisma.Decimal | number | string | null;

function toNumber(value: DecimalLike, fallback = 0) {
  if (value === null) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return Number(value.toString());
}

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isKnownPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

type AdminCouponFilters = {
  query?: string;
  scope?: DiscountScope;
  isActive?: boolean;
};

export async function getAdminCouponPanelData(filters: AdminCouponFilters = {}) {
  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.CouponWhereInput = {
    ...(filters.scope ? { discountScope: filters.scope } : {}),
    ...(typeof filters.isActive === "boolean" ? { isActive: filters.isActive } : {}),
    ...(queryText
      ? {
          OR: [
            { code: { contains: queryText, mode: "insensitive" } },
            { title: { contains: queryText, mode: "insensitive" } },
            { description: { contains: queryText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [coupons, categories, products] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      take: 250,
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        discountType: true,
        discountScope: true,
        discountValue: true,
        minPurchaseAmount: true,
        maxDiscountAmount: true,
        startsAt: true,
        expiresAt: true,
        usageLimit: true,
        usageLimitPerUser: true,
        usedCount: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        applicableCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        applicableProduct: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    db.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    db.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      orderBy: { name: "asc" },
      take: 300,
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
  ]);

  return {
    coupons: coupons.map((coupon) => ({
      ...coupon,
      discountValue: toNumber(coupon.discountValue),
      minPurchaseAmount: toNumber(coupon.minPurchaseAmount),
      maxDiscountAmount:
        coupon.maxDiscountAmount === null ? null : toNumber(coupon.maxDiscountAmount),
    })),
    categories,
    products,
  };
}

type CreateCouponInput = {
  code: string;
  title: string;
  description: string | null;
  discountType: Prisma.CouponCreateInput["discountType"];
  discountScope: Prisma.CouponCreateInput["discountScope"];
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscountAmount: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usageLimitPerUser: number;
  isActive: boolean;
  applicableCategoryId: string | null;
  applicableProductId: string | null;
};

export async function createAdminCoupon(input: CreateCouponInput, createdBy?: string | null) {
  try {
    const created = await db.coupon.create({
      data: {
        code: input.code,
        title: input.title,
        description: input.description,
        discountType: input.discountType,
        discountScope: input.discountScope,
        discountValue: input.discountValue,
        minPurchaseAmount: input.minPurchaseAmount,
        maxDiscountAmount: input.maxDiscountAmount,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        usageLimit: input.usageLimit,
        usageLimitPerUser: input.usageLimitPerUser,
        isActive: input.isActive,
        applicableCategoryId: input.applicableCategoryId,
        applicableProductId: input.applicableProductId,
        createdBy: createdBy ?? null,
      },
      select: {
        id: true,
        code: true,
        title: true,
      },
    });

    return created;
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Coupon code already exists", 409, "COUPON_CODE_EXISTS");
    }
    if (isKnownPrismaError(error, "P2003")) {
      throw new AppError("Invalid category or product selection", 400, "COUPON_SCOPE_REFERENCE_INVALID");
    }
    throw error;
  }
}

type UpdateCouponInput = Prisma.CouponUpdateInput;

export async function updateAdminCoupon(couponId: string, input: UpdateCouponInput) {
  try {
    return await db.coupon.update({
      where: { id: couponId },
      data: input,
      select: {
        id: true,
        code: true,
        title: true,
        isActive: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2025")) {
      throw new NotFoundError("Coupon not found");
    }
    if (isKnownPrismaError(error, "P2002")) {
      throw new AppError("Coupon code already exists", 409, "COUPON_CODE_EXISTS");
    }
    if (isKnownPrismaError(error, "P2003")) {
      throw new AppError("Invalid category or product selection", 400, "COUPON_SCOPE_REFERENCE_INVALID");
    }
    throw error;
  }
}

export async function deleteAdminCoupon(couponId: string) {
  try {
    await db.coupon.delete({
      where: { id: couponId },
    });
  } catch (error) {
    if (isKnownPrismaError(error, "P2025")) {
      throw new NotFoundError("Coupon not found");
    }
    if (isKnownPrismaError(error, "P2003")) {
      throw new AppError("Cannot delete coupon already linked to orders", 409, "COUPON_DELETE_BLOCKED");
    }
    throw error;
  }
}

type AdminReviewFilters = {
  status?: ReviewStatus;
  query?: string;
};

export async function listAdminReviews(filters: AdminReviewFilters = {}) {
  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.ReviewWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(queryText
      ? {
          OR: [
            { title: { contains: queryText, mode: "insensitive" } },
            { comment: { contains: queryText, mode: "insensitive" } },
            { product: { name: { contains: queryText, mode: "insensitive" } } },
            { user: { email: { contains: queryText, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return db.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      status: true,
      isVerifiedPurchase: true,
      helpfulCount: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      orderItem: {
        select: {
          id: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          imageUrl: true,
        },
      },
    },
  });
}

type ModerateReviewInput = {
  reviewId: string;
  status: ReviewStatus;
  changedByUserId?: string | null;
};

export async function moderateAdminReview(input: ModerateReviewInput) {
  return db.$transaction(async (tx) => {
    const current = await tx.review.findUnique({
      where: { id: input.reviewId },
      select: {
        id: true,
        status: true,
        userId: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!current) {
      throw new NotFoundError("Review not found");
    }

    const updated = await tx.review.update({
      where: { id: current.id },
      data: { status: input.status },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    const notificationSettings = await getNotificationSettings(tx);
    const canSendReviewNotification =
      current.userId &&
      current.status !== input.status &&
      isNotificationTypeEnabled(notificationSettings, NotificationType.REVIEW)
        ? await canSendInAppNotification(tx, current.userId, NotificationType.REVIEW)
        : false;

    if (current.userId && canSendReviewNotification) {
      const isApproved = input.status === ReviewStatus.APPROVED;
      const isRejected = input.status === ReviewStatus.REJECTED;
      await tx.notification.create({
        data: {
          userId: current.userId,
          type: NotificationType.REVIEW,
          title: isApproved
            ? "Review approved"
            : isRejected
              ? "Review rejected"
              : "Review updated",
          message: isApproved
            ? `Your review for ${current.product.name} is now public.`
            : isRejected
              ? `Your review for ${current.product.name} was rejected by moderation.`
              : `Your review for ${current.product.name} is under moderation.`,
          metadata: {
            reviewId: current.id,
            status: input.status,
            changedBy: input.changedByUserId ?? null,
          },
        },
      });
    }

    return updated;
  });
}

export async function deleteAdminReview(reviewId: string) {
  try {
    const deleted = await db.review.delete({
      where: { id: reviewId },
      select: { id: true },
    });
    return deleted;
  } catch (error) {
    if (isKnownPrismaError(error, "P2025")) {
      throw new NotFoundError("Review not found");
    }
    throw error;
  }
}
