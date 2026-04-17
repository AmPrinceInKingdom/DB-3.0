import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import {
  listAccountCompareItems,
  replaceAccountCompareItems,
} from "@/lib/services/account-collection-sync-service";
import { accountCompareSyncSchema } from "@/lib/validators/account-collection-sync";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const items = await listAccountCompareItems(session.sub);
    return ok({ items });
  } catch {
    return fail("Unable to fetch compare list", 500, "ACCOUNT_COMPARE_FETCH_FAILED");
  }
}

export async function PUT(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return fail("Authentication required", 401, "UNAUTHENTICATED");
  }

  try {
    const payload = accountCompareSyncSchema.parse(await request.json());
    const items = await replaceAccountCompareItems(session.sub, payload);
    return ok({ items });
  } catch {
    return fail("Unable to sync compare list", 400, "ACCOUNT_COMPARE_SYNC_FAILED");
  }
}
