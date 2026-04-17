import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { replaceAccountSavedCartItems, listAccountSavedCartItems } from "@/lib/services/account-saved-cart-service";
import { accountSavedCartSyncSchema } from "@/lib/validators/account-saved-cart";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const items = await listAccountSavedCartItems(session.sub);
    return ok({ items });
  } catch {
    return fail("Unable to fetch saved cart items", 500, "ACCOUNT_SAVED_CART_FETCH_FAILED");
  }
}

export async function PUT(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = accountSavedCartSyncSchema.parse(await request.json());
    const items = await replaceAccountSavedCartItems(session.sub, payload);
    return ok({ items });
  } catch {
    return fail("Unable to sync saved cart items", 400, "ACCOUNT_SAVED_CART_SYNC_FAILED");
  }
}
