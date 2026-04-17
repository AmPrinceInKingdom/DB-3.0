import { fail } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

export async function requireAdminSession() {
  const session = await getCurrentSession();
  if (!session || !adminRoles.has(session.role)) {
    return {
      allowed: false as const,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    };
  }

  return { allowed: true as const, session };
}

