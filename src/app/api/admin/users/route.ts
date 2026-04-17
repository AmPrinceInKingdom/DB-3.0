import { AccountStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminUsers } from "@/lib/services/admin-user-service";

const allowedRoles = new Set(Object.values(UserRole));
const allowedStatuses = new Set(Object.values(AccountStatus));

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const roleQuery = url.searchParams.get("role");
    const statusQuery = url.searchParams.get("status");
    const searchQuery = url.searchParams.get("q");

    const role =
      roleQuery && allowedRoles.has(roleQuery as UserRole)
        ? (roleQuery as UserRole)
        : undefined;
    const status =
      statusQuery && allowedStatuses.has(statusQuery as AccountStatus)
        ? (statusQuery as AccountStatus)
        : undefined;

    const users = await listAdminUsers({
      role,
      status,
      query: searchQuery ?? undefined,
    });

    return ok(users);
  } catch {
    return fail("Unable to fetch users", 500, "ADMIN_USERS_FETCH_FAILED");
  }
}
