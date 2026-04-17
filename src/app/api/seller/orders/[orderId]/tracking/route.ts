import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { updateSellerOrderTracking } from "@/lib/services/seller-order-service";
import { sellerOrderTrackingUpdateSchema } from "@/lib/validators/order";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const { orderId } = await context.params;
    const payload = sellerOrderTrackingUpdateSchema.parse(await request.json());

    const tracking = await updateSellerOrderTracking({
      sellerUserId: auth.session.sub,
      orderId,
      trackingNumber: payload.trackingNumber,
      courierName: payload.courierName,
      shipmentStatus: payload.shipmentStatus,
      note: payload.note,
    });

    return ok(tracking);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update seller tracking details", 400, "SELLER_TRACKING_UPDATE_FAILED");
  }
}
