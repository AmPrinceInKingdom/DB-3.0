import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { markAllCustomerNotificationsRead } from "@/lib/services/customer-notification-service";
import { customerNotificationsReadAllSchema } from "@/lib/validators/notification";

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = customerNotificationsReadAllSchema.parse(await request.json());

    const result = await markAllCustomerNotificationsRead(session.sub, {
      type: payload.type,
      query: payload.query,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to mark notifications as read", 400, "ACCOUNT_NOTIFICATIONS_MARK_ALL_FAILED");
  }
}
