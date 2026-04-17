import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { markCustomerNotificationRead } from "@/lib/services/customer-notification-service";
import { customerNotificationUpdateSchema } from "@/lib/validators/notification";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const { notificationId } = await context.params;
    const payload = customerNotificationUpdateSchema.parse(await request.json());

    const notification = await markCustomerNotificationRead(
      session.sub,
      notificationId,
      payload.isRead,
    );

    return ok(notification);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update notification", 400, "ACCOUNT_NOTIFICATION_UPDATE_FAILED");
  }
}
