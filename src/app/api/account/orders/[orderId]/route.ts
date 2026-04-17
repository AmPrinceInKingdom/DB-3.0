import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { getCustomerOrderDetail } from "@/lib/services/order-management-service";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return fail("Authentication required", 401, "UNAUTHENTICATED");
    }

    const { orderId } = await context.params;
    const order = await getCustomerOrderDetail(session.sub, orderId);

    if (!order) {
      return fail("Order not found", 404, "ORDER_NOT_FOUND");
    }

    return ok(order);
  } catch {
    return fail("Unable to fetch order details", 500, "ACCOUNT_ORDER_FETCH_FAILED");
  }
}
