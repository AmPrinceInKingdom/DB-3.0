import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/services/seller-service", () => ({
  reviewAdminSellerApplication: vi.fn(),
}));

vi.mock("@/lib/services/audit-log-service", () => ({
  createAuditLog: vi.fn(),
  getAuditMetaFromRequest: vi.fn(() => ({
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  })),
}));

import { PATCH } from "@/app/api/admin/sellers/[sellerUserId]/route";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { reviewAdminSellerApplication } from "@/lib/services/seller-service";

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedReviewAdminSellerApplication = vi.mocked(reviewAdminSellerApplication);

describe("PATCH /api/admin/sellers/[sellerUserId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admin guard response when blocked", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: false,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await PATCH(
      new Request("http://localhost/api/admin/sellers/seller-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: Promise.resolve({ sellerUserId: "seller-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mockedReviewAdminSellerApplication).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid action payload", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await PATCH(
      new Request("http://localhost/api/admin/sellers/seller-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "INVALID" }),
      }),
      { params: Promise.resolve({ sellerUserId: "seller-1" }) },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ADMIN_SELLER_VALIDATION_FAILED");
  });

  it("passes through AppError details", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedReviewAdminSellerApplication.mockRejectedValue(
      new AppError("Seller application not found", 404, "NOT_FOUND"),
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/sellers/seller-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: Promise.resolve({ sellerUserId: "seller-1" }) },
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Seller application not found");
    expect(payload.code).toBe("NOT_FOUND");
  });

  it("returns updated seller data when request succeeds", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedReviewAdminSellerApplication.mockResolvedValue({
      userId: "seller-1",
      storeName: "Demo Store",
      storeSlug: "demo-store",
      status: "ACTIVE",
      supportEmail: "store@example.com",
      supportPhone: null,
      taxId: null,
      description: null,
      commissionRate: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: { id: "admin-1", email: "admin@example.com" },
      user: {
        id: "seller-1",
        email: "seller@example.com",
        role: "SELLER",
        status: "ACTIVE",
        phone: null,
        firstName: "Seller",
        lastName: "User",
      },
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/sellers/seller-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: Promise.resolve({ sellerUserId: "seller-1" }) },
    );
    const payload = (await response.json()) as {
      success: boolean;
      data?: { status?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.status).toBe("ACTIVE");
  });
});
