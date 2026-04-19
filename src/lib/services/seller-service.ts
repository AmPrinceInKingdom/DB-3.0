import { AccountStatus, NotificationType, Prisma, UserRole } from "@prisma/client";
import slugify from "slugify";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  getNotificationSettings,
  isNotificationTypeEnabled,
} from "@/lib/services/notification-settings-service";
import { canSendInAppNotification } from "@/lib/services/user-notification-preferences-service";
import type {
  AdminSellerListItem,
  SellerApplicationPayload,
  SellerApplicationRecord,
  SellerStoreProfile,
  SellerStoreProfilePayload,
} from "@/types/seller";
import type {
  SellerApplicationInput,
  SellerStoreProfileUpdateInput,
} from "@/lib/validators/seller";

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function createSlugBase(storeName: string) {
  const slug = slugify(storeName, { lower: true, strict: true, trim: true });
  if (slug.length > 0) return slug.slice(0, 150);
  return `store-${Date.now().toString(36)}`;
}

async function ensureUniqueStoreSlug(
  tx: Prisma.TransactionClient,
  storeName: string,
  userId: string,
) {
  const slugBase = createSlugBase(storeName);
  let candidate = slugBase;
  let attempt = 2;

  while (attempt < 500) {
    const existing = await tx.seller.findFirst({
      where: {
        storeSlug: candidate,
        NOT: { userId },
      },
      select: { userId: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${slugBase}-${attempt}`;
    attempt += 1;
  }

  return `${slugBase}-${Date.now().toString(36)}`;
}

function toSellerApplicationRecord(
  seller: {
    userId: string;
    storeName: string;
    storeSlug: string;
    status: AccountStatus;
    supportEmail: string | null;
    supportPhone: string | null;
    taxId: string | null;
    description: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      role: UserRole;
    };
  },
): SellerApplicationRecord {
  return {
    userId: seller.userId,
    storeName: seller.storeName,
    storeSlug: seller.storeSlug,
    status: seller.status,
    supportEmail: seller.supportEmail,
    supportPhone: seller.supportPhone,
    taxId: seller.taxId,
    description: seller.description,
    approvedAt: seller.approvedAt ? seller.approvedAt.toISOString() : null,
    createdAt: seller.createdAt.toISOString(),
    updatedAt: seller.updatedAt.toISOString(),
    userRole: seller.user.role,
  };
}

function toAdminSellerListItem(
  seller: {
    userId: string;
    storeName: string;
    storeSlug: string;
    status: AccountStatus;
    supportEmail: string | null;
    supportPhone: string | null;
    taxId: string | null;
    description: string | null;
    commissionRate: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    approvedAt: Date | null;
    approver: { id: string; email: string } | null;
    user: {
      id: string;
      email: string;
      role: UserRole;
      status: AccountStatus;
      phone: string | null;
      profile: {
        firstName: string | null;
        lastName: string | null;
      } | null;
    };
  },
): AdminSellerListItem {
  return {
    userId: seller.userId,
    storeName: seller.storeName,
    storeSlug: seller.storeSlug,
    status: seller.status,
    supportEmail: seller.supportEmail,
    supportPhone: seller.supportPhone,
    taxId: seller.taxId,
    description: seller.description,
    commissionRate: Number(seller.commissionRate.toString()),
    createdAt: seller.createdAt.toISOString(),
    updatedAt: seller.updatedAt.toISOString(),
    approvedAt: seller.approvedAt ? seller.approvedAt.toISOString() : null,
    approvedBy: seller.approver,
    user: {
      id: seller.user.id,
      email: seller.user.email,
      role: seller.user.role,
      status: seller.user.status,
      phone: seller.user.phone,
      firstName: seller.user.profile?.firstName ?? null,
      lastName: seller.user.profile?.lastName ?? null,
    },
  };
}

function toSellerStoreProfile(
  seller: {
    userId: string;
    storeName: string;
    storeSlug: string;
    status: AccountStatus;
    supportEmail: string | null;
    supportPhone: string | null;
    taxId: string | null;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    commissionRate: Prisma.Decimal;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      email: string;
      profile: {
        firstName: string | null;
        lastName: string | null;
      } | null;
    };
  },
): SellerStoreProfile {
  return {
    userId: seller.userId,
    storeName: seller.storeName,
    storeSlug: seller.storeSlug,
    status: seller.status,
    supportEmail: seller.supportEmail,
    supportPhone: seller.supportPhone,
    taxId: seller.taxId,
    description: seller.description,
    logoUrl: seller.logoUrl,
    bannerUrl: seller.bannerUrl,
    commissionRate: Number(seller.commissionRate.toString()),
    approvedAt: seller.approvedAt ? seller.approvedAt.toISOString() : null,
    createdAt: seller.createdAt.toISOString(),
    updatedAt: seller.updatedAt.toISOString(),
    owner: {
      email: seller.user.email,
      firstName: seller.user.profile?.firstName ?? null,
      lastName: seller.user.profile?.lastName ?? null,
    },
  };
}

async function notifyAdminsAboutSellerApplication(
  tx: Prisma.TransactionClient,
  payload: {
    sellerUserId: string;
    storeName: string;
  },
) {
  const notificationSettings = await getNotificationSettings(tx);
  if (!isNotificationTypeEnabled(notificationSettings, NotificationType.SYSTEM)) {
    return;
  }

  const admins = await tx.user.findMany({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      status: AccountStatus.ACTIVE,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (admins.length === 0) return;

  await tx.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: NotificationType.SYSTEM,
      title: "New seller application",
      message: `${payload.storeName} submitted a seller application and requires review.`,
      linkUrl: "/admin/sellers",
      metadata: {
        sellerUserId: payload.sellerUserId,
      } satisfies Prisma.InputJsonValue,
      sentAt: new Date(),
    })),
  });
}

export async function getMySellerApplication(userId: string): Promise<SellerApplicationPayload> {
  const seller = await db.seller.findUnique({
    where: { userId },
    select: {
      userId: true,
      storeName: true,
      storeSlug: true,
      status: true,
      supportEmail: true,
      supportPhone: true,
      taxId: true,
      description: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!seller) return { application: null };
  return { application: toSellerApplicationRecord(seller) };
}

export async function submitSellerApplication(userId: string, input: SellerApplicationInput) {
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        deletedAt: true,
        seller: {
          select: {
            userId: true,
            status: true,
          },
        },
      },
    });

    if (!user || user.deletedAt || user.status === AccountStatus.DELETED) {
      throw new NotFoundError("User account not found");
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new AppError("Admin accounts cannot submit seller applications.", 400, "SELLER_APPLICATION_BLOCKED");
    }

    if (user.seller?.status === AccountStatus.ACTIVE && user.role === UserRole.SELLER) {
      throw new AppError("Your seller account is already active.", 409, "SELLER_ALREADY_ACTIVE");
    }

    const nextSlug = await ensureUniqueStoreSlug(tx, input.storeName, user.id);

    const seller = user.seller
      ? await tx.seller.update({
          where: { userId: user.id },
          data: {
            storeName: input.storeName.trim(),
            storeSlug: nextSlug,
            supportEmail: normalizeOptionalText(input.supportEmail),
            supportPhone: normalizeOptionalText(input.supportPhone),
            taxId: normalizeOptionalText(input.taxId),
            description: normalizeOptionalText(input.description),
            status: AccountStatus.PENDING,
            approvedAt: null,
            approvedBy: null,
          },
          select: {
            userId: true,
            storeName: true,
            storeSlug: true,
            status: true,
            supportEmail: true,
            supportPhone: true,
            taxId: true,
            description: true,
            approvedAt: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                role: true,
              },
            },
          },
        })
      : await tx.seller.create({
          data: {
            userId: user.id,
            storeName: input.storeName.trim(),
            storeSlug: nextSlug,
            status: AccountStatus.PENDING,
            supportEmail: normalizeOptionalText(input.supportEmail),
            supportPhone: normalizeOptionalText(input.supportPhone),
            taxId: normalizeOptionalText(input.taxId),
            description: normalizeOptionalText(input.description),
          },
          select: {
            userId: true,
            storeName: true,
            storeSlug: true,
            status: true,
            supportEmail: true,
            supportPhone: true,
            taxId: true,
            description: true,
            approvedAt: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                role: true,
              },
            },
          },
        });

    await notifyAdminsAboutSellerApplication(tx, {
      sellerUserId: seller.userId,
      storeName: seller.storeName,
    });

    return seller;
  });

  return {
    application: toSellerApplicationRecord(result),
  } satisfies SellerApplicationPayload;
}

export async function getMySellerStoreProfile(userId: string): Promise<SellerStoreProfilePayload> {
  const seller = await db.seller.findUnique({
    where: { userId },
    select: {
      userId: true,
      storeName: true,
      storeSlug: true,
      status: true,
      supportEmail: true,
      supportPhone: true,
      taxId: true,
      description: true,
      logoUrl: true,
      bannerUrl: true,
      commissionRate: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!seller) return { profile: null };
  return { profile: toSellerStoreProfile(seller) };
}

export async function updateMySellerStoreProfile(
  userId: string,
  input: SellerStoreProfileUpdateInput,
): Promise<SellerStoreProfilePayload> {
  const updated = await db.$transaction(async (tx) => {
    const current = await tx.seller.findUnique({
      where: { userId },
      select: {
        userId: true,
        storeName: true,
        storeSlug: true,
        status: true,
      },
    });

    if (!current) {
      throw new NotFoundError("Seller profile not found");
    }

    if (current.status !== AccountStatus.ACTIVE) {
      throw new AppError("Only active sellers can update store profile", 403, "SELLER_PROFILE_INACTIVE");
    }

    const nextStoreName = input.storeName.trim();
    const nextSlug =
      nextStoreName.toLowerCase() === current.storeName.toLowerCase()
        ? current.storeSlug
        : await ensureUniqueStoreSlug(tx, nextStoreName, userId);

    return tx.seller.update({
      where: { userId },
      data: {
        storeName: nextStoreName,
        storeSlug: nextSlug,
        supportEmail: normalizeOptionalText(input.supportEmail),
        supportPhone: normalizeOptionalText(input.supportPhone),
        taxId: normalizeOptionalText(input.taxId),
        description: normalizeOptionalText(input.description),
        logoUrl: normalizeOptionalText(input.logoUrl),
        bannerUrl: normalizeOptionalText(input.bannerUrl),
      },
      select: {
        userId: true,
        storeName: true,
        storeSlug: true,
        status: true,
        supportEmail: true,
        supportPhone: true,
        taxId: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        commissionRate: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  });

  return {
    profile: toSellerStoreProfile(updated),
  };
}

type AdminSellerFilters = {
  query?: string;
  status?: AccountStatus;
};

export async function listAdminSellerApplications(filters: AdminSellerFilters = {}) {
  const queryText = normalizeOptionalText(filters.query);

  const sellers = await db.seller.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(queryText
        ? {
            OR: [
              { storeName: { contains: queryText, mode: "insensitive" } },
              { storeSlug: { contains: queryText, mode: "insensitive" } },
              { supportEmail: { contains: queryText, mode: "insensitive" } },
              { supportPhone: { contains: queryText, mode: "insensitive" } },
              { user: { email: { contains: queryText, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      userId: true,
      storeName: true,
      storeSlug: true,
      status: true,
      supportEmail: true,
      supportPhone: true,
      taxId: true,
      description: true,
      commissionRate: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
      approver: {
        select: {
          id: true,
          email: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          phone: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return sellers.map((seller) => toAdminSellerListItem(seller));
}

type ReviewSellerApplicationParams = {
  sellerUserId: string;
  actorUserId: string;
  action: "APPROVE" | "SUSPEND" | "REJECT";
  reason?: string;
};

export async function reviewAdminSellerApplication(params: ReviewSellerApplicationParams) {
  const reason = normalizeOptionalText(params.reason);

  const result = await db.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: params.actorUserId },
        select: {
          id: true,
          role: true,
          status: true,
          deletedAt: true,
        },
      });

      if (
        !actor ||
        actor.deletedAt ||
        actor.status !== AccountStatus.ACTIVE ||
        (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN)
      ) {
        throw new AppError(
          "Admin session is invalid. Please sign in again.",
          401,
          "ADMIN_SESSION_INVALID",
        );
      }

      const current = await tx.seller.findUnique({
        where: { userId: params.sellerUserId },
        select: {
          userId: true,
          storeName: true,
          status: true,
          user: {
            select: {
              id: true,
              role: true,
            },
          },
        },
      });

      if (!current) {
        throw new NotFoundError("Seller application not found");
      }

      if (params.action === "REJECT" && current.status !== AccountStatus.PENDING) {
        throw new AppError(
          "Only pending seller applications can be rejected.",
          400,
          "SELLER_REVIEW_INVALID_STATE",
        );
      }

      if (params.action === "SUSPEND" && current.status !== AccountStatus.ACTIVE) {
        throw new AppError(
          "Only active sellers can be suspended.",
          400,
          "SELLER_REVIEW_INVALID_STATE",
        );
      }

      const nextSellerStatus =
        params.action === "APPROVE" ? AccountStatus.ACTIVE : AccountStatus.SUSPENDED;

      let nextUserRole = current.user.role;
      if (params.action === "APPROVE") {
        nextUserRole = UserRole.SELLER;
      } else if (current.user.role === UserRole.SELLER) {
        nextUserRole = UserRole.CUSTOMER;
      }

      await tx.seller.update({
        where: { userId: current.userId },
        data: {
          status: nextSellerStatus,
          ...(params.action === "APPROVE"
            ? { approvedBy: actor.id, approvedAt: new Date() }
            : {}),
          ...(params.action === "REJECT"
            ? { approvedBy: null, approvedAt: null }
            : {}),
        },
      });

      if (nextUserRole !== current.user.role) {
        await tx.user.update({
          where: { id: current.user.id },
          data: {
            role: nextUserRole,
            ...(params.action === "APPROVE" ? { status: AccountStatus.ACTIVE } : {}),
          },
        });
      }

      const updated = await tx.seller.findUnique({
        where: { userId: current.userId },
        select: {
          userId: true,
          storeName: true,
          storeSlug: true,
          status: true,
          supportEmail: true,
          supportPhone: true,
          taxId: true,
          description: true,
          commissionRate: true,
          createdAt: true,
          updatedAt: true,
          approvedAt: true,
          approver: {
            select: {
              id: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              phone: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!updated) {
        throw new NotFoundError("Seller application not found");
      }

      return {
        updated: toAdminSellerListItem(updated),
        notification: {
          sellerUserId: current.userId,
          userId: current.user.id,
          storeName: current.storeName,
          nextSellerStatus,
          reason,
        },
      };
    });

  try {
    const notificationSettings = await getNotificationSettings(db);
    const canSendSellerSystemNotification = isNotificationTypeEnabled(
      notificationSettings,
      NotificationType.SYSTEM,
    )
      ? await canSendInAppNotification(db, result.notification.userId, NotificationType.SYSTEM)
      : false;

    if (canSendSellerSystemNotification) {
      await db.notification.create({
        data: {
          userId: result.notification.userId,
          type: NotificationType.SYSTEM,
          title:
            params.action === "APPROVE"
              ? "Seller application approved"
              : params.action === "REJECT"
                ? "Seller application rejected"
                : "Seller account suspended",
          message:
            params.action === "APPROVE"
              ? `Your seller account "${result.notification.storeName}" is now active.`
              : `${result.notification.storeName} seller application status updated to ${
                  result.notification.nextSellerStatus
                }. ${result.notification.reason ?? ""}`.trim(),
          linkUrl: params.action === "APPROVE" ? "/seller/dashboard" : "/seller/apply",
          metadata: {
            sellerUserId: result.notification.sellerUserId,
            action: params.action,
            reason: result.notification.reason,
            status: result.notification.nextSellerStatus,
          } satisfies Prisma.InputJsonValue,
          sentAt: new Date(),
        },
      });
    }
  } catch {
    // Keep seller review successful even if notification dispatch fails.
  }

  return result.updated;
}
