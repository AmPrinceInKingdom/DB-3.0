import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
}));

vi.mock("@/lib/services/checkout-service", () => ({
  createOrder: vi.fn(),
}));

import { POST } from "@/app/api/orders/route";
import { getCurrentSession } from "@/lib/auth/session";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { createOrder } from "@/lib/services/checkout-service";

const mockedGetCurrentSession = vi.mocked(getCurrentSession);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);
const mockedCreateOrder = vi.mocked(createOrder);

const validBody = {
  customerEmail: "customer@example.com",
  customerPhone: "+94710000000",
  notes: "Please call before delivery",
  couponCode: "",
  billingAddressId: null,
  shippingAddressId: null,
  shippingMethodCode: "STANDARD",
  paymentMethod: "CARD",
  currencyCode: "LKR",
  items: [
    {
      lineId: "line-1",
      productId: "mock-product-1",
      slug: "mock-product-1",
      name: "Mock Product",
      brand: "Deal Bazaar",
      imageUrl: "/uploads/mock.jpg",
      quantity: 1,
      unitPriceBase: 3990,
      variantId: null,
      variantLabel: null,
    },
  ],
  billingAddress: {
    firstName: "Deal",
    lastName: "Bazaar",
    company: "",
    phone: "+94710000000",
    line1: "123 Main Street",
    line2: "",
    city: "Colombo",
    state: "",
    postalCode: "10100",
    countryCode: "LK",
  },
  shippingAddress: {
    firstName: "Deal",
    lastName: "Bazaar",
    company: "",
    phone: "+94710000000",
    line1: "123 Main Street",
    line2: "",
    city: "Colombo",
    state: "",
    postalCode: "10100",
    countryCode: "LK",
  },
};

function makeRequest(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnforceSameOriginMutation.mockReturnValue(null);
    mockedEnforceRateLimit.mockReturnValue(null);
    mockedGetCurrentSession.mockResolvedValue(null as never);
  });

  it("blocks request when same-origin check fails", async () => {
    mockedEnforceSameOriginMutation.mockReturnValue(
      fail("Origin not allowed", 403, "ORIGIN_FORBIDDEN"),
    );

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(403);
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("blocks request when rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(
      fail("Too many requests", 429, "RATE_LIMITED"),
    );

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(429);
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("returns invalid payload error when checkout body is malformed", async () => {
    const response = await POST(
      makeRequest({
        ...validBody,
        items: [],
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ORDER_PAYLOAD_INVALID");
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("rejects invalid idempotency key header", async () => {
    const response = await POST(
      makeRequest(validBody, {
        "idempotency-key": "bad key with spaces",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("IDEMPOTENCY_KEY_INVALID");
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("passes normalized idempotency key to createOrder", async () => {
    mockedCreateOrder.mockResolvedValue({
      id: "order-1",
      cardPayment: null,
    } as never);

    const response = await POST(
      makeRequest(validBody, {
        "idempotency-key": "checkout_2026-04-18:abc12345",
      }),
    );

    expect(response.status).toBe(201);
    expect(mockedCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: "customer@example.com",
      }),
      null,
      { clientRequestId: "checkout_2026-04-18:abc12345" },
    );
  });

  it("accepts x-idempotency-key header as fallback", async () => {
    mockedCreateOrder.mockResolvedValue({
      id: "order-3",
      cardPayment: null,
    } as never);

    const response = await POST(
      makeRequest(validBody, {
        "x-idempotency-key": "checkout_2026-04-18:xyz98765",
      }),
    );

    expect(response.status).toBe(201);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.any(Object),
      null,
      { clientRequestId: "checkout_2026-04-18:xyz98765" },
    );
  });

  it("creates order without idempotency key when header is missing", async () => {
    mockedCreateOrder.mockResolvedValue({
      id: "order-2",
      cardPayment: null,
    } as never);

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.any(Object),
      null,
      { clientRequestId: null },
    );
  });

  it("returns AppError details from createOrder", async () => {
    mockedCreateOrder.mockRejectedValue(
      new AppError(
        "Checkout request key is already used by another session.",
        409,
        "CHECKOUT_REQUEST_KEY_CONFLICT",
      ),
    );

    const response = await POST(
      makeRequest(validBody, {
        "idempotency-key": "checkout-replay-12345678",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("CHECKOUT_REQUEST_KEY_CONFLICT");
  });
});
