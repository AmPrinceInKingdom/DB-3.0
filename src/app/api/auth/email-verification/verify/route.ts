import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { verifyEmailWithToken } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { emailVerificationTokenSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:email-verification-verify",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const payload = emailVerificationTokenSchema.parse(await request.json());
    const result = await verifyEmailWithToken(payload);

    const response = NextResponse.json({
      success: true,
      data: {
        user: result.user,
        message: result.message,
      },
    });
    await setSessionCookie(response, result.token);
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to verify email", 500, "EMAIL_VERIFICATION_FAILED");
  }
}
