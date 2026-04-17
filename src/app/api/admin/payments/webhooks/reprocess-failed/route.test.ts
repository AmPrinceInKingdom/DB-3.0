import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/services/payment-webhook-service", () => ({
  listAdminPaymentWebhookEvents: vi.fn(),
}));

vi.mock("@/lib/services/card-payment-service", () => ({
  replayStripeWebhookEventById: vi.fn(),
}));

vi.mock("@/lib/services/audit-log-service", () => ({
  createAuditLog: vi.fn(),
  getAuditMetaFromRequest: vi.fn(() => ({
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  })),
}));

import { POST } from "@/app/api/admin/payments/webhooks/reprocess-failed/route";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { listAdminPaymentWebhookEvents } from "@/lib/services/payment-webhook-service";
import { replayStripeWebhookEventById } from "@/lib/services/card-payment-service";

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedListAdminPaymentWebhookEvents = vi.mocked(listAdminPaymentWebhookEvents);
const mockedReplayStripeWebhookEventById = vi.mocked(replayStripeWebhookEventById);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/payments/webhooks/reprocess-failed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/payments/webhooks/reprocess-failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admin guard response when not allowed", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: false,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await POST(makeRequest({}));
    expect(response.status).toBe(403);
    expect(mockedListAdminPaymentWebhookEvents).not.toHaveBeenCalled();
  });

  it("reprocesses only action-required events selected by ids", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    mockedListAdminPaymentWebhookEvents.mockResolvedValue([
      {
        id: "evt-a",
        eventType: "checkout.session.completed",
        reference: "ref-a",
        success: false,
        handled: true,
      },
      {
        id: "evt-b",
        eventType: "checkout.session.expired",
        reference: "ref-b",
        success: true,
        handled: false,
      },
      {
        id: "evt-c",
        eventType: "checkout.session.completed",
        reference: "ref-c",
        success: true,
        handled: true,
      },
    ] as never);

    mockedReplayStripeWebhookEventById.mockResolvedValue({
      webhookEventId: "evt-a",
      handled: true,
      success: true,
      eventType: "checkout.session.completed",
      reference: "ref-a",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    } as never);

    const response = await POST(
      makeRequest({
        eventIds: ["evt-a", "evt-c"],
        limit: 10,
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      data?: { selectedCount: number; succeeded: number; failed: number };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.selectedCount).toBe(1);
    expect(payload.data?.succeeded).toBe(1);
    expect(payload.data?.failed).toBe(0);
    expect(mockedReplayStripeWebhookEventById).toHaveBeenCalledTimes(1);
    expect(mockedReplayStripeWebhookEventById).toHaveBeenCalledWith("evt-a");
  });

  it("respects limit and continues when one replay fails", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    mockedListAdminPaymentWebhookEvents.mockResolvedValue([
      {
        id: "evt-1",
        eventType: "checkout.session.completed",
        reference: "ref-1",
        success: false,
        handled: false,
      },
      {
        id: "evt-2",
        eventType: "checkout.session.expired",
        reference: "ref-2",
        success: false,
        handled: true,
      },
      {
        id: "evt-3",
        eventType: "checkout.session.completed",
        reference: "ref-3",
        success: false,
        handled: true,
      },
    ] as never);

    mockedReplayStripeWebhookEventById
      .mockResolvedValueOnce({
        webhookEventId: "evt-1",
        handled: true,
        success: true,
        eventType: "checkout.session.completed",
        reference: "ref-1",
      } as never)
      .mockRejectedValueOnce(
        new AppError("Unable to resolve payment for this webhook event.", 400, "STRIPE_WEBHOOK_REPLAY_UNRESOLVED"),
      );

    const response = await POST(makeRequest({ limit: 2 }));
    const payload = (await response.json()) as {
      success: boolean;
      data?: { selectedCount: number; succeeded: number; failed: number };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.selectedCount).toBe(2);
    expect(payload.data?.succeeded).toBe(1);
    expect(payload.data?.failed).toBe(1);
    expect(mockedReplayStripeWebhookEventById).toHaveBeenCalledTimes(2);
  });
});

