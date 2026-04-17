import { NotificationType } from "@prisma/client";
import { z } from "zod";

export const adminNotificationUpdateSchema = z.object({
  isRead: z.boolean().optional().default(true),
});

export const adminNotificationsReadAllSchema = z.object({
  type: z.nativeEnum(NotificationType).optional(),
  query: z.string().trim().max(120).optional(),
});

export const customerNotificationUpdateSchema = adminNotificationUpdateSchema;

export const customerNotificationsReadAllSchema = adminNotificationsReadAllSchema;

export type AdminNotificationUpdateInput = z.infer<typeof adminNotificationUpdateSchema>;
export type AdminNotificationsReadAllInput = z.infer<typeof adminNotificationsReadAllSchema>;
export type CustomerNotificationUpdateInput = z.infer<typeof customerNotificationUpdateSchema>;
export type CustomerNotificationsReadAllInput = z.infer<typeof customerNotificationsReadAllSchema>;
