import { createHash } from "node:crypto";
import { fail, ok } from "@/lib/api-response";
import { resetPasswordWithToken } from "@/lib/auth/auth-service";
import { AppError } from "@/lib/errors";
import {
  clearFailedVerificationAttempts,
  enforceFailureLock,
  enforceRateLimit,
  enforceSameOriginMutation,
  getRequestIp,
  recordFailedVerificationAttempt,
} from "@/lib/security/request-security";
import { resetPasswordSchema } from "@/lib/validators/auth";

const resetFailureScope = "auth:reset-password-failure";
const resetFailureWindowMs = 15 * 60 * 1000;
const resetFailureLockMs = 15 * 60 * 1000;
const resetFailureMaxAttempts = 6;

function buildResetFailureIdentity(token: string, ip: string) {
  const tokenFingerprint = createHash("sha256").update(token).digest("hex").slice(0, 24);
  return `${tokenFingerprint}:${ip}`;
}

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:reset-password",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  let failureIdentity = "";

  try {
    const parsedPayload = resetPasswordSchema.safeParse(await request.json());
    if (!parsedPayload.success) {
      return fail("Invalid reset request payload.", 400, "INVALID_INPUT");
    }

    const payload = parsedPayload.data;
    failureIdentity = buildResetFailureIdentity(payload.token, getRequestIp(request));
    const failureLockError = enforceFailureLock({
      scope: resetFailureScope,
      identity: failureIdentity,
      maxFailures: resetFailureMaxAttempts,
      windowMs: resetFailureWindowMs,
      lockMs: resetFailureLockMs,
      lockedCode: "RESET_LOCKED",
      lockedMessage: "Too many invalid reset attempts. Please request a fresh reset link.",
    });
    if (failureLockError) return failureLockError;

    const result = await resetPasswordWithToken(payload);
    clearFailedVerificationAttempts(resetFailureScope, failureIdentity);
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "RESET_TOKEN_INVALID" && failureIdentity) {
        const failureState = recordFailedVerificationAttempt({
          scope: resetFailureScope,
          identity: failureIdentity,
          maxFailures: resetFailureMaxAttempts,
          windowMs: resetFailureWindowMs,
          lockMs: resetFailureLockMs,
        });

        if (failureState.locked) {
          return fail(
            "Too many invalid reset attempts. Please request a fresh reset link.",
            429,
            "RESET_LOCKED",
          );
        }

        const remainingText = `${failureState.remainingAttempts} attempt${
          failureState.remainingAttempts === 1 ? "" : "s"
        } remaining`;
        return fail(
          `This password reset link is invalid or expired. ${remainingText}.`,
          400,
          "RESET_TOKEN_INVALID",
        );
      }

      return fail(error.message, error.status, error.code);
    }

    return fail("Unable to reset password", 500, "RESET_PASSWORD_FAILED");
  }
}
