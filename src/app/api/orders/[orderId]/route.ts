import { fail, ok } from "@/lib/api-response";
import { getOrderSummary } from "@/lib/services/checkout-service";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orderId } = await context.params;
    const order = await getOrderSummary(orderId);

    if (!order) {
      return fail("Order not found", 404, "ORDER_NOT_FOUND");
    }

    return ok(order);
  } catch {
    return fail("Unable to fetch order", 500, "ORDER_FETCH_FAILED");
  }
}
