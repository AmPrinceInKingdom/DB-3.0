import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { AppError } from "@/lib/errors";
import { createAuditLog, getAuditMetaFromRequest } from "@/lib/services/audit-log-service";
import { replayStripeWebhookEventById } from "@/lib/services/card-payment-service";

type RouteContext = {
  params: Promise<{ webhookEventId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  const { webhookEventId } = await context.params;
  const meta = getAuditMetaFromRequest(_request);

  try {
    const result = await replayStripeWebhookEventById(webhookEventId);

    try {
      await createAuditLog({
        actorUserId: auth.session.sub,
        action: "PAYMENT_WEBHOOK_REPROCESSED",
        targetTable: "payment_webhook_events",
        targetId: webhookEventId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        newValues: {
          success: result.success,
          handled: result.handled,
          eventType: result.eventType,
          reference: result.reference,
          paymentStatus: result.paymentStatus ?? null,
          orderStatus: result.orderStatus ?? null,
        },
      });
    } catch {
      // Keep primary webhook reprocess successful even if audit logging fails.
    }

    return ok(result);
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : "STRIPE_WEBHOOK_REPLAY_FAILED";
    const errorMessage =
      error instanceof Error ? error.message : "Unable to replay Stripe webhook event";

    try {
      await createAuditLog({
        actorUserId: auth.session.sub,
        action: "PAYMENT_WEBHOOK_REPROCESS_FAILED",
        targetTable: "payment_webhook_events",
        targetId: webhookEventId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        newValues: {
          errorCode,
          errorMessage,
        },
      });
    } catch {
      // Ignore audit errors in error path as well.
    }

    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to replay Stripe webhook event", 500, "STRIPE_WEBHOOK_REPLAY_FAILED");
  }
}
