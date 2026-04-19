import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { reviewAdminSellerApplication } from "@/lib/services/seller-service";
import { createAuditLog, getAuditMetaFromRequest } from "@/lib/services/audit-log-service";
import { adminSellerReviewSchema } from "@/lib/validators/seller";

type RouteContext = {
  params: Promise<{ sellerUserId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { sellerUserId } = await context.params;
    const payload = adminSellerReviewSchema.parse(await request.json());

    const updated = await reviewAdminSellerApplication({
      sellerUserId,
      actorUserId: auth.session.sub,
      action: payload.action,
      reason: payload.reason,
    });

    try {
      const auditMeta = getAuditMetaFromRequest(request);
      await createAuditLog({
        actorUserId: auth.session.sub,
        action: "SELLER_APPLICATION_REVIEWED",
        targetTable: "sellers",
        targetId: sellerUserId,
        ipAddress: auditMeta.ipAddress,
        userAgent: auditMeta.userAgent,
        newValues: {
          action: payload.action,
          reason: payload.reason ?? null,
          sellerStatus: updated.status,
          userRole: updated.user.role,
        },
      });
    } catch {
      // Keep seller review successful even when audit logging fails.
    }

    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }

    if (error instanceof ZodError) {
      return fail("Invalid seller action payload", 400, "ADMIN_SELLER_VALIDATION_FAILED");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2028" || error.code === "P2034") {
        return fail(
          "Database is busy right now. Please retry seller action in a few seconds.",
          503,
          "ADMIN_SELLER_DB_BUSY",
        );
      }
      if (error.code === "P2003") {
        return fail(
          "Admin session is invalid. Please sign in again.",
          401,
          "ADMIN_SESSION_INVALID",
        );
      }
      return fail("Unable to update seller application", 500, "ADMIN_SELLER_UPDATE_FAILED");
    }

    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return fail(
        "Database is temporarily unavailable. Please try again shortly.",
        503,
        "ADMIN_SELLER_DB_UNAVAILABLE",
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.error("[admin.sellers] update failed", error);
    }
    return fail("Unable to update seller application", 500, "ADMIN_SELLER_UPDATE_FAILED");
  }
}
