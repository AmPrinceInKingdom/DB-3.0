import { AppError } from "@/lib/errors";
import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  getAdminPaymentGatewayPanel,
  updateAdminPaymentGatewayPanel,
} from "@/lib/services/admin-payment-gateway-service";
import { createAuditLog, getAuditMetaFromRequest } from "@/lib/services/audit-log-service";
import { adminPaymentGatewayUpdateSchema } from "@/lib/validators/admin-payment-gateway";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = await getAdminPaymentGatewayPanel();
    return ok(payload);
  } catch {
    return fail("Unable to fetch payment gateway settings", 500, "ADMIN_PAYMENT_GATEWAY_FETCH_FAILED");
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const payload = adminPaymentGatewayUpdateSchema.parse(await request.json());
    const previous = await getAdminPaymentGatewayPanel();
    const updated = await updateAdminPaymentGatewayPanel(payload, auth.session.sub);

    try {
      const auditMeta = getAuditMetaFromRequest(request);
      await createAuditLog({
        actorUserId: auth.session.sub,
        action: "PAYMENT_GATEWAY_SETTINGS_UPDATED",
        targetTable: "site_settings",
        ipAddress: auditMeta.ipAddress,
        userAgent: auditMeta.userAgent,
        oldValues: previous.settings,
        newValues: updated.settings,
      });
    } catch {
      // Keep update successful even if audit logging fails.
    }

    return ok(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.message, error.status, error.code);
    }
    return fail("Unable to update payment gateway settings", 400, "ADMIN_PAYMENT_GATEWAY_UPDATE_FAILED");
  }
}

