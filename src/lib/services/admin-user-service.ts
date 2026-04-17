import { AccountStatus, Prisma, UserRole } from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  requestEmailVerification,
  requestEmailVerificationOtp,
} from "@/lib/auth/auth-service";

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const elevatedRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
const emailVerificationOtpPurpose = "EMAIL_VERIFICATION";
const verificationAuditActionPrefix = "ADMIN_USER_VERIFICATION_";

function shouldRequireEmailVerification(role: UserRole) {
  return role === UserRole.CUSTOMER;
}

export type AdminUserVerificationAction =
  | "RESEND_EMAIL_LINK"
  | "RESEND_OTP"
  | "REVOKE_PENDING";

type AdminUserFilters = {
  query?: string;
  role?: UserRole;
  status?: AccountStatus;
};

export async function listAdminUsers(filters: AdminUserFilters = {}) {
  const queryText = normalizeOptionalText(filters.query);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(queryText
      ? {
          OR: [
            { email: { contains: queryText, mode: "insensitive" } },
            { phone: { contains: queryText, mode: "insensitive" } },
            { profile: { firstName: { contains: queryText, mode: "insensitive" } } },
            { profile: { lastName: { contains: queryText, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 400,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      admin: {
        select: {
          canManageAdmins: true,
        },
      },
      seller: {
        select: {
          storeName: true,
          status: true,
        },
      },
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) {
    return [];
  }

  const now = new Date();

  const [pendingEmailTokenRows, pendingOtpRows, verificationAuditRows] =
    await Promise.all([
      db.emailVerificationToken.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          usedAt: null,
          expiresAt: { gt: now },
        },
        _count: {
          _all: true,
        },
      }),
      db.otpCode.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          purpose: emailVerificationOtpPurpose,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        _count: {
          _all: true,
        },
      }),
      db.auditLog.findMany({
        where: {
          targetTable: "users",
          targetId: { in: userIds },
          action: {
            startsWith: verificationAuditActionPrefix,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: Math.min(2000, userIds.length * 10),
        select: {
          targetId: true,
          action: true,
          createdAt: true,
          actor: {
            select: {
              email: true,
            },
          },
        },
      }),
    ]);

  const pendingEmailTokenCountByUserId = new Map<string, number>();
  for (const row of pendingEmailTokenRows) {
    pendingEmailTokenCountByUserId.set(row.userId, row._count._all);
  }

  const pendingOtpCountByUserId = new Map<string, number>();
  for (const row of pendingOtpRows) {
    if (!row.userId) continue;
    pendingOtpCountByUserId.set(row.userId, row._count._all);
  }

  const lastVerificationAuditByUserId = new Map<
    string,
    {
      action: string;
      createdAt: Date;
      actorEmail: string | null;
    }
  >();
  for (const row of verificationAuditRows) {
    const targetId = row.targetId;
    if (!targetId) continue;
    if (lastVerificationAuditByUserId.has(targetId)) continue;

    lastVerificationAuditByUserId.set(targetId, {
      action: row.action,
      createdAt: row.createdAt,
      actorEmail: row.actor?.email ?? null,
    });
  }

  return users.map((user) => {
    const latestAudit = lastVerificationAuditByUserId.get(user.id);

    return {
      ...user,
      orderCount: user._count.orders,
      pendingEmailVerificationTokens:
        pendingEmailTokenCountByUserId.get(user.id) ?? 0,
      pendingEmailVerificationOtps: pendingOtpCountByUserId.get(user.id) ?? 0,
      lastVerificationAudit: latestAudit
        ? {
            action: latestAudit.action,
            createdAt: latestAudit.createdAt.toISOString(),
            actorEmail: latestAudit.actorEmail,
          }
        : null,
    };
  });
}

type UpdateAdminUserParams = {
  targetUserId: string;
  actorUserId: string;
  actorRole: UserRole;
  role?: UserRole;
  status?: AccountStatus;
};

export async function updateAdminUser(params: UpdateAdminUserParams) {
  const isActorSuperAdmin = params.actorRole === UserRole.SUPER_ADMIN;

  return db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: params.targetUserId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        seller: {
          select: {
            userId: true,
            status: true,
          },
        },
      },
    });

    if (!target || target.status === AccountStatus.DELETED) {
      throw new NotFoundError("User not found");
    }

    const nextRole = params.role ?? target.role;
    if (params.actorUserId === target.id) {
      if (params.role !== undefined && params.role !== target.role) {
        throw new AppError("You cannot change your own role", 403, "SELF_ROLE_UPDATE_FORBIDDEN");
      }
      if (params.status !== undefined && params.status !== target.status) {
        throw new AppError("You cannot change your own account status", 403, "SELF_STATUS_UPDATE_FORBIDDEN");
      }
    }

    if (!isActorSuperAdmin) {
      if (elevatedRoles.has(target.role)) {
        throw new AppError("Only super admin can manage admin accounts", 403, "ADMIN_ACCOUNT_UPDATE_FORBIDDEN");
      }

      if (params.role !== undefined && elevatedRoles.has(params.role)) {
        throw new AppError("Only super admin can assign admin roles", 403, "ADMIN_ROLE_ASSIGN_FORBIDDEN");
      }
    }

    if (nextRole === UserRole.SELLER && (!target.seller || target.seller.status !== AccountStatus.ACTIVE)) {
      throw new AppError(
        "Seller role requires approved seller onboarding profile",
        400,
        "SELLER_PROFILE_REQUIRED",
      );
    }

    if (params.status === AccountStatus.DELETED && !isActorSuperAdmin) {
      throw new AppError("Only super admin can mark users as deleted", 403, "DELETE_STATUS_FORBIDDEN");
    }

    const updatedUser = await tx.user.update({
      where: { id: target.id },
      data: {
        ...(params.role !== undefined ? { role: params.role } : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        admin: {
          select: {
            canManageAdmins: true,
          },
        },
        seller: {
          select: {
            storeName: true,
            status: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (params.role !== undefined) {
      if (elevatedRoles.has(nextRole)) {
        await tx.admin.upsert({
          where: { userId: target.id },
          update: {
            canManageAdmins: nextRole === UserRole.SUPER_ADMIN,
          },
          create: {
            userId: target.id,
            canManageAdmins: nextRole === UserRole.SUPER_ADMIN,
            notes: nextRole === UserRole.SUPER_ADMIN ? "Promoted by super admin" : "Promoted by admin flow",
          },
        });
      } else {
        await tx.admin.deleteMany({
          where: { userId: target.id },
        });
      }
    }

    return {
      ...updatedUser,
      orderCount: updatedUser._count.orders,
    };
  });
}

type ManageAdminUserVerificationParams = {
  targetUserId: string;
  actorUserId: string;
  actorRole: UserRole;
  action: AdminUserVerificationAction;
  appUrl?: string;
  includeDebugArtifacts?: boolean;
};

export type ManageAdminUserVerificationResult = {
  targetUserId: string;
  targetEmail: string;
  action: AdminUserVerificationAction;
  message: string;
  debugVerificationUrl?: string;
  debugOtpCode?: string;
  tokenExpiresAt?: string;
  otpExpiresAt?: string;
  revokedTokens?: number;
  revokedOtps?: number;
};

export async function manageAdminUserVerification(
  params: ManageAdminUserVerificationParams,
): Promise<ManageAdminUserVerificationResult> {
  const target = await db.user.findUnique({
    where: { id: params.targetUserId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
    },
  });

  if (!target || target.status === AccountStatus.DELETED) {
    throw new NotFoundError("User not found");
  }

  const isActorSuperAdmin = params.actorRole === UserRole.SUPER_ADMIN;
  if (!isActorSuperAdmin && elevatedRoles.has(target.role)) {
    throw new AppError(
      "Only super admin can manage admin verification actions",
      403,
      "ADMIN_VERIFICATION_ACTION_FORBIDDEN",
    );
  }

  if (!shouldRequireEmailVerification(target.role)) {
    throw new AppError(
      "Verification actions are supported only for customer accounts",
      400,
      "EMAIL_VERIFICATION_NOT_REQUIRED",
    );
  }

  if (target.status !== AccountStatus.ACTIVE) {
    throw new AppError(
      "Only active accounts can receive verification actions",
      400,
      "ACCOUNT_NOT_ACTIVE",
    );
  }

  if (
    (params.action === "RESEND_EMAIL_LINK" || params.action === "RESEND_OTP") &&
    target.emailVerifiedAt
  ) {
    throw new AppError(
      "This user email is already verified",
      400,
      "EMAIL_ALREADY_VERIFIED",
    );
  }

  if (params.action === "RESEND_EMAIL_LINK") {
    const result = await requestEmailVerification(
      { email: target.email },
      {
        appUrl: params.appUrl,
        includeDebugArtifacts: params.includeDebugArtifacts,
      },
    );

    return {
      targetUserId: target.id,
      targetEmail: target.email,
      action: params.action,
      message: result.message,
      debugVerificationUrl: result.debugVerificationUrl,
      debugOtpCode: result.debugOtpCode,
      tokenExpiresAt: result.tokenExpiresAt,
      otpExpiresAt: result.otpExpiresAt,
    };
  }

  if (params.action === "RESEND_OTP") {
    const result = await requestEmailVerificationOtp(
      { email: target.email },
      {
        includeDebugArtifacts: params.includeDebugArtifacts,
      },
    );

    return {
      targetUserId: target.id,
      targetEmail: target.email,
      action: params.action,
      message: result.message,
      debugOtpCode: result.debugOtpCode,
      otpExpiresAt: result.otpExpiresAt,
    };
  }

  const now = new Date();
  const [revokedTokenResult, revokedOtpResult] = await db.$transaction([
    db.emailVerificationToken.updateMany({
      where: {
        userId: target.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    }),
    db.otpCode.updateMany({
      where: {
        userId: target.id,
        purpose: emailVerificationOtpPurpose,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    }),
  ]);

  return {
    targetUserId: target.id,
    targetEmail: target.email,
    action: params.action,
    message: "Pending verification tokens have been revoked.",
    revokedTokens: revokedTokenResult.count,
    revokedOtps: revokedOtpResult.count,
  };
}
