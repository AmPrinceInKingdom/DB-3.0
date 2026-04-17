import { fail, ok } from "@/lib/api-response";
import { requestPasswordReset } from "@/lib/auth/auth-service";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { forgotPasswordSchema } from "@/lib/validators/auth";

function resolveAppUrlFromRequest(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl;

  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:forgot-password",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const payload = forgotPasswordSchema.parse(await request.json());
    const result = await requestPasswordReset(payload, {
      appUrl: resolveAppUrlFromRequest(request),
      includeDebugToken: process.env.NODE_ENV !== "production",
    });

    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }

    return fail("Unable to process password reset request", 500, "FORGOT_PASSWORD_FAILED");
  }
}
