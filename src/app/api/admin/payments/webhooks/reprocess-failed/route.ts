import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { AppError } from "@/lib/errors";
import { createAuditLog, getAuditMetaFromRequest } from "@/lib/services/audit-log-service";
import { replayStripeWebhookEventById } from "@/lib/services/card-payment-service";
import { listAdminPaymentWebhookEvents } from "@/lib/services/payment-webhook-service";

const defaultBatchLimit = 10;
const maxBatchLimit = 20;

type ReprocessRequestBody = {
  eventIds?: string[];
  limit?: number;
};

function parseBodyLimit(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultBatchLimit;
  const normalized = Math.floor(value);
  if (normalized < 1) return defaultBatchLimit;
  return Math.min(normalized, maxBatchLimit);
}

function parseBodyEventIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  const meta = getAuditMetaFromRequest(request);

  try {
    let body: ReprocessRequestBody = {};
    try {
      body = (await request.json()) as ReprocessRequestBody;
    } catch {
      body = {};
    }

    const limit = parseBodyLimit(body.limit);
    const requestedEventIds = parseBodyEventIds(body.eventIds);
    const eventFilterSet = requestedEventIds.length > 0 ? new Set(requestedEventIds) : null;

    const queryLimit = eventFilterSet ? Math.max(120, requestedEventIds.length * 6) : 240;
    const recentEvents = await listAdminPaymentWebhookEvents({ limit: queryLimit });
    const actionRequiredEvents = recentEvents.filter((event) => !event.success || !event.handled);
    const filteredEvents = eventFilterSet
      ? actionRequiredEvents.filter((event) => eventFilterSet.has(event.id))
      : actionRequiredEvents;
    const selectedEvents = filteredEvents.slice(0, limit);

    let succeeded = 0;
    let failed = 0;

    const results: Array<{
      webhookEventId: string;
      eventType: string;
      reference: string | null;
      success: boolean;
      handled: boolean;
      errorCode: string | null;
      errorMessage: string | null;
    }> = [];

    for (const event of selectedEvents) {
      try {
        const replay = await replayStripeWebhookEventById(event.id);
        succeeded += 1;
        results.push({
          webhookEventId: event.id,
          eventType: event.eventType,
          reference: replay.reference ?? event.reference,
          success: true,
          handled: replay.handled,
          errorCode: null,
          errorMessage: null,
        });

        try {
          await createAuditLog({
            actorUserId: auth.session.sub,
            action: "PAYMENT_WEBHOOK_REPROCESSED",
            targetTable: "payment_webhook_events",
            targetId: event.id,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            newValues: {
              source: "BATCH_REPROCESS",
              success: true,
              handled: replay.handled,
              eventType: replay.eventType,
              reference: replay.reference,
              paymentStatus: replay.paymentStatus ?? null,
              orderStatus: replay.orderStatus ?? null,
            },
          });
        } catch {
          // Keep batch processing successful even if audit log creation fails.
        }
      } catch (error) {
        failed += 1;
        const errorCode = error instanceof AppError ? error.code : "STRIPE_WEBHOOK_REPLAY_FAILED";
        const errorMessage =
          error instanceof Error ? error.message : "Unable to replay Stripe webhook event";

        results.push({
          webhookEventId: event.id,
          eventType: event.eventType,
          reference: event.reference,
          success: false,
          handled: false,
          errorCode,
          errorMessage,
        });

        try {
          await createAuditLog({
            actorUserId: auth.session.sub,
            action: "PAYMENT_WEBHOOK_REPROCESS_FAILED",
            targetTable: "payment_webhook_events",
            targetId: event.id,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            newValues: {
              source: "BATCH_REPROCESS",
              errorCode,
              errorMessage,
            },
          });
        } catch {
          // Ignore audit failures in failure path as well.
        }
      }
    }

    return ok({
      requestedCount: eventFilterSet ? requestedEventIds.length : limit,
      actionRequiredCount: actionRequiredEvents.length,
      selectedCount: selectedEvents.length,
      succeeded,
      failed,
      results,
    });
  } catch {
    return fail("Unable to reprocess webhook batch", 500, "PAYMENT_WEBHOOK_BATCH_REPROCESS_FAILED");
  }
}

