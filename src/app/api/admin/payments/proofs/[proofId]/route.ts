import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { createAuditLog, getAuditMetaFromRequest } from "@/lib/services/audit-log-service";
import { reviewPaymentProof } from "@/lib/services/order-management-service";
import { paymentProofReviewSchema } from "@/lib/validators/order";

type RouteContext = {
  params: Promise<{ proofId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { proofId } = await context.params;
    const payload = paymentProofReviewSchema.parse(await request.json());

    const proof = await reviewPaymentProof({
      proofId,
      action: payload.action,
      reason: payload.reason,
      reviewedByUserId: auth.session.sub,
    });

    const meta = getAuditMetaFromRequest(request);
    try {
      await createAuditLog({
        actorUserId: auth.session.sub,
        action: payload.action === "APPROVE" ? "PAYMENT_PROOF_APPROVED" : "PAYMENT_PROOF_REJECTED",
        targetTable: "payment_proofs",
        targetId: proof.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        newValues: {
          orderId: proof.orderId,
          verificationStatus: proof.verificationStatus,
          rejectionReason: proof.rejectionReason,
          reviewedAt: proof.verifiedAt,
        },
      });
    } catch {
      // Keep primary payment proof action successful even if audit logging fails.
    }

    return ok(proof);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to review payment proof", 400, "PAYMENT_PROOF_REVIEW_FAILED");
  }
}
