import { attachRequestId, fail, ok } from "@/lib/api-response";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { sendObservabilityAlert } from "@/lib/observability/alerting";
import { logApiFailure, resolveRequestId } from "@/lib/observability/request-context";
import { processStripeWebhook } from "@/lib/services/card-payment-service";
import {
  createPaymentWebhookEventLog,
  findSuccessfulPaymentWebhookEventByEventId,
} from "@/lib/services/payment-webhook-service";
import { enforceRateLimit } from "@/lib/security/request-security";

type StripeWebhookLogContext = {
  eventId: string | null;
  eventType: string | null;
  reference: string | null;
  payload: Record<string, unknown>;
};

const maxStripeWebhookBodyBytes = 1_000_000;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function extractReferenceFromObject(eventObject: Record<string, unknown>) {
  const metadata = toRecord(eventObject.metadata);
  const metadataReference = toStringValue(metadata?.db_reference);
  if (metadataReference) return metadataReference;

  const clientReferenceId = toStringValue(eventObject.client_reference_id);
  if (clientReferenceId) return clientReferenceId;

  return null;
}

function buildStripeWebhookLogContext(rawBody: string): StripeWebhookLogContext {
  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = toRecord(payload.data);
    const eventObject = toRecord(data?.object) ?? {};
    const eventId = toStringValue(payload.id);
    const eventType = toStringValue(payload.type);
    const reference = extractReferenceFromObject(eventObject);

    return {
      eventId,
      eventType,
      reference,
      payload: {
        id: eventId,
        type: eventType,
        created: payload.created ?? null,
        livemode: payload.livemode ?? null,
        object: {
          id: toStringValue(eventObject.id),
          clientReferenceId: toStringValue(eventObject.client_reference_id),
          paymentStatus: toStringValue(eventObject.payment_status),
          metadata: toRecord(eventObject.metadata) ?? null,
        },
      },
    };
  } catch {
    return {
      eventId: null,
      eventType: null,
      reference: null,
      payload: {
        parseError: true,
        size: rawBody.length,
      },
    };
  }
}

async function safeLogWebhookEvent(input: {
  eventId?: string | null;
  eventType?: string | null;
  reference?: string | null;
  handled: boolean;
  success: boolean;
  paymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  payload?: unknown;
}) {
  try {
    await createPaymentWebhookEventLog({
      provider: "STRIPE",
      eventId: input.eventId,
      eventType: input.eventType,
      reference: input.reference,
      handled: input.handled,
      success: input.success,
      paymentStatus: input.paymentStatus,
      orderStatus: input.orderStatus,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      payload: input.payload,
    });
  } catch {
    // Webhook responses should not fail due to logging issues.
  }
}

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  const rateLimitError = enforceRateLimit(request, {
    scope: "payments:stripe-webhook",
    limit: 240,
    windowMs: 60 * 1000,
  });
  if (rateLimitError) return attachRequestId(rateLimitError, requestId);

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  const context = buildStripeWebhookLogContext(rawBody);

  if (rawBody.length > maxStripeWebhookBodyBytes) {
    await safeLogWebhookEvent({
      eventId: context.eventId,
      eventType: context.eventType,
      reference: context.reference,
      handled: false,
      success: false,
      errorCode: "STRIPE_WEBHOOK_PAYLOAD_TOO_LARGE",
      errorMessage: "Stripe webhook payload exceeded maximum allowed size.",
      payload: {
        ...context.payload,
        payloadSize: rawBody.length,
      },
    });

    return fail(
      "Stripe webhook payload is too large.",
      { status: 413, requestId },
      "STRIPE_WEBHOOK_PAYLOAD_TOO_LARGE",
    );
  }

  if (context.eventId) {
    const processedEvent = await findSuccessfulPaymentWebhookEventByEventId("STRIPE", context.eventId);
    if (processedEvent) {
      return ok({
        handled: processedEvent.handled,
        duplicate: true,
        eventId: processedEvent.eventId,
        eventType: processedEvent.eventType,
        reference: processedEvent.reference,
        paymentStatus: processedEvent.paymentStatus,
        orderStatus: processedEvent.orderStatus,
      }, { requestId });
    }
  }

  try {
    const result = await processStripeWebhook(rawBody, signatureHeader);

    await safeLogWebhookEvent({
      eventId: result.eventId ?? context.eventId,
      eventType: result.eventType ?? context.eventType,
      reference: result.reference ?? context.reference,
      handled: result.handled,
      success: true,
      paymentStatus: result.paymentStatus,
      orderStatus: result.orderStatus,
      payload: context.payload,
    });

    return ok(result, { requestId });
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : "STRIPE_WEBHOOK_FAILED";
    const errorMessage =
      error instanceof Error ? error.message : "Unable to process Stripe webhook";

    await safeLogWebhookEvent({
      eventId: context.eventId,
      eventType: context.eventType,
      reference: context.reference,
      handled: false,
      success: false,
      errorCode,
      errorMessage,
      payload: context.payload,
    });

    if (error instanceof AppError) {
      return fail(error.message, { status: error.status, requestId }, error.code);
    }

    logApiFailure({
      scope: "payments.stripe-webhook",
      requestId,
      error,
      metadata: {
        eventId: context.eventId,
        eventType: context.eventType,
        reference: context.reference,
      },
    });
    void sendObservabilityAlert({
      scope: "api.payments.stripe-webhook",
      severity: "warning",
      title: "Stripe webhook processing failure",
      message: "Stripe webhook route returned an unexpected runtime error.",
      requestId,
      fingerprint: context.eventType ?? "stripe-webhook-unknown-event",
      metadata: {
        route: "/api/payments/card/stripe/webhook",
        eventId: context.eventId,
        eventType: context.eventType,
        reference: context.reference,
      },
    });

    return fail(
      "Unable to process Stripe webhook",
      { status: 400, requestId },
      "STRIPE_WEBHOOK_FAILED",
    );
  }
}
