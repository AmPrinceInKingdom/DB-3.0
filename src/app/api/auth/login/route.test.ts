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
  clearFailedVerificationAttempts: vi.fn(),
  enforceFailureLock: vi.fn(),
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
  getRequestIp: vi.fn(),
  recordFailedVerificationAttempt: vi.fn(),
}));

import { POST } from "@/app/api/auth/login/route";
import { loginUser } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/session";
import {
  clearFailedVerificationAttempts,
  enforceFailureLock,
  enforceRateLimit,
  enforceSameOriginMutation,
  getRequestIp,
  recordFailedVerificationAttempt,
} from "@/lib/security/request-security";

const mockedLoginUser = vi.mocked(loginUser);
const mockedSetSessionCookie = vi.mocked(setSessionCookie);
const mockedClearFailedVerificationAttempts = vi.mocked(clearFailedVerificationAttempts);
const mockedEnforceFailureLock = vi.mocked(enforceFailureLock);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);
const mockedGetRequestIp = vi.mocked(getRequestIp);
const mockedRecordFailedVerificationAttempt = vi.mocked(recordFailedVerificationAttempt);

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
    mockedEnforceFailureLock.mockReturnValue(null);
    mockedGetRequestIp.mockReturnValue("127.0.0.1");
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

  it("blocks request when login failure lock is active", async () => {
    mockedEnforceFailureLock.mockReturnValue(
      fail("Too many invalid sign-in attempts", 429, "LOGIN_LOCKED"),
    );

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as { success: boolean; code?: string };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("LOGIN_LOCKED");
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
    expect(mockedClearFailedVerificationAttempts).toHaveBeenCalledWith(
      "auth:login-failure",
      "user@example.com:127.0.0.1",
    );
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
    expect(mockedRecordFailedVerificationAttempt).not.toHaveBeenCalled();
  });

  it("records failed attempt when auth service returns unauthorized", async () => {
    mockedLoginUser.mockRejectedValue(new AppError("Invalid email or password", 401, "UNAUTHORIZED"));
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: false,
      remainingAttempts: 7,
    });

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("UNAUTHORIZED");
    expect(mockedRecordFailedVerificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "auth:login-failure",
        identity: "user@example.com:127.0.0.1",
      }),
    );
  });

  it("returns login locked when unauthorized attempts hit lock threshold", async () => {
    mockedLoginUser.mockRejectedValue(new AppError("Invalid email or password", 401, "UNAUTHORIZED"));
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: true,
      retryAfterSeconds: 600,
      remainingAttempts: 0,
    });

    const response = await POST(
      makeRequest({
        email: "user@example.com",
        password: "StrongPass123",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("LOGIN_LOCKED");
    expect(payload.error).toBe("Too many invalid sign-in attempts. Please try again in a few minutes.");
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

  it("returns schema-missing error when users table is unavailable", async () => {
    mockedLoginUser.mockRejectedValue(new Error("The table `public.users` does not exist in the current database."));

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
    expect(payload.code).toBe("AUTH_SCHEMA_MISSING");
  });

  it("returns credentials-invalid error when database credentials are wrong", async () => {
    mockedLoginUser.mockRejectedValue(
      new Error("P1000: Authentication failed against database server"),
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
    expect(payload.code).toBe("AUTH_DB_CREDENTIALS_INVALID");
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
