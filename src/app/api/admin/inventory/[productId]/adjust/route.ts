import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { adjustAdminInventory } from "@/lib/services/admin-inventory-service";
import { inventoryAdjustmentSchema } from "@/lib/validators/inventory";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { productId } = await context.params;
    const payload = inventoryAdjustmentSchema.parse(await request.json());

    const updated = await adjustAdminInventory({
      productId,
      mode: payload.mode,
      amount: payload.amount,
      reason: payload.reason,
      actorUserId: auth.session.sub,
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to adjust inventory", 400, "ADMIN_INVENTORY_ADJUST_FAILED");
  }
}
