import { fail } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminPaymentWebhookEvents } from "@/lib/services/payment-webhook-service";

const sriLankaDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

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

function formatStatusLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.replaceAll("_", " ");
}

function formatDecimalValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toString" in value) return String(value);
  return "";
}

function formatSriLankaDateTime(date: Date) {
  return sriLankaDateFormatter.format(date).replace(",", "");
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
    const reference = url.searchParams.get("reference") ?? undefined;
    const eventType = url.searchParams.get("eventType") ?? undefined;
    const dateFrom = parseDateStart(url.searchParams.get("dateFrom"));
    const dateTo = parseDateEnd(url.searchParams.get("dateTo"));
    const handled = parseBooleanQuery(url.searchParams.get("handled"));
    const success = parseBooleanQuery(url.searchParams.get("success"));
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? limitRaw : 2000;

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

    const headers = [
      "event_received_utc",
      "event_received_sri_lanka",
      "provider",
      "event_type",
      "event_id",
      "reference",
      "result",
      "handling_status",
      "payment_status",
      "order_status",
      "order_id",
      "order_number",
      "order_customer_email",
      "order_currency",
      "order_total",
      "payment_id",
      "payment_method",
      "payment_record_status",
      "payment_currency",
      "payment_amount",
      "payment_reference",
      "error_code",
      "error_message",
      "payload_json",
    ];

    const lines = events.map((event) =>
      [
        event.createdAt.toISOString(),
        formatSriLankaDateTime(event.createdAt),
        event.provider,
        event.eventType,
        event.eventId,
        event.reference,
        event.success ? "SUCCESS" : "FAILED",
        event.handled ? "HANDLED" : "UNHANDLED",
        formatStatusLabel(event.paymentStatus),
        formatStatusLabel(event.orderStatus),
        event.order?.id ?? null,
        event.order?.orderNumber ?? null,
        event.order?.customerEmail ?? null,
        event.order?.currencyCode ?? null,
        formatDecimalValue(event.order?.grandTotal),
        event.payment?.id ?? null,
        formatStatusLabel(event.payment?.paymentMethod) || null,
        formatStatusLabel(event.payment?.paymentStatus),
        event.payment?.currencyCode ?? null,
        formatDecimalValue(event.payment?.amount),
        event.payment?.transactionReference ?? event.reference ?? null,
        event.errorCode,
        event.errorMessage,
        JSON.stringify(event.payload ?? {}),
      ]
        .map((item) => csvEscape(item))
        .join(","),
    );

    const csvContent = `\uFEFF${headers.join(",")}\n${lines.join("\n")}`;
    const filename = `payment-webhook-events-${fileTimestamp(new Date())}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return fail("Unable to export payment webhook events", 500, "PAYMENT_WEBHOOK_EVENTS_EXPORT_FAILED");
  }
}
