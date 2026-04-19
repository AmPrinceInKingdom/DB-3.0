import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/observability/request-context", () => ({
  resolveRequestId: vi.fn(() => "admin-health-request-id"),
}));

vi.mock("@/lib/services/runtime-health-service", () => ({
  getRuntimeHealthReport: vi.fn(),
  toHealthStatusCode: vi.fn((status: "ok" | "degraded" | "down") => (status === "down" ? 503 : 200)),
}));

import { GET } from "@/app/api/admin/health/route";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getRuntimeHealthReport } from "@/lib/services/runtime-health-service";

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedGetRuntimeHealthReport = vi.mocked(getRuntimeHealthReport);

describe("GET /api/admin/health", () => {
  it("returns forbidden response for non-admin requests", async () => {
    mockedRequireAdminSession.mockResolvedValueOnce({
      allowed: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Admin access required", code: "FORBIDDEN" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await GET(new Request("http://localhost/api/admin/health"));
    const payload = (await response.json()) as { code?: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("FORBIDDEN");
  });

  it("returns full health checks for authorized admin", async () => {
    mockedRequireAdminSession.mockResolvedValueOnce({
      allowed: true,
      session: {
        sub: "admin-user-id",
        email: "admin@dealbazaar.lk",
        role: "ADMIN",
      },
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    mockedGetRuntimeHealthReport.mockResolvedValueOnce({
      success: true,
      requestId: "admin-health-request-id",
      status: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
      environment: "production",
      responseTimeMs: 12,
      checks: {
        env: { status: "ok", detail: "Core environment variables are configured." },
        database: { status: "ok", detail: "Database connection is healthy.", configured: true },
        supabase: { status: "ok", detail: "Supabase environment is configured.", configured: true },
        smtp: { status: "degraded", detail: "SMTP variables are incomplete.", configured: false },
      },
    });

    const response = await GET(new Request("http://localhost/api/admin/health"));
    const payload = (await response.json()) as {
      status: string;
      checks: {
        smtp: { status: string };
      };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("admin-health-request-id");
    expect(payload.status).toBe("ok");
    expect(payload.checks.smtp.status).toBe("degraded");
  });
});

