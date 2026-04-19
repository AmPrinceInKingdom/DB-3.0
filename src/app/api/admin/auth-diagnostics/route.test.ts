import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/observability/request-context", () => ({
  resolveRequestId: vi.fn(() => "admin-auth-diagnostics-request-id"),
}));

vi.mock("@/lib/services/admin-auth-diagnostics-service", () => ({
  getAdminAuthDiagnosticsReport: vi.fn(),
  toDiagnosticsStatusCode: vi.fn((status: "ok" | "degraded" | "down") =>
    status === "down" ? 503 : 200,
  ),
}));

import { GET } from "@/app/api/admin/auth-diagnostics/route";
import { requireAdminSession } from "@/lib/auth/admin-guard";
import { getAdminAuthDiagnosticsReport } from "@/lib/services/admin-auth-diagnostics-service";

const mockedRequireAdminSession = vi.mocked(requireAdminSession);
const mockedGetAdminAuthDiagnosticsReport = vi.mocked(getAdminAuthDiagnosticsReport);

describe("GET /api/admin/auth-diagnostics", () => {
  it("returns forbidden response for non-admin requests", async () => {
    mockedRequireAdminSession.mockResolvedValueOnce({
      allowed: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Admin access required", code: "FORBIDDEN" }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    const response = await GET(new Request("http://localhost/api/admin/auth-diagnostics"));
    const payload = (await response.json()) as { code?: string };

    expect(response.status).toBe(403);
    expect(payload.code).toBe("FORBIDDEN");
  });

  it("returns diagnostics report for authorized admin", async () => {
    mockedRequireAdminSession.mockResolvedValueOnce({
      allowed: true,
      session: {
        sub: "admin-user-id",
        email: "admin@dealbazaar.lk",
        role: "ADMIN",
      },
    } as Awaited<ReturnType<typeof requireAdminSession>>);

    mockedGetAdminAuthDiagnosticsReport.mockResolvedValueOnce({
      success: true,
      requestId: "admin-auth-diagnostics-request-id",
      status: "degraded",
      generatedAt: "2026-01-01T00:00:00.000Z",
      environment: "production",
      responseTimeMs: 15,
      checks: {
        appUrl: { status: "ok", detail: "App URL configured.", configured: true },
        jwt: { status: "ok", detail: "JWT configured.", configured: true },
        database: { status: "ok", detail: "Database healthy.", configured: true, latencyMs: 18 },
        schema: { status: "ok", detail: "Schema ready.", configured: true },
        authRead: { status: "ok", detail: "Auth read query succeeded.", configured: true },
        supabase: {
          status: "degraded",
          detail: "Supabase config incomplete.",
          configured: false,
          missingKeys: ["SUPABASE_SERVICE_ROLE_KEY"],
        },
        smtp: { status: "degraded", detail: "SMTP incomplete.", configured: false },
      },
      recommendations: [
        "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
      ],
    });

    const response = await GET(new Request("http://localhost/api/admin/auth-diagnostics"));
    const payload = (await response.json()) as {
      status: string;
      checks: {
        supabase: { status: string };
      };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("admin-auth-diagnostics-request-id");
    expect(payload.status).toBe("degraded");
    expect(payload.checks.supabase.status).toBe("degraded");
  });
});
