import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { AppError } from "@/lib/errors";
import { markAllAdminNotificationsRead } from "@/lib/services/admin-notification-service";
import { adminNotificationsReadAllSchema } from "@/lib/validators/notification";

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = adminNotificationsReadAllSchema.parse(await request.json());

    const result = await markAllAdminNotificationsRead(auth.session.sub, {
      type: payload.type,
      query: payload.query,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to mark notifications as read", 400, "ADMIN_NOTIFICATIONS_MARK_ALL_FAILED");
  }
}
