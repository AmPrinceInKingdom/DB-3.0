import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { AppError } from "@/lib/errors";
import { markAdminNotificationRead } from "@/lib/services/admin-notification-service";
import { adminNotificationUpdateSchema } from "@/lib/validators/notification";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { notificationId } = await context.params;
    const payload = adminNotificationUpdateSchema.parse(await request.json());

    const notification = await markAdminNotificationRead(
      auth.session.sub,
      notificationId,
      payload.isRead,
    );

    return ok(notification);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update notification", 400, "ADMIN_NOTIFICATION_UPDATE_FAILED");
  }
}

