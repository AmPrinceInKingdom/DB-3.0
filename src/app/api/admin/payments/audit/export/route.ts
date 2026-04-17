import { fail } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminAuditLogs } from "@/lib/services/audit-log-service";

function parseDateStart(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed;
}

function parseDateEnd(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed;
}

function csvEscape(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : String(value);
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function fileTimestamp(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.allowed) return auth.response;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const dateFrom = parseDateStart(url.searchParams.get("dateFrom"));
    const dateTo = parseDateEnd(url.searchParams.get("dateTo"));
    const actionTypes = url.searchParams
      .getAll("actionType")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? limitRaw : 2000;

    const logs = await listAdminAuditLogs({
      actionPrefixes: ["PAYMENT_"],
      targetTables: ["payment_proofs", "payment_webhook_events"],
      actionTypes,
      search,
      dateFrom,
      dateTo,
      limit,
    });

    const headers = [
      "created_at",
      "action",
      "actor_email",
      "target_table",
      "target_id",
      "ip_address",
      "user_agent",
      "old_values_json",
      "new_values_json",
    ];

    const lines = logs.map((log) =>
      [
        log.createdAt.toISOString(),
        log.action,
        log.actor?.email ?? null,
        log.targetTable,
        log.targetId,
        log.ipAddress,
        log.userAgent,
        JSON.stringify(log.oldValues ?? {}),
        JSON.stringify(log.newValues ?? {}),
      ]
        .map((item) => csvEscape(item))
        .join(","),
    );

    const csvContent = `\uFEFF${headers.join(",")}\n${lines.join("\n")}`;
    const filename = `payment-audit-logs-${fileTimestamp(new Date())}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return fail("Unable to export payment audit logs", 500, "ADMIN_PAYMENT_AUDIT_EXPORT_FAILED");
  }
}
