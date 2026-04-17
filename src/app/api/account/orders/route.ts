import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { listCustomerOrders } from "@/lib/services/order-management-service";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return fail("Authentication required", 401, "UNAUTHENTICATED");
    }

    const orders = await listCustomerOrders(session.sub);
    return ok(orders);
  } catch {
    return fail("Unable to fetch orders", 500, "ACCOUNT_ORDERS_FETCH_FAILED");
  }
}
