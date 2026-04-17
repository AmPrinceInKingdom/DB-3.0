import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/services/payment-webhook-service", () => ({
  listAdminPaymentWebhookEvents: vi.fn(),
}));

import { GET } from "@/app/api/admin/payments/webhooks/route";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminPaymentWebhookEvents } from "@/lib/services/payment-webhook-service";

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedListAdminPaymentWebhookEvents = vi.mocked(listAdminPaymentWebhookEvents);

describe("GET /api/admin/payments/webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns guard response when unauthorized", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: false,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await GET(new Request("http://localhost/api/admin/payments/webhooks"));
    expect(response.status).toBe(403);
    expect(mockedListAdminPaymentWebhookEvents).not.toHaveBeenCalled();
  });

  it("parses query filters and forwards them to webhook service", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedListAdminPaymentWebhookEvents.mockResolvedValue([] as never);

    await GET(
      new Request(
        "http://localhost/api/admin/payments/webhooks?search=evt_123&reference=ref_abc&eventType=checkout.session.completed&dateFrom=2026-04-01&dateTo=2026-04-17&handled=false&success=true&limit=120",
      ),
    );

    expect(mockedListAdminPaymentWebhookEvents).toHaveBeenCalledWith({
      search: "evt_123",
      reference: "ref_abc",
      eventType: "checkout.session.completed",
      dateFrom: new Date("2026-04-01T00:00:00.000Z"),
      dateTo: new Date("2026-04-17T23:59:59.999Z"),
      handled: false,
      success: true,
      limit: 120,
    });
  });

  it("ignores invalid boolean and limit query values", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedListAdminPaymentWebhookEvents.mockResolvedValue([] as never);

    await GET(
      new Request(
        "http://localhost/api/admin/payments/webhooks?handled=maybe&success=maybe&limit=abc",
      ),
    );

    expect(mockedListAdminPaymentWebhookEvents).toHaveBeenCalledWith({
      search: undefined,
      reference: undefined,
      eventType: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      handled: undefined,
      success: undefined,
      limit: undefined,
    });
  });

  it("returns stable error payload when service throws", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedListAdminPaymentWebhookEvents.mockRejectedValue(new Error("db unavailable"));

    const response = await GET(new Request("http://localhost/api/admin/payments/webhooks"));
    const payload = (await response.json()) as { success: boolean; error?: string; code?: string };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Unable to fetch payment webhook events");
    expect(payload.code).toBe("PAYMENT_WEBHOOK_EVENTS_FETCH_FAILED");
  });
});

