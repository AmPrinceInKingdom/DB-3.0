import { fail, ok } from "@/lib/api-response";
import { requestEmailVerificationOtp } from "@/lib/auth/auth-service";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { otpVerificationRequestSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:otp-request",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const payload = otpVerificationRequestSchema.parse(await request.json());
    const emailRateLimitError = enforceRateLimit(request, {
      scope: "auth:otp-request-email",
      keyPart: payload.email,
      limit: 4,
      windowMs: 10 * 60 * 1000,
    });
    if (emailRateLimitError) return emailRateLimitError;

    const result = await requestEmailVerificationOtp(payload, {
      includeDebugArtifacts: false,
    });

    return ok({
      message: result.message,
      otpExpiresAt: result.otpExpiresAt,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }

    const reason = error instanceof Error ? error.message : "Unknown server error";
    console.error("[auth][otp-request] Unexpected failure", error);

    if (process.env.NODE_ENV !== "production") {
      return fail(`Unable to send OTP: ${reason}`, 500, "OTP_REQUEST_FAILED");
    }

    return fail("Unable to send OTP", 500, "OTP_REQUEST_FAILED");
  }
}
