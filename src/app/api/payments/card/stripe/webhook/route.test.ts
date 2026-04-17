import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/services/card-payment-service", () => ({
  processStripeWebhook: vi.fn(),
}));

vi.mock("@/lib/services/payment-webhook-service", () => ({
  createPaymentWebhookEventLog: vi.fn(),
}));

import { POST } from "@/app/api/payments/card/stripe/webhook/route";
import { processStripeWebhook } from "@/lib/services/card-payment-service";
import { createPaymentWebhookEventLog } from "@/lib/services/payment-webhook-service";

const mockedProcessStripeWebhook = vi.mocked(processStripeWebhook);
const mockedCreatePaymentWebhookEventLog = vi.mocked(createPaymentWebhookEventLog);

function makeStripeRequest(body: string, signature = "t=1,v1=signature") {
  return new Request("http://localhost/api/payments/card/stripe/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
}

describe("POST /api/payments/card/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes webhook and logs successful handling", async () => {
    const rawBody = JSON.stringify({
      id: "evt_123",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: {
            db_reference: "ref_123",
          },
        },
      },
    });

    mockedProcessStripeWebhook.mockResolvedValue({
      handled: true,
      eventId: "evt_123",
      eventType: "checkout.session.completed",
      reference: "ref_123",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    } as never);

    const response = await POST(makeStripeRequest(rawBody));
    const payload = (await response.json()) as {
      success: boolean;
      data?: { handled?: boolean; reference?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.handled).toBe(true);
    expect(payload.data?.reference).toBe("ref_123");
    expect(mockedProcessStripeWebhook).toHaveBeenCalledWith(rawBody, "t=1,v1=signature");
    expect(mockedCreatePaymentWebhookEventLog).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "STRIPE",
        eventId: "evt_123",
        eventType: "checkout.session.completed",
        reference: "ref_123",
        handled: true,
        success: true,
      }),
    );
  });

  it("returns app error and still logs failed webhook context", async () => {
    const rawBody = JSON.stringify({
      id: "evt_fail_1",
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_test_fail",
          metadata: {
            db_reference: "ref_fail_1",
          },
        },
      },
    });

    mockedProcessStripeWebhook.mockRejectedValue(
      new AppError("Invalid Stripe signature", 400, "STRIPE_SIGNATURE_INVALID"),
    );

    const response = await POST(makeStripeRequest(rawBody));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Invalid Stripe signature");
    expect(payload.code).toBe("STRIPE_SIGNATURE_INVALID");
    expect(mockedCreatePaymentWebhookEventLog).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "STRIPE",
        eventId: "evt_fail_1",
        eventType: "checkout.session.expired",
        reference: "ref_fail_1",
        handled: false,
        success: false,
        errorCode: "STRIPE_SIGNATURE_INVALID",
      }),
    );
  });

  it("does not fail webhook response when webhook logging throws", async () => {
    const rawBody = JSON.stringify({
      id: "evt_no_log",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_no_log",
          metadata: {
            db_reference: "ref_no_log",
          },
        },
      },
    });

    mockedProcessStripeWebhook.mockResolvedValue({
      handled: false,
      eventId: "evt_no_log",
      eventType: "checkout.session.completed",
      reference: "ref_no_log",
    } as never);
    mockedCreatePaymentWebhookEventLog.mockRejectedValue(new Error("db log down"));

    const response = await POST(makeStripeRequest(rawBody));
    const payload = (await response.json()) as {
      success: boolean;
      data?: { handled?: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.handled).toBe(false);
    expect(mockedCreatePaymentWebhookEventLog).toHaveBeenCalledTimes(1);
  });
});

