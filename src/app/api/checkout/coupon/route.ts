import { fail, ok } from "@/lib/api-response";
import { getCurrentSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { previewCheckoutCoupon } from "@/lib/services/checkout-service";
import { previewCouponSchema } from "@/lib/validators/checkout";

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  try {
    const session = await getCurrentSession();
    const rateLimitError = enforceRateLimit(request, {
      scope: "checkout:coupon-preview",
      limit: 45,
      windowMs: 10 * 60 * 1000,
      keyPart: session?.sub ?? null,
    });
    if (rateLimitError) return rateLimitError;

    const parsedPayload = previewCouponSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return fail(
        "Invalid coupon preview payload. Please refresh checkout and try again.",
        400,
        "COUPON_PREVIEW_PAYLOAD_INVALID",
      );
    }

    const payload = parsedPayload.data;
    const preview = await previewCheckoutCoupon(payload, session);
    return ok(preview);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to validate coupon", 400, "COUPON_PREVIEW_FAILED");
  }
}
