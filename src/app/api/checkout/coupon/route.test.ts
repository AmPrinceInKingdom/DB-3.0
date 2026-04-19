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
  previewCheckoutCoupon: vi.fn(),
}));

import { POST } from "@/app/api/checkout/coupon/route";
import { getCurrentSession } from "@/lib/auth/session";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";
import { previewCheckoutCoupon } from "@/lib/services/checkout-service";

const mockedGetCurrentSession = vi.mocked(getCurrentSession);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);
const mockedPreviewCheckoutCoupon = vi.mocked(previewCheckoutCoupon);

const validBody = {
  couponCode: "SAVE10",
  shippingMethodCode: "STANDARD",
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
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/checkout/coupon", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout/coupon", () => {
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
    expect(mockedPreviewCheckoutCoupon).not.toHaveBeenCalled();
  });

  it("blocks request when rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(
      fail("Too many requests", 429, "RATE_LIMITED"),
    );

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(429);
    expect(mockedPreviewCheckoutCoupon).not.toHaveBeenCalled();
  });

  it("returns invalid payload error when coupon preview body is malformed", async () => {
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
    expect(payload.code).toBe("COUPON_PREVIEW_PAYLOAD_INVALID");
    expect(mockedPreviewCheckoutCoupon).not.toHaveBeenCalled();
  });

  it("returns coupon preview when payload is valid", async () => {
    mockedPreviewCheckoutCoupon.mockResolvedValue({
      coupon: {
        code: "SAVE10",
        title: "Save 10%",
      },
      totals: {
        subtotal: 3990,
        discountTotal: 399,
        shippingFee: 450,
        taxTotal: 359.1,
        grandTotal: 4400.1,
        taxRatePercentage: 10,
      },
    } as never);

    const response = await POST(makeRequest(validBody));
    const payload = (await response.json()) as {
      success: boolean;
      data?: {
        coupon?: { code?: string };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.coupon?.code).toBe("SAVE10");
    expect(mockedPreviewCheckoutCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        couponCode: "SAVE10",
        shippingMethodCode: "STANDARD",
      }),
      null,
    );
  });

  it("returns AppError details from previewCheckoutCoupon", async () => {
    mockedPreviewCheckoutCoupon.mockRejectedValue(
      new AppError(
        "Selected shipping method is unavailable. Please refresh checkout and try again.",
        400,
        "SHIPPING_METHOD_INVALID",
      ),
    );

    const response = await POST(makeRequest(validBody));
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("SHIPPING_METHOD_INVALID");
    expect(payload.error).toBe(
      "Selected shipping method is unavailable. Please refresh checkout and try again.",
    );
  });

  it("returns stable fallback error for unknown failures", async () => {
    mockedPreviewCheckoutCoupon.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(makeRequest(validBody));
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("COUPON_PREVIEW_FAILED");
    expect(payload.error).toBe("Unable to validate coupon");
  });
});
