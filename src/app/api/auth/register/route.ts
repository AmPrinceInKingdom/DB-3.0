import { attachRequestId, fail, ok } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { registerUser } from "@/lib/auth/auth-service";
import { classifyAuthRuntimeFailure } from "@/lib/auth/runtime-failure";
import { sendObservabilityAlert } from "@/lib/observability/alerting";
import { logApiFailure, resolveRequestId } from "@/lib/observability/request-context";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { registerSchema } from "@/lib/validators/auth";

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
  const requestId = resolveRequestId(request);
  const originError = enforceSameOriginMutation(request);
  if (originError) return attachRequestId(originError, requestId);

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:register",
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitError) return attachRequestId(rateLimitError, requestId);

  try {
    const payload = registerSchema.parse(await request.json());
    const result = await registerUser(payload, {
      appUrl: resolveAppUrlFromRequest(request),
      includeDebugArtifacts: process.env.NODE_ENV !== "production",
    });

    return ok(result, { requestId });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, { status: error.status, requestId }, error.code);
    }

    logApiFailure({ scope: "auth.register", requestId, error });
    void sendObservabilityAlert({
      scope: "api.auth.register",
      severity: "warning",
      title: "Unexpected register route failure",
      message: "Register route threw an unclassified runtime error.",
      requestId,
      metadata: {
        route: "/api/auth/register",
      },
    });

    const classifiedFailure = classifyAuthRuntimeFailure(error, "register");
    if (classifiedFailure) {
      return fail(
        classifiedFailure.message,
        { status: classifiedFailure.status, requestId },
        classifiedFailure.code,
      );
    }

    return fail("Unable to register user", { status: 500, requestId }, "REGISTER_FAILED");
  }
}
