import type { NotificationType } from "@prisma/client";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl: string | null;
  metadata: unknown;
  isRead: boolean;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationSummary = {
  totalCount: number;
  unreadCount: number;
  filteredUnreadCount: number;
};

export type NotificationPagination = {
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type NotificationsPayload = {
  items: NotificationItem[];
  summary: NotificationSummary;
  pagination: NotificationPagination;
};

export type AdminNotificationItem = NotificationItem;
export type AdminNotificationsPayload = NotificationsPayload;

export type CustomerNotificationItem = NotificationItem;
export type CustomerNotificationsPayload = NotificationsPayload;
