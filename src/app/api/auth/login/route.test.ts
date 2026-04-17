import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  loginUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
}));

import { POST } from "@/app/api/auth/login/route";
import { loginUser } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";

const mockedLoginUser = vi.mocked(loginUser);
const mockedSetSessionCookie = vi.mocked(setSessionCookie);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnforceSameOriginMutation.mockReturnValue(null);
    mockedEnforceRateLimit.mockReturnValue(null);
  });

  it("blocks request when same-origin check fails", async () => {
    mockedEnforceSameOriginMutation.mockReturnValue(fail("Origin not allowed", 403, "ORIGIN_FORBIDDEN"));

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );

    expect(response.status).toBe(403);
    expect(mockedEnforceRateLimit).not.toHaveBeenCalled();
    expect(mockedLoginUser).not.toHaveBeenCalled();
  });

  it("blocks request when rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(fail("Too many requests", 429, "RATE_LIMITED"));

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );

    expect(response.status).toBe(429);
    expect(mockedLoginUser).not.toHaveBeenCalled();
  });

  it("logs in user and sets session cookie", async () => {
    mockedLoginUser.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "CUSTOMER",
      },
      token: "session-token",
    } as never);

    const response = await POST(
      makeRequest({
        email: "USER@EXAMPLE.COM",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      data?: { email: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.email).toBe("user@example.com");
    expect(mockedLoginUser).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "StrongPass123",
    });
    expect(mockedSetSessionCookie).toHaveBeenCalledTimes(1);
    expect(mockedSetSessionCookie).toHaveBeenCalledWith(expect.any(Response), "session-token");
  });

  it("returns app error when auth service throws AppError", async () => {
    mockedLoginUser.mockRejectedValue(
      new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS"),
    );

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Invalid credentials");
    expect(payload.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns stable fallback error for unknown failures", async () => {
    mockedLoginUser.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Unable to sign in");
    expect(payload.code).toBe("LOGIN_FAILED");
  });

  it("returns service-unavailable error when JWT secret is misconfigured", async () => {
    mockedLoginUser.mockRejectedValue(new Error("JWT_SECRET is missing or too short"));

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("AUTH_CONFIG_ERROR");
  });

  it("returns service-unavailable error when database connectivity fails", async () => {
    mockedLoginUser.mockRejectedValue(
      new Error("Prisma: Can't reach database server at db.example.supabase.co:5432"),
    );

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("AUTH_DB_UNAVAILABLE");
  });
});
