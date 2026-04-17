import { fail, ok } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminPaymentWebhookEvents } from "@/lib/services/payment-webhook-service";

function parseBooleanQuery(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

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
    const reference = url.searchParams.get("reference") ?? undefined;
    const eventType = url.searchParams.get("eventType") ?? undefined;
    const dateFrom = parseDateStart(url.searchParams.get("dateFrom"));
    const dateTo = parseDateEnd(url.searchParams.get("dateTo"));
    const handled = parseBooleanQuery(url.searchParams.get("handled"));
    const success = parseBooleanQuery(url.searchParams.get("success"));
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;

    const events = await listAdminPaymentWebhookEvents({
      search,
      reference,
      eventType,
      dateFrom,
      dateTo,
      handled,
      success,
      limit,
    });

    return ok(events);
  } catch {
    return fail("Unable to fetch payment webhook events", 500, "PAYMENT_WEBHOOK_EVENTS_FETCH_FAILED");
  }
}
