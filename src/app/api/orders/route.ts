import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { createOrder } from "@/lib/services/checkout-service";
import { createOrderSchema } from "@/lib/validators/checkout";

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  try {
    const session = await getCurrentSession();
    const rateLimitError = enforceRateLimit(request, {
      scope: "checkout:create-order",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      keyPart: session?.sub ?? null,
    });
    if (rateLimitError) return rateLimitError;

    const payload = createOrderSchema.parse(await request.json());
    const order = await createOrder(payload, session);

    return ok(order, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to place order", 400, "ORDER_CREATE_FAILED");
  }
}
