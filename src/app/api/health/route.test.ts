import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db";

const mockedDb = vi.mocked(db);
const originalEnv = { ...process.env };

function setCoreEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env.DATABASE_URL = "postgresql://runtime-db";
  process.env.DIRECT_URL = "postgresql://direct-db";
  process.env.JWT_SECRET = "abcdefghijklmnopqrstuvwxyz123456";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_USER = "dealbazaar.pvt@gmail.com";
  process.env.SMTP_PASS = "app-password";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("GET /api/health", () => {
  const healthRequest = () => new Request("http://localhost/api/health");

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    setCoreEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns ok when core dependencies are healthy", async () => {
    mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);

    const response = await GET(healthRequest());
    const payload = (await response.json()) as {
      status: string;
      success: boolean;
      timestamp: string;
      environment: string;
      responseTimeMs: number;
      checks?: unknown;
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.status).toBe("ok");
    expect(typeof payload.timestamp).toBe("string");
    expect(typeof payload.environment).toBe("string");
    expect(typeof payload.responseTimeMs).toBe("number");
    expect(payload.checks).toBeUndefined();
  });

  it("returns degraded when optional integrations are missing", async () => {
    mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    setCoreEnv({
      SMTP_PASS: undefined,
      SMTP_USER: undefined,
    });

    const response = await GET(healthRequest());
    const payload = (await response.json()) as {
      status: string;
      success: boolean;
      checks?: unknown;
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.status).toBe("degraded");
    expect(payload.checks).toBeUndefined();
  });

  it("returns down when database ping fails", async () => {
    mockedDb.$queryRaw.mockRejectedValue(new Error("db offline"));

    const response = await GET(healthRequest());
    const payload = (await response.json()) as {
      status: string;
      success: boolean;
    };

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.status).toBe("down");
  });

  it("treats DIRECT_URL as valid database configuration when DATABASE_URL is missing", async () => {
    mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    setCoreEnv({
      DATABASE_URL: undefined,
      DIRECT_URL: "postgresql://direct-db-only",
    });

    const response = await GET(healthRequest());
    const payload = (await response.json()) as {
      status: string;
      success: boolean;
      checks?: unknown;
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.status).toBe("ok");
    expect(payload.checks).toBeUndefined();
  });

  it("includes x-request-id in response headers and payload", async () => {
    mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);

    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: {
          "x-request-id": "health-test-123456",
        },
      }),
    );
    const payload = (await response.json()) as {
      requestId?: string;
    };

    expect(response.headers.get("x-request-id")).toBe("health-test-123456");
    expect(payload.requestId).toBe("health-test-123456");
  });
});
