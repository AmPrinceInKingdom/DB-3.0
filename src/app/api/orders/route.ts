import { attachRequestId, fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { sendObservabilityAlert } from "@/lib/observability/alerting";
import { logApiFailure, resolveRequestId } from "@/lib/observability/request-context";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { createOrder } from "@/lib/services/checkout-service";
import { createOrderSchema } from "@/lib/validators/checkout";
import { Prisma } from "@prisma/client";

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,120}$/;

function parseIdempotencyKey(request: Request) {
  const raw =
    request.headers.get("idempotency-key") ??
    request.headers.get("x-idempotency-key");
  if (!raw) return null;

  const normalized = raw.trim();
  if (!idempotencyKeyPattern.test(normalized)) {
    throw new AppError(
      "Idempotency key is invalid. Use 8-120 chars with letters, numbers, dot, colon, underscore, or hyphen.",
      400,
      "IDEMPOTENCY_KEY_INVALID",
    );
  }

  return normalized;
}

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  const originError = enforceSameOriginMutation(request);
  if (originError) return attachRequestId(originError, requestId);

  try {
    const session = await getCurrentSession();
    const rateLimitError = enforceRateLimit(request, {
      scope: "checkout:create-order",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      keyPart: session?.sub ?? null,
    });
    if (rateLimitError) return attachRequestId(rateLimitError, requestId);

    const parsedPayload = createOrderSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return fail(
        "Invalid checkout payload. Please refresh cart and try again.",
        { status: 400, requestId },
        "ORDER_PAYLOAD_INVALID",
      );
    }

    const payload = parsedPayload.data;
    const clientRequestId = parseIdempotencyKey(request);
    const order = await createOrder(payload, session, { clientRequestId });

    return ok(order, { status: 201, requestId });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, { status: error.status, requestId }, error.code);
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return fail(
        "Database connection is unavailable. Please check Supabase connection settings and try again.",
        { status: 503, requestId },
        "DATABASE_UNAVAILABLE",
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P1000") {
        return fail(
          "Database authentication failed. Please verify Supabase database username/password.",
          { status: 503, requestId },
          "DATABASE_AUTH_FAILED",
        );
      }
      if (error.code === "P1001") {
        return fail(
          "Cannot reach the database server. Please check Supabase host/port and network access.",
          { status: 503, requestId },
          "DATABASE_UNREACHABLE",
        );
      }
      if (error.code === "P2022" || error.code === "P2021") {
        return fail(
          "Database schema is outdated. Please run the latest SQL update or `npx prisma db push`.",
          { status: 503, requestId },
          "DATABASE_SCHEMA_OUTDATED",
        );
      }
    }
    logApiFailure({ scope: "orders.create", requestId, error });
    void sendObservabilityAlert({
      scope: "api.orders.create",
      severity: "critical",
      title: "Checkout order creation failed unexpectedly",
      message: "Order create API returned an unclassified error.",
      requestId,
      metadata: {
        route: "/api/orders",
      },
    });
    return fail("Unable to place order", { status: 400, requestId }, "ORDER_CREATE_FAILED");
  }
}
