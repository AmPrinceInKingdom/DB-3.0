import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getAdminOrderDetail } from "@/lib/services/order-management-service";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { orderId } = await context.params;
    const order = await getAdminOrderDetail(orderId);

    if (!order) {
      return fail("Order not found", 404, "ORDER_NOT_FOUND");
    }

    return ok(order);
  } catch {
    return fail("Unable to fetch order details", 500, "ADMIN_ORDER_DETAIL_FETCH_FAILED");
  }
}
