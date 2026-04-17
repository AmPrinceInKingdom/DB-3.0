import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { retryCardPaymentSession } from "@/lib/services/card-payment-service";
import { retryCardPaymentSchema } from "@/lib/validators/card-payment";

export async function POST(request: Request) {
  try {
    const payload = retryCardPaymentSchema.parse(await request.json());
    const session = await getCurrentSession();

    const result = await retryCardPaymentSession({
      orderId: payload.orderId,
      customerEmail: payload.customerEmail,
      session,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to retry card payment", 400, "CARD_RETRY_FAILED");
  }
}
