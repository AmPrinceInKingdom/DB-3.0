import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  deleteAdminCoupon,
  updateAdminCoupon,
} from "@/lib/services/admin-commerce-service";
import {
  normalizeOptionalCouponUpdate,
  updateCouponSchema,
} from "@/lib/validators/coupon";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    const payload = updateCouponSchema.parse(await request.json());
    const updated = await updateAdminCoupon(id, normalizeOptionalCouponUpdate(payload));
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update coupon", 400, "COUPON_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    await deleteAdminCoupon(id);
    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete coupon", 400, "COUPON_DELETE_FAILED");
  }
}
