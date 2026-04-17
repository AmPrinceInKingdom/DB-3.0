import { fail, ok } from "@/lib/api-response";
import { resetPasswordWithToken } from "@/lib/auth/auth-service";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { resetPasswordSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:reset-password",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const payload = resetPasswordSchema.parse(await request.json());
    const result = await resetPasswordWithToken(payload);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }

    return fail("Unable to reset password", 500, "RESET_PASSWORD_FAILED");
  }
}
