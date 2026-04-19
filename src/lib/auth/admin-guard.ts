import { fail } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

export async function requireAdminSession() {
  const session = await getCurrentSession();
  if (!session || !adminRoles.has(session.role)) {
    return {
      allowed: false as const,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    return {
      allowed: false as const,
      response: fail("Admin session is invalid. Please sign in again.", 401, "ADMIN_SESSION_INVALID"),
    };
  }

  if (!adminRoles.has(user.role)) {
    return {
      allowed: false as const,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    };
  }

  return {
    allowed: true as const,
    session: {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
  };
}
