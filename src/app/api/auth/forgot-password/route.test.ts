import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
}));

import { POST } from "@/app/api/auth/forgot-password/route";
import { requestPasswordReset } from "@/lib/auth/auth-service";
import { enforceRateLimit, enforceSameOriginMutation } from "@/lib/security/request-security";

const mockedRequestPasswordReset = vi.mocked(requestPasswordReset);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnforceSameOriginMutation.mockReturnValue(null);
    mockedEnforceRateLimit.mockReturnValue(null);
  });

  it("blocks request when same-origin check fails", async () => {
    mockedEnforceSameOriginMutation.mockReturnValue(
      fail("Origin not allowed", 403, "ORIGIN_FORBIDDEN"),
    );

    const response = await POST(makeRequest({ email: "user@example.com" }));

    expect(response.status).toBe(403);
    expect(mockedEnforceRateLimit).not.toHaveBeenCalled();
    expect(mockedRequestPasswordReset).not.toHaveBeenCalled();
  });

  it("blocks request when IP rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(
      fail("Too many requests", 429, "RATE_LIMITED"),
    );

    const response = await POST(makeRequest({ email: "user@example.com" }));

    expect(response.status).toBe(429);
    expect(mockedRequestPasswordReset).not.toHaveBeenCalled();
  });

  it("returns invalid input when email payload is malformed", async () => {
    const response = await POST(makeRequest({ email: "not-an-email" }));
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("INVALID_INPUT");
    expect(mockedRequestPasswordReset).not.toHaveBeenCalled();
  });

  it("blocks request when email-specific rate limit check fails", async () => {
    mockedEnforceRateLimit
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(fail("Too many email reset requests", 429, "RATE_LIMITED"));

    const response = await POST(makeRequest({ email: "USER@EXAMPLE.COM" }));

    expect(response.status).toBe(429);
    expect(mockedRequestPasswordReset).not.toHaveBeenCalled();
    expect(mockedEnforceRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.any(Request),
      expect.objectContaining({
        scope: "auth:forgot-password-email",
        keyPart: "user@example.com",
      }),
    );
  });

  it("requests password reset with normalized email", async () => {
    mockedRequestPasswordReset.mockResolvedValue({
      message: "If your email exists in our system, a password reset link has been sent.",
    } as never);

    const response = await POST(makeRequest({ email: "USER@EXAMPLE.COM" }));
    const payload = (await response.json()) as {
      success: boolean;
      data?: {
        message?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockedRequestPasswordReset).toHaveBeenCalledWith(
      { email: "user@example.com" },
      expect.objectContaining({
        appUrl: expect.stringContaining("http://localhost"),
        includeDebugToken: true,
      }),
    );
    expect(payload.data?.message).toBe(
      "If your email exists in our system, a password reset link has been sent.",
    );
  });

  it("returns app error when auth service throws AppError", async () => {
    mockedRequestPasswordReset.mockRejectedValue(
      new AppError("Reset service unavailable", 503, "RESET_SERVICE_UNAVAILABLE"),
    );

    const response = await POST(makeRequest({ email: "user@example.com" }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Reset service unavailable");
    expect(payload.code).toBe("RESET_SERVICE_UNAVAILABLE");
  });

  it("returns stable fallback error for unknown failures", async () => {
    mockedRequestPasswordReset.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(makeRequest({ email: "user@example.com" }));
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Unable to process password reset request");
    expect(payload.code).toBe("FORGOT_PASSWORD_FAILED");
  });
});
