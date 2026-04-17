import { fail, ok } from "@/lib/api-response";
import { requestEmailVerification } from "@/lib/auth/auth-service";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { emailVerificationRequestSchema } from "@/lib/validators/auth";

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
    scope: "auth:email-verification-request",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const payload = emailVerificationRequestSchema.parse(await request.json());
    const emailRateLimitError = enforceRateLimit(request, {
      scope: "auth:email-verification-request-email",
      keyPart: payload.email,
      limit: 4,
      windowMs: 10 * 60 * 1000,
    });
    if (emailRateLimitError) return emailRateLimitError;

    const result = await requestEmailVerification(payload, {
      appUrl: resolveAppUrlFromRequest(request),
      includeDebugArtifacts: process.env.NODE_ENV !== "production",
    });

    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to send email verification", 500, "EMAIL_VERIFICATION_REQUEST_FAILED");
  }
}
