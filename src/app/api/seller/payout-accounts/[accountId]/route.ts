import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import {
  deleteSellerPayoutAccount,
  updateSellerPayoutAccount,
} from "@/lib/services/seller-payout-service";
import { sellerPayoutAccountUpdateSchema } from "@/lib/validators/seller-payout";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const { accountId } = await context.params;
    const payload = sellerPayoutAccountUpdateSchema.parse(await request.json());
    const account = await updateSellerPayoutAccount(auth.session.sub, accountId, payload);
    return ok(account);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update payout account", 400, "SELLER_PAYOUT_ACCOUNT_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const { accountId } = await context.params;
    const result = await deleteSellerPayoutAccount(auth.session.sub, accountId);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to delete payout account", 400, "SELLER_PAYOUT_ACCOUNT_DELETE_FAILED");
  }
}
