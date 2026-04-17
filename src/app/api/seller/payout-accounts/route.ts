import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { createSellerPayoutAccount } from "@/lib/services/seller-payout-service";
import { sellerPayoutAccountCreateSchema } from "@/lib/validators/seller-payout";

export async function POST(request: Request) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const payload = sellerPayoutAccountCreateSchema.parse(await request.json());
    const account = await createSellerPayoutAccount(auth.session.sub, payload);
    return ok(account, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to create payout account", 400, "SELLER_PAYOUT_ACCOUNT_CREATE_FAILED");
  }
}
