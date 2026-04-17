import { AccountStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminSellerApplications } from "@/lib/services/seller-service";

const allowedStatuses = new Set<AccountStatus>([
  AccountStatus.PENDING,
  AccountStatus.ACTIVE,
  AccountStatus.SUSPENDED,
]);

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const statusQuery = url.searchParams.get("status");

    const status =
      statusQuery && allowedStatuses.has(statusQuery as AccountStatus)
        ? (statusQuery as AccountStatus)
        : undefined;

    const sellers = await listAdminSellerApplications({
      query: query ?? undefined,
      status,
    });

    return ok(sellers);
  } catch {
    return fail("Unable to fetch seller applications", 500, "ADMIN_SELLERS_FETCH_FAILED");
  }
}
