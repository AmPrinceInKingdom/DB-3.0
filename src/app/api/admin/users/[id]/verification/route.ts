import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  createAuditLog,
  getAuditMetaFromRequest,
} from "@/lib/services/audit-log-service";
import { manageAdminUserVerification } from "@/lib/services/admin-user-service";
import { adminUserVerificationActionSchema } from "@/lib/validators/admin-user";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function mapAuditAction(action: string) {
  if (action === "RESEND_EMAIL_LINK") return "ADMIN_USER_VERIFICATION_RESEND_LINK";
  if (action === "RESEND_OTP") return "ADMIN_USER_VERIFICATION_RESEND_OTP";
  return "ADMIN_USER_VERIFICATION_REVOKE_PENDING";
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const { id } = await context.params;
    const payload = adminUserVerificationActionSchema.parse(await request.json());

    const result = await manageAdminUserVerification({
      targetUserId: id,
      actorUserId: auth.session.sub,
      actorRole: auth.session.role,
      action: payload.action,
      appUrl: resolveAppUrlFromRequest(request),
      includeDebugArtifacts: process.env.NODE_ENV !== "production",
    });

    const meta = getAuditMetaFromRequest(request);
    try {
      await createAuditLog({
        actorUserId: auth.session.sub,
        action: mapAuditAction(payload.action),
        targetTable: "users",
        targetId: id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        newValues: {
          targetEmail: result.targetEmail,
          message: result.message,
          revokedTokens: result.revokedTokens ?? 0,
          revokedOtps: result.revokedOtps ?? 0,
        },
      });
    } catch {
      // Keep primary verification action successful even if audit logging fails.
    }

    return ok(result);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail(
      "Unable to perform verification action",
      400,
      "ADMIN_USER_VERIFICATION_ACTION_FAILED",
    );
  }
}
