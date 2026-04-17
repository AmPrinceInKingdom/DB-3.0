import { OrderStatus, PaymentStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminOrders } from "@/lib/services/order-management-service";

const allowedOrderStatuses = new Set(Object.values(OrderStatus));
const allowedPaymentStatuses = new Set(Object.values(PaymentStatus));

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const statusQuery = url.searchParams.get("status");
    const paymentStatusQuery = url.searchParams.get("paymentStatus");
    const searchQuery = url.searchParams.get("q");

    const status =
      statusQuery && allowedOrderStatuses.has(statusQuery as OrderStatus)
        ? (statusQuery as OrderStatus)
        : undefined;
    const paymentStatus =
      paymentStatusQuery && allowedPaymentStatuses.has(paymentStatusQuery as PaymentStatus)
        ? (paymentStatusQuery as PaymentStatus)
        : undefined;

    const orders = await listAdminOrders({
      status,
      paymentStatus,
      query: searchQuery ?? undefined,
    });

    return ok(orders);
  } catch {
    return fail("Unable to fetch admin orders", 500, "ADMIN_ORDERS_FETCH_FAILED");
  }
}
