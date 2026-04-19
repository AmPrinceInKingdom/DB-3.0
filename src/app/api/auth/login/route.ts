import { attachRequestId, fail, ok } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { loginUser } from "@/lib/auth/auth-service";
import { classifyAuthRuntimeFailure } from "@/lib/auth/runtime-failure";
import { sendObservabilityAlert } from "@/lib/observability/alerting";
import { setSessionCookie } from "@/lib/auth/session";
import { logApiFailure, resolveRequestId } from "@/lib/observability/request-context";
import {
  clearFailedVerificationAttempts,
  enforceFailureLock,
  enforceRateLimit,
  enforceSameOriginMutation,
  getRequestIp,
  recordFailedVerificationAttempt,
} from "@/lib/security/request-security";
import { loginSchema } from "@/lib/validators/auth";

const loginFailureScope = "auth:login-failure";
const loginFailureWindowMs = 10 * 60 * 1000;
const loginFailureLockMs = 10 * 60 * 1000;
const loginFailureMaxAttempts = 8;

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  const originError = enforceSameOriginMutation(request);
  if (originError) return attachRequestId(originError, requestId);

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:login",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitError) return attachRequestId(rateLimitError, requestId);

  let failureIdentity = "";

  try {
    const payload = loginSchema.parse(await request.json());
    failureIdentity = `${payload.email}:${getRequestIp(request)}`;
    const failureLockError = enforceFailureLock({
      scope: loginFailureScope,
      identity: failureIdentity,
      maxFailures: loginFailureMaxAttempts,
      windowMs: loginFailureWindowMs,
      lockMs: loginFailureLockMs,
      lockedCode: "LOGIN_LOCKED",
      lockedMessage: "Too many invalid sign-in attempts. Please try again in a few minutes.",
    });
    if (failureLockError) return attachRequestId(failureLockError, requestId);

    const result = await loginUser(payload);
    clearFailedVerificationAttempts(loginFailureScope, failureIdentity);

    const response = ok(result.user, { requestId });

    await setSessionCookie(response, result.token);
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "UNAUTHORIZED" && failureIdentity) {
        const failureState = recordFailedVerificationAttempt({
          scope: loginFailureScope,
          identity: failureIdentity,
          maxFailures: loginFailureMaxAttempts,
          windowMs: loginFailureWindowMs,
          lockMs: loginFailureLockMs,
        });

        if (failureState.locked) {
          return fail(
            "Too many invalid sign-in attempts. Please try again in a few minutes.",
            { status: 429, requestId },
            "LOGIN_LOCKED",
          );
        }
      }
      return fail(error.message, { status: error.status, requestId }, error.code);
    }

    logApiFailure({ scope: "auth.login", requestId, error });
    void sendObservabilityAlert({
      scope: "api.auth.login",
      severity: "warning",
      title: "Unexpected login route failure",
      message: "Login route threw an unclassified runtime error.",
      requestId,
      metadata: {
        route: "/api/auth/login",
      },
    });

    const classifiedFailure = classifyAuthRuntimeFailure(error, "login");
    if (classifiedFailure) {
      return fail(
        classifiedFailure.message,
        { status: classifiedFailure.status, requestId },
        classifiedFailure.code,
      );
    }

    return fail("Unable to sign in", { status: 500, requestId }, "LOGIN_FAILED");
  }
}
