import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { verifyEmailWithOtp } from "@/lib/auth/auth-service";
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
import { otpVerificationSchema } from "@/lib/validators/auth";

const otpFailureScope = "auth:otp-verify-failure";
const otpFailureWindowMs = 10 * 60 * 1000;
const otpFailureLockMs = 10 * 60 * 1000;
const otpFailureMaxAttempts = 5;

export async function POST(request: Request) {
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:otp-verify",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  let parsedEmail = "";

  try {
    const payload = otpVerificationSchema.parse(await request.json());
    parsedEmail = payload.email;
    const failureIdentity = `${payload.email}:${getRequestIp(request)}`;
    const failureLockError = enforceFailureLock({
      scope: otpFailureScope,
      identity: failureIdentity,
      maxFailures: otpFailureMaxAttempts,
      windowMs: otpFailureWindowMs,
      lockMs: otpFailureLockMs,
    });
    if (failureLockError) return failureLockError;

    const result = await verifyEmailWithOtp(payload);
    clearFailedVerificationAttempts(otpFailureScope, failureIdentity);

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
      if (error.code === "OTP_INVALID") {
        const failureIdentity = `${parsedEmail || "unknown-email"}:${getRequestIp(request)}`;
        const failureState = recordFailedVerificationAttempt({
          scope: otpFailureScope,
          identity: failureIdentity,
          maxFailures: otpFailureMaxAttempts,
          windowMs: otpFailureWindowMs,
          lockMs: otpFailureLockMs,
        });

        if (failureState.locked) {
          return fail(
            `Too many invalid OTP attempts. Try again in ${failureState.retryAfterSeconds ?? 60} seconds.`,
            429,
            "OTP_LOCKED",
          );
        }

        const remainingText = `${failureState.remainingAttempts} attempt${
          failureState.remainingAttempts === 1 ? "" : "s"
        } remaining`;
        return fail(`Invalid or expired OTP code. ${remainingText}.`, 400, "OTP_INVALID");
      }

      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to verify OTP", 500, "OTP_VERIFY_FAILED");
  }
}
