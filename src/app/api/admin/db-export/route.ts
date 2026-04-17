import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  createAdminDbExportFile,
  getAdminDbExportPanel,
  parseAdminDbExportFormat,
  parseAdminDbExportScope,
} from "@/lib/services/admin-db-export-service";
import { createAuditLog, getAuditMetaFromRequest } from "@/lib/services/audit-log-service";

function parseDownloadFlag(value: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const download = parseDownloadFlag(url.searchParams.get("download"));

    const requestedScope = url.searchParams.get("scope");
    const requestedFormat = url.searchParams.get("format");

    const parsedScope = parseAdminDbExportScope(requestedScope);
    if (requestedScope && !parsedScope) {
      return fail("Invalid export scope", 400, "ADMIN_DB_EXPORT_SCOPE_INVALID");
    }

    const parsedFormat = parseAdminDbExportFormat(requestedFormat);
    if (requestedFormat && !parsedFormat) {
      return fail("Invalid export format", 400, "ADMIN_DB_EXPORT_FORMAT_INVALID");
    }

    if (!download) {
      const panel = await getAdminDbExportPanel();
      return ok(panel);
    }

    const scope = parsedScope ?? "all";
    const format = parsedFormat ?? "json";
    const file = await createAdminDbExportFile({ scope, format });

    try {
      const auditMeta = getAuditMetaFromRequest(request);
      await createAuditLog({
        actorUserId: auth.session.sub,
        action: "DB_EXPORT_GENERATED",
        targetTable: "database",
        ipAddress: auditMeta.ipAddress,
        userAgent: auditMeta.userAgent,
        newValues: {
          scope,
          format,
          filename: file.filename,
          tableCounts: file.tableCounts,
        },
      });
    } catch {
      // Keep export successful even if audit logging fails.
    }

    return new Response(file.body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return fail("Unable to export database snapshot", 500, "ADMIN_DB_EXPORT_FAILED");
  }
}

