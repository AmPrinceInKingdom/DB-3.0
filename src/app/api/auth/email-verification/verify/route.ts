import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { verifyEmailWithToken } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import {
  clearFailedVerificationAttempts,
  enforceFailureLock,
  enforceRateLimit,
  enforceSameOriginMutation,
  getRequestIp,
  recordFailedVerificationAttempt,
} from "@/lib/security/request-security";
import { emailVerificationTokenSchema } from "@/lib/validators/auth";

const emailTokenFailureScope = "auth:email-token-verify-failure";
const emailTokenFailureWindowMs = 15 * 60 * 1000;
const emailTokenFailureLockMs = 15 * 60 * 1000;
const emailTokenFailureMaxAttempts = 6;

function buildEmailTokenFailureIdentity(token: string, ip: string) {
  const tokenFingerprint = createHash("sha256").update(token).digest("hex").slice(0, 24);
  return `${tokenFingerprint}:${ip}`;
}

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:email-verification-verify",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  let failureIdentity = "";

  try {
    const parsedPayload = emailVerificationTokenSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return fail("Invalid verification token payload.", 400, "INVALID_INPUT");
    }

    const payload = parsedPayload.data;
    failureIdentity = buildEmailTokenFailureIdentity(payload.token, getRequestIp(request));
    const failureLockError = enforceFailureLock({
      scope: emailTokenFailureScope,
      identity: failureIdentity,
      maxFailures: emailTokenFailureMaxAttempts,
      windowMs: emailTokenFailureWindowMs,
      lockMs: emailTokenFailureLockMs,
      lockedCode: "EMAIL_VERIFICATION_LOCKED",
      lockedMessage: "Too many invalid verification attempts. Please request a fresh verification link.",
    });
    if (failureLockError) return failureLockError;

    const result = await verifyEmailWithToken(payload);
    clearFailedVerificationAttempts(emailTokenFailureScope, failureIdentity);

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
      if (error.code === "EMAIL_VERIFICATION_TOKEN_INVALID" && failureIdentity) {
        const failureState = recordFailedVerificationAttempt({
          scope: emailTokenFailureScope,
          identity: failureIdentity,
          maxFailures: emailTokenFailureMaxAttempts,
          windowMs: emailTokenFailureWindowMs,
          lockMs: emailTokenFailureLockMs,
        });

        if (failureState.locked) {
          return fail(
            "Too many invalid verification attempts. Please request a fresh verification link.",
            429,
            "EMAIL_VERIFICATION_LOCKED",
          );
        }

        const remainingText = `${failureState.remainingAttempts} attempt${
          failureState.remainingAttempts === 1 ? "" : "s"
        } remaining`;
        return fail(
          `This verification link is invalid or expired. ${remainingText}.`,
          400,
          "EMAIL_VERIFICATION_TOKEN_INVALID",
        );
      }

      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to verify email", 500, "EMAIL_VERIFICATION_FAILED");
  }
}
