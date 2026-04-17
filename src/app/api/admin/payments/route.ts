import { PaymentStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminPaymentProofs } from "@/lib/services/order-management-service";

const allowedStatuses = new Set(Object.values(PaymentStatus));

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const verificationStatusQuery = url.searchParams.get("verificationStatus");
    const verificationStatus =
      verificationStatusQuery && allowedStatuses.has(verificationStatusQuery as PaymentStatus)
        ? (verificationStatusQuery as PaymentStatus)
        : undefined;

    const proofs = await listAdminPaymentProofs({ verificationStatus });
    return ok(proofs);
  } catch {
    return fail("Unable to fetch payment proofs", 500, "ADMIN_PAYMENT_PROOFS_FETCH_FAILED");
  }
}
