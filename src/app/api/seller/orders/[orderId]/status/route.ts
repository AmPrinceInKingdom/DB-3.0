import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { updateSellerOrderStatus } from "@/lib/services/seller-order-service";
import { sellerOrderStatusUpdateSchema } from "@/lib/validators/order";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const { orderId } = await context.params;
    const payload = sellerOrderStatusUpdateSchema.parse(await request.json());

    const order = await updateSellerOrderStatus({
      sellerUserId: auth.session.sub,
      orderId,
      status: payload.status,
      note: payload.note,
    });

    return ok(order);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update seller order status", 400, "SELLER_ORDER_STATUS_UPDATE_FAILED");
  }
}
