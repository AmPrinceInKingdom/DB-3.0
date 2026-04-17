import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import {
  listAccountWishlistItems,
  replaceAccountWishlistItems,
} from "@/lib/services/account-collection-sync-service";
import { accountWishlistSyncSchema } from "@/lib/validators/account-collection-sync";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const items = await listAccountWishlistItems(session.sub);
    return ok({ items });
  } catch {
    return fail("Unable to fetch wishlist", 500, "ACCOUNT_WISHLIST_FETCH_FAILED");
  }
}

export async function PUT(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = accountWishlistSyncSchema.parse(await request.json());
    const items = await replaceAccountWishlistItems(session.sub, payload);
    return ok({ items });
  } catch {
    return fail("Unable to sync wishlist", 400, "ACCOUNT_WISHLIST_SYNC_FAILED");
  }
}
