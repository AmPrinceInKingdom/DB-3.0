import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { updateOrderTracking } from "@/lib/services/order-management-service";
import { adminOrderTrackingUpdateSchema } from "@/lib/validators/order";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { orderId } = await context.params;
    const payload = adminOrderTrackingUpdateSchema.parse(await request.json());

    const tracking = await updateOrderTracking({
      orderId,
      trackingNumber: payload.trackingNumber,
      courierName: payload.courierName,
      shipmentStatus: payload.shipmentStatus,
      note: payload.note,
      updatedByUserId: auth.session.sub,
    });

    return ok(tracking);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update tracking details", 400, "ADMIN_TRACKING_UPDATE_FAILED");
  }
}
