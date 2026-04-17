import { fail, ok } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import {
  completeCardPaymentByToken,
  getCardPaymentSessionByToken,
} from "@/lib/services/card-payment-service";
import {
  completeCardPaymentSessionSchema,
  getCardPaymentSessionSchema,
} from "@/lib/validators/card-payment";

export async function GET(request: Request) {
  const rateLimitError = enforceRateLimit(request, {
    scope: "payments:card-session-read",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const url = new URL(request.url);
    const query = getCardPaymentSessionSchema.parse({
      token: url.searchParams.get("token") ?? "",
    });

    const data = await getCardPaymentSessionByToken(query.token);
    return ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to fetch card payment session", 400, "CARD_SESSION_FETCH_FAILED");
  }
}

export async function PATCH(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  try {
    const payload = completeCardPaymentSessionSchema.parse(await request.json());
    const rateLimitError = enforceRateLimit(request, {
      scope: "payments:card-session-complete",
      limit: 30,
      windowMs: 10 * 60 * 1000,
      keyPart: payload.token,
    });
    if (rateLimitError) return rateLimitError;

    const result = await completeCardPaymentByToken(payload);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to process card payment", 400, "CARD_PAYMENT_PROCESS_FAILED");
  }
}
