import { fail } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const sellerRoles = new Set(["SELLER", "ADMIN", "SUPER_ADMIN"]);

export async function requireSellerSession(options?: { requireActiveSellerProfile?: boolean }) {
  const session = await getCurrentSession();
  if (!session || !sellerRoles.has(session.role)) {
    return {
      allowed: false as const,
      response: fail("Seller access required", 403, "FORBIDDEN"),
    };
  }

  if (!options?.requireActiveSellerProfile) {
    return { allowed: true as const, session };
  }

  const seller = await db.seller.findUnique({
    where: { userId: session.sub },
    select: {
      status: true,
    },
  });

  if (!seller || seller.status !== "ACTIVE") {
    return {
      allowed: false as const,
      response: fail("Active seller profile required", 403, "SELLER_PROFILE_INACTIVE"),
    };
  }

  return { allowed: true as const, session };
}
