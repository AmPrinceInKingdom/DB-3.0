import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { updateOrderStatus } from "@/lib/services/order-management-service";
import { adminOrderStatusUpdateSchema } from "@/lib/validators/order";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { orderId } = await context.params;
    const payload = adminOrderStatusUpdateSchema.parse(await request.json());

    const order = await updateOrderStatus({
      orderId,
      status: payload.status,
      note: payload.note,
      changedByUserId: auth.session.sub,
    });

    return ok(order);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update order status", 400, "ADMIN_ORDER_STATUS_UPDATE_FAILED");
  }
}
