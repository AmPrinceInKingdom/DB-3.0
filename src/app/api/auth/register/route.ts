import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { registerUser } from "@/lib/auth/auth-service";
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
  const originError = enforceSameOriginMutation(request);
  if (originError) return originError;

  const rateLimitError = enforceRateLimit(request, {
    scope: "auth:register",
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const payload = registerSchema.parse(await request.json());
    const result = await registerUser(payload, {
      appUrl: resolveAppUrlFromRequest(request),
      includeDebugArtifacts: process.env.NODE_ENV !== "production",
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }

    return fail("Unable to register user", 500, "REGISTER_FAILED");
  }
}
