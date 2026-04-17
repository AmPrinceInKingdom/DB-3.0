import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminAuditLogsPage } from "@/lib/services/audit-log-service";

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
    const pageRaw = Number(url.searchParams.get("page"));
    const page = Number.isFinite(pageRaw) ? pageRaw : 1;
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? limitRaw : 40;

    const logs = await listAdminAuditLogsPage({
      actionPrefixes: ["PAYMENT_"],
      targetTables: ["payment_proofs", "payment_webhook_events"],
      actionTypes,
      search,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    return ok(logs);
  } catch {
    return fail("Unable to fetch payment audit logs", 500, "ADMIN_PAYMENT_AUDIT_FETCH_FAILED");
  }
}
