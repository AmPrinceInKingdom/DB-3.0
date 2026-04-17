import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { loginUser } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:login",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const payload = loginSchema.parse(await request.json());
    const result = await loginUser(payload);

    const response = NextResponse.json({
      success: true,
      data: result.user,
    });

    await setSessionCookie(response, result.token);
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }

    return fail("Unable to sign in", 500, "LOGIN_FAILED");
  }
}
