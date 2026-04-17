import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/services/admin-analytics-service", () => ({
  getAdminAnalyticsDashboard: vi.fn(),
}));

import { GET } from "@/app/api/admin/analytics/route";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getAdminAnalyticsDashboard } from "@/lib/services/admin-analytics-service";

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedGetAdminAnalyticsDashboard = vi.mocked(getAdminAnalyticsDashboard);

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admin guard response when user is not allowed", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: false,
      response: fail("Admin access required", 403, "FORBIDDEN"),
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await GET(new Request("http://localhost/api/admin/analytics?days=90"));

    expect(response.status).toBe(403);
    expect(mockedGetAdminAnalyticsDashboard).not.toHaveBeenCalled();
  });

  it("loads analytics for valid days query", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedGetAdminAnalyticsDashboard.mockResolvedValue({
      rangeDays: 90,
      summary: {},
    } as never);

    const response = await GET(new Request("http://localhost/api/admin/analytics?days=90"));
    const payload = (await response.json()) as { success: boolean; data?: { rangeDays: number } };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.rangeDays).toBe(90);
    expect(mockedGetAdminAnalyticsDashboard).toHaveBeenCalledWith(90);
  });

  it("falls back to 30 days when query is invalid", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedGetAdminAnalyticsDashboard.mockResolvedValue({
      rangeDays: 30,
      summary: {},
    } as never);

    await GET(new Request("http://localhost/api/admin/analytics?days=not-a-number"));

    expect(mockedGetAdminAnalyticsDashboard).toHaveBeenCalledWith(30);
  });

  it("returns stable error payload when analytics service fails", async () => {
    mockedRequireAdminSession.mockResolvedValue({
      allowed: true,
      session: { sub: "admin-1", role: "ADMIN" },
    } as Awaited<ReturnType<typeof requireAdminSession>>);
    mockedGetAdminAnalyticsDashboard.mockRejectedValue(new Error("DB unavailable"));

    const response = await GET(new Request("http://localhost/api/admin/analytics?days=30"));
    const payload = (await response.json()) as { success: boolean; error?: string; code?: string };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Unable to fetch analytics");
    expect(payload.code).toBe("ADMIN_ANALYTICS_FETCH_FAILED");
  });
});

