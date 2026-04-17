import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireSellerSession } from "@/lib/auth/seller-guard";
import {
  getMySellerStoreProfile,
  updateMySellerStoreProfile,
} from "@/lib/services/seller-service";
import { sellerStoreProfileUpdateSchema } from "@/lib/validators/seller";

export async function GET() {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const payload = await getMySellerStoreProfile(auth.session.sub);
    return ok(payload);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch store profile", 500, "SELLER_STORE_FETCH_FAILED");
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSellerSession({ requireActiveSellerProfile: true });
  if (!auth.allowed) return auth.response;

  try {
    const payload = sellerStoreProfileUpdateSchema.parse(await request.json());
    const updated = await updateMySellerStoreProfile(auth.session.sub, payload);
    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update store profile", 400, "SELLER_STORE_UPDATE_FAILED");
  }
}
