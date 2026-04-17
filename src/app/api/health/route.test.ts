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

    const response = await GET();
    const payload = (await response.json()) as {
      status: string;
      success: boolean;
      checks: {
        env: { status: string };
        database: { status: string };
        supabase: { status: string };
        smtp: { status: string };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.status).toBe("ok");
    expect(payload.checks.env.status).toBe("ok");
    expect(payload.checks.database.status).toBe("ok");
    expect(payload.checks.supabase.status).toBe("ok");
    expect(payload.checks.smtp.status).toBe("ok");
  });

  it("returns degraded when optional integrations are missing", async () => {
    mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);
    setCoreEnv({
      SMTP_PASS: undefined,
      SMTP_USER: undefined,
    });

    const response = await GET();
    const payload = (await response.json()) as {
      status: string;
      success: boolean;
      checks: {
        smtp: { status: string; configured: boolean; missingKeys: string[] };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.status).toBe("degraded");
    expect(payload.checks.smtp.status).toBe("degraded");
    expect(payload.checks.smtp.configured).toBe(false);
    expect(payload.checks.smtp.missingKeys).toContain("SMTP_USER");
  });

  it("returns down when database ping fails", async () => {
    mockedDb.$queryRaw.mockRejectedValue(new Error("db offline"));

    const response = await GET();
    const payload = (await response.json()) as {
      status: string;
      success: boolean;
      checks: {
        database: { status: string; detail: string };
      };
    };

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.status).toBe("down");
    expect(payload.checks.database.status).toBe("down");
    expect(payload.checks.database.detail).toContain("failed");
  });
});
