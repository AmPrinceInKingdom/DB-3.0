import { NotificationType, Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/lib/db";
import type { AdminNotificationsPayload } from "@/types/notification";

type AdminNotificationsFilters = {
  query?: string;
  type?: NotificationType;
  readFilter?: "all" | "read" | "unread";
  page?: number;
  limit?: number;
};

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function clampLimit(limit?: number) {
  if (!limit || !Number.isFinite(limit)) return 20;
  return Math.max(5, Math.min(100, Math.floor(limit)));
}

function clampPage(page?: number) {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

export async function listAdminNotifications(
  adminUserId: string,
  filters: AdminNotificationsFilters = {},
): Promise<AdminNotificationsPayload> {
  const queryText = normalizeOptionalText(filters.query);
  const requestedPage = clampPage(filters.page);
  const limit = clampLimit(filters.limit);

  const where: Prisma.NotificationWhereInput = {
    userId: adminUserId,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.readFilter === "read"
      ? { isRead: true }
      : filters.readFilter === "unread"
        ? { isRead: false }
        : {}),
    ...(queryText
      ? {
          OR: [
            { title: { contains: queryText, mode: "insensitive" } },
            { message: { contains: queryText, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalCount, unreadCount, filteredUnreadCount] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({
      where: {
        userId: adminUserId,
        isRead: false,
      },
    }),
    db.notification.count({
      where: {
        ...where,
        isRead: false,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * limit;

  const items = await db.notification.findMany({
    where,
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    skip,
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      linkUrl: true,
      metadata: true,
      isRead: true,
      sentAt: true,
      createdAt: true,
    },
  });

  return {
    items: items.map((item) => ({
      ...item,
      sentAt: item.sentAt ? item.sentAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    })),
    summary: {
      totalCount,
      unreadCount,
      filteredUnreadCount,
    },
    pagination: {
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function markAdminNotificationRead(
  adminUserId: string,
  notificationId: string,
  isRead = true,
) {
  const updateResult = await db.notification.updateMany({
    where: {
      id: notificationId,
      userId: adminUserId,
    },
    data: {
      isRead,
      ...(isRead ? { sentAt: new Date() } : {}),
    },
  });

  if (updateResult.count === 0) {
    throw new NotFoundError("Notification not found");
  }

  const notification = await db.notification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      linkUrl: true,
      metadata: true,
      isRead: true,
      sentAt: true,
      createdAt: true,
    },
  });

  if (!notification) {
    throw new NotFoundError("Notification not found");
  }

  return {
    ...notification,
    sentAt: notification.sentAt ? notification.sentAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function markAllAdminNotificationsRead(
  adminUserId: string,
  filters: { type?: NotificationType; query?: string } = {},
) {
  const queryText = normalizeOptionalText(filters.query);

  const result = await db.notification.updateMany({
    where: {
      userId: adminUserId,
      isRead: false,
      ...(filters.type ? { type: filters.type } : {}),
      ...(queryText
        ? {
            OR: [
              { title: { contains: queryText, mode: "insensitive" } },
              { message: { contains: queryText, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    data: {
      isRead: true,
      sentAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
}

export async function getAdminUnreadNotificationsCount(adminUserId: string) {
  return db.notification.count({
    where: {
      userId: adminUserId,
      isRead: false,
    },
  });
}
