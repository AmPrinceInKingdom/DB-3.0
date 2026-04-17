import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { updateAdminPayout } from "@/lib/services/seller-payout-service";
import { adminUpdatePayoutSchema } from "@/lib/validators/seller-payout";

type RouteContext = {
  params: Promise<{ payoutId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { payoutId } = await context.params;
    const payload = adminUpdatePayoutSchema.parse(await request.json());
    const updated = await updateAdminPayout(payoutId, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update payout", 400, "ADMIN_PAYOUT_UPDATE_FAILED");
  }
}
