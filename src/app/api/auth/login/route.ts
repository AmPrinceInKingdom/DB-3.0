import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { loginUser } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { loginSchema } from "@/lib/validators/auth";

function classifyLoginFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("jwt_secret") ||
    message.includes("environment variable not found: database_url") ||
    message.includes("environment variable not found: direct_url")
  ) {
    return fail(
      "Sign-in service is temporarily unavailable. Please try again shortly.",
      503,
      "AUTH_CONFIG_ERROR",
    );
  }

  if (
    message.includes("the table") ||
    message.includes("does not exist") ||
    message.includes("p2021")
  ) {
    return fail(
      "Database schema is not ready yet. Please try again after setup.",
      503,
      "AUTH_SCHEMA_MISSING",
    );
  }

  if (
    message.includes("tenant or user not found") ||
    message.includes("authentication failed against database server")
  ) {
    return fail(
      "Database credentials are invalid for this deployment.",
      503,
      "AUTH_DB_CREDENTIALS_INVALID",
    );
  }

  if (
    message.includes("database_url") ||
    message.includes("can't reach database server") ||
    message.includes("prisma")
  ) {
    return fail(
      "Sign-in service is temporarily unavailable. Please try again shortly.",
      503,
      "AUTH_DB_UNAVAILABLE",
    );
  }

  return null;
}

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

    if (process.env.NODE_ENV !== "test") {
      console.error("[auth.login] unexpected failure", error);
    }

    const classifiedFailure = classifyLoginFailure(error);
    if (classifiedFailure) {
      return classifiedFailure;
    }

    return fail("Unable to sign in", 500, "LOGIN_FAILED");
  }
}
