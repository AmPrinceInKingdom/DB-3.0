import { OrderStatus, PaymentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { listSellerOrders } from "@/lib/services/seller-order-service";

const allowedOrderStatuses = new Set(Object.values(OrderStatus));
const allowedPaymentStatuses = new Set(Object.values(PaymentStatus));

export async function GET(request: Request) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
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

    const data = await listSellerOrders(auth.session.sub, {
      status,
      paymentStatus,
      query: searchQuery ?? undefined,
    });

    return ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch seller orders", 500, "SELLER_ORDERS_FETCH_FAILED");
  }
}
