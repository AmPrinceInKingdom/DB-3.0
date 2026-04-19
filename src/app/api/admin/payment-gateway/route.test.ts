import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/services/admin-payment-gateway-service", () => ({
  getAdminPaymentGatewayPanel: vi.fn(),
  updateAdminPaymentGatewayPanel: vi.fn(),
}));

vi.mock("@/lib/services/audit-log-service", () => ({
  createAuditLog: vi.fn(),
  getAuditMetaFromRequest: vi.fn(() => ({
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  })),
}));

import { GET, PATCH } from "@/app/api/admin/payment-gateway/route";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import {
  getAdminPaymentGatewayPanel,
  updateAdminPaymentGatewayPanel,
} from "@/lib/services/admin-payment-gateway-service";

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedGetAdminPaymentGatewayPanel = vi.mocked(getAdminPaymentGatewayPanel);
const mockedUpdateAdminPaymentGatewayPanel = vi.mocked(updateAdminPaymentGatewayPanel);

function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/payment-gateway", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Admin payment gateway route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns guard response when unauthorized", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: false,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await GET();
    expect(response.status).toBe(403);
    expect(mockedGetAdminPaymentGatewayPanel).not.toHaveBeenCalled();
  });

  it("updates gateway settings successfully", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    mockedGetAdminPaymentGatewayPanel.mockResolvedValue({
      settings: {
        cardPaymentProvider: "SANDBOX",
        cardPaymentEnabled: true,
        bankTransferEnabled: true,
        cashOnDeliveryEnabled: false,
        bankTransferAccountName: "Deal Bazaar Pvt Ltd",
        bankTransferBankName: "BOC",
        bankTransferAccountNumber: "123456",
        bankTransferBranch: "Colombo",
        bankTransferSwift: "BCEYLKLX",
        bankTransferNote: "Use order number",
      },
      health: {
        stripeSecretKeyConfigured: true,
        stripeWebhookSecretConfigured: true,
        stripeSecretKeyMode: "LIVE",
        appUrlConfigured: true,
        appUrlHttps: true,
        appUrlLocalhost: false,
        stripeReady: true,
        missingStripeRequirements: [],
        sandboxReady: true,
        selectedProviderReady: true,
        strictProduction: false,
        stripeProductionReady: true,
        stripeProductionWarnings: [],
        bankTransferDetailsReady: true,
        missingBankTransferFields: [],
        appUrl: "https://dealbazaar.lk",
        stripeWebhookPath: "/api/payments/card/stripe/webhook",
        stripeWebhookUrl: "https://dealbazaar.lk/api/payments/card/stripe/webhook",
        stripeConnection: {
          checkedAt: "2026-04-18T00:00:00.000Z",
          reachable: true,
          livemode: true,
          accountId: "acct_live",
          country: "LK",
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
          errorMessage: null,
        },
      },
    } as never);

    mockedUpdateAdminPaymentGatewayPanel.mockResolvedValue({
      settings: {
        cardPaymentProvider: "STRIPE_CHECKOUT",
        cardPaymentEnabled: true,
        bankTransferEnabled: true,
        cashOnDeliveryEnabled: false,
        bankTransferAccountName: "Deal Bazaar Pvt Ltd",
        bankTransferBankName: "BOC",
        bankTransferAccountNumber: "123456",
        bankTransferBranch: "Colombo",
        bankTransferSwift: "BCEYLKLX",
        bankTransferNote: "Use order number",
      },
      health: {
        stripeSecretKeyConfigured: true,
        stripeWebhookSecretConfigured: true,
        stripeSecretKeyMode: "LIVE",
        appUrlConfigured: true,
        appUrlHttps: true,
        appUrlLocalhost: false,
        stripeReady: true,
        missingStripeRequirements: [],
        sandboxReady: true,
        selectedProviderReady: true,
        strictProduction: false,
        stripeProductionReady: true,
        stripeProductionWarnings: [],
        bankTransferDetailsReady: true,
        missingBankTransferFields: [],
        appUrl: "https://dealbazaar.lk",
        stripeWebhookPath: "/api/payments/card/stripe/webhook",
        stripeWebhookUrl: "https://dealbazaar.lk/api/payments/card/stripe/webhook",
        stripeConnection: {
          checkedAt: "2026-04-18T00:00:00.000Z",
          reachable: true,
          livemode: true,
          accountId: "acct_live",
          country: "LK",
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
          errorMessage: null,
        },
      },
    } as never);

    const response = await PATCH(
      makePatchRequest({
        cardPaymentProvider: "STRIPE_CHECKOUT",
        cardPaymentEnabled: true,
        bankTransferEnabled: true,
        cashOnDeliveryEnabled: false,
        bankTransferAccountName: "Deal Bazaar Pvt Ltd",
        bankTransferBankName: "BOC",
        bankTransferAccountNumber: "123456",
        bankTransferBranch: "Colombo",
        bankTransferSwift: "BCEYLKLX",
        bankTransferNote: "Use order number",
      }),
    );
    const payload = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockedUpdateAdminPaymentGatewayPanel).toHaveBeenCalledWith(
      expect.objectContaining({ cardPaymentProvider: "STRIPE_CHECKOUT" }),
      "admin-1",
    );
  });

  it("returns app error when service rejects invalid config", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedGetAdminPaymentGatewayPanel.mockResolvedValue({
      settings: {
        cardPaymentProvider: "SANDBOX",
        cardPaymentEnabled: true,
        bankTransferEnabled: true,
        cashOnDeliveryEnabled: false,
        bankTransferAccountName: "",
        bankTransferBankName: "",
        bankTransferAccountNumber: "",
        bankTransferBranch: "",
        bankTransferSwift: "",
        bankTransferNote: "",
      },
      health: {
        stripeSecretKeyConfigured: false,
        stripeWebhookSecretConfigured: false,
        stripeSecretKeyMode: "MISSING",
        appUrlConfigured: false,
        appUrlHttps: false,
        appUrlLocalhost: false,
        stripeReady: false,
        missingStripeRequirements: ["STRIPE_SECRET_KEY"],
        sandboxReady: true,
        selectedProviderReady: false,
        strictProduction: false,
        stripeProductionReady: false,
        stripeProductionWarnings: ["STRIPE_SECRET_KEY is missing."],
        bankTransferDetailsReady: false,
        missingBankTransferFields: ["Bank transfer account name"],
        appUrl: null,
        stripeWebhookPath: "/api/payments/card/stripe/webhook",
        stripeWebhookUrl: null,
        stripeConnection: {
          checkedAt: "2026-04-18T00:00:00.000Z",
          reachable: false,
          livemode: null,
          accountId: null,
          country: null,
          chargesEnabled: null,
          payoutsEnabled: null,
          detailsSubmitted: null,
          errorMessage: "STRIPE_SECRET_KEY is missing.",
        },
      },
    } as never);
    mockedUpdateAdminPaymentGatewayPanel.mockRejectedValue(
      new AppError(
        "Stripe Checkout is not ready. Missing: STRIPE_SECRET_KEY.",
        400,
        "STRIPE_CONFIGURATION_INCOMPLETE",
      ),
    );

    const response = await PATCH(
      makePatchRequest({
        cardPaymentProvider: "STRIPE_CHECKOUT",
        cardPaymentEnabled: true,
        bankTransferEnabled: true,
        cashOnDeliveryEnabled: false,
        bankTransferAccountName: "Deal Bazaar",
        bankTransferBankName: "BOC",
        bankTransferAccountNumber: "123",
        bankTransferBranch: "Colombo",
        bankTransferSwift: "BCEYLKLX",
        bankTransferNote: "",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("STRIPE_CONFIGURATION_INCOMPLETE");
  });
});
