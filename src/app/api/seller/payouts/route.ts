import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import { getSellerPayoutWorkspace } from "@/lib/services/seller-payout-service";

export async function GET() {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const data = await getSellerPayoutWorkspace(auth.session.sub);
    return ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to load seller payouts", 500, "SELLER_PAYOUTS_FETCH_FAILED");
  }
}
