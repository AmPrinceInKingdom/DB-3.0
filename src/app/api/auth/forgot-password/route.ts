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

  const ipRateLimitError = enforceRateLimit(request, {
    scope: "auth:forgot-password-ip",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (ipRateLimitError) return ipRateLimitError;

  try {
    const parsedPayload = forgotPasswordSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return fail("Please enter a valid email address.", 400, "INVALID_INPUT");
    }

    const payload = parsedPayload.data;
    const emailRateLimitError = enforceRateLimit(request, {
      scope: "auth:forgot-password-email",
      limit: 4,
      windowMs: 30 * 60 * 1000,
      keyPart: payload.email,
    });
    if (emailRateLimitError) return emailRateLimitError;

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
