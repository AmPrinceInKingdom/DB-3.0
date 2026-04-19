import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/auth-service", () => ({
  resetPasswordWithToken: vi.fn(),
}));

vi.mock("@/lib/security/request-security", () => ({
  clearFailedVerificationAttempts: vi.fn(),
  enforceFailureLock: vi.fn(),
  enforceRateLimit: vi.fn(),
  enforceSameOriginMutation: vi.fn(),
  getRequestIp: vi.fn(),
  recordFailedVerificationAttempt: vi.fn(),
}));

import { POST } from "@/app/api/auth/reset-password/route";
import { resetPasswordWithToken } from "@/lib/auth/auth-service";
import {
  clearFailedVerificationAttempts,
  enforceFailureLock,
  enforceRateLimit,
  enforceSameOriginMutation,
  getRequestIp,
  recordFailedVerificationAttempt,
} from "@/lib/security/request-security";

const mockedResetPasswordWithToken = vi.mocked(resetPasswordWithToken);
const mockedClearFailedVerificationAttempts = vi.mocked(clearFailedVerificationAttempts);
const mockedEnforceFailureLock = vi.mocked(enforceFailureLock);
const mockedEnforceRateLimit = vi.mocked(enforceRateLimit);
const mockedEnforceSameOriginMutation = vi.mocked(enforceSameOriginMutation);
const mockedGetRequestIp = vi.mocked(getRequestIp);
const mockedRecordFailedVerificationAttempt = vi.mocked(recordFailedVerificationAttempt);

const validToken = "1234567890abcdef1234567890abcdef";
const validPassword = "StrongPass123";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildFailureIdentity(token: string, ip: string) {
  const tokenFingerprint = createHash("sha256").update(token).digest("hex").slice(0, 24);
  return `${tokenFingerprint}:${ip}`;
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnforceSameOriginMutation.mockReturnValue(null);
    mockedEnforceRateLimit.mockReturnValue(null);
    mockedEnforceFailureLock.mockReturnValue(null);
    mockedGetRequestIp.mockReturnValue("127.0.0.1");
  });

  it("blocks request when same-origin check fails", async () => {
    mockedEnforceSameOriginMutation.mockReturnValue(
      fail("Origin not allowed", 403, "ORIGIN_FORBIDDEN"),
    );

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );

    expect(response.status).toBe(403);
    expect(mockedResetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("blocks request when rate limit check fails", async () => {
    mockedEnforceRateLimit.mockReturnValue(
      fail("Too many requests", 429, "RATE_LIMITED"),
    );

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );

    expect(response.status).toBe(429);
    expect(mockedResetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("returns invalid input when payload is malformed", async () => {
    const response = await POST(
      makeRequest({
        token: "short-token",
        password: "weak",
        confirmPassword: "other",
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("INVALID_INPUT");
    expect(mockedEnforceFailureLock).not.toHaveBeenCalled();
    expect(mockedResetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("blocks request when reset failure lock is active", async () => {
    mockedEnforceFailureLock.mockReturnValue(
      fail("Too many invalid reset attempts", 429, "RESET_LOCKED"),
    );

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );
    const payload = (await response.json()) as { success: boolean; code?: string };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("RESET_LOCKED");
    expect(mockedResetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("resets password and clears failed reset attempts", async () => {
    mockedResetPasswordWithToken.mockResolvedValue({
      message: "Password has been reset successfully. You can now sign in.",
    } as never);

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      data?: { message?: string };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockedResetPasswordWithToken).toHaveBeenCalledWith({
      token: validToken,
      password: validPassword,
      confirmPassword: validPassword,
    });
    expect(mockedClearFailedVerificationAttempts).toHaveBeenCalledWith(
      "auth:reset-password-failure",
      buildFailureIdentity(validToken, "127.0.0.1"),
    );
  });

  it("tracks invalid reset token attempts with remaining attempts", async () => {
    mockedResetPasswordWithToken.mockRejectedValue(
      new AppError(
        "This password reset link is invalid or expired. Please request a new link.",
        400,
        "RESET_TOKEN_INVALID",
      ),
    );
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: false,
      remainingAttempts: 2,
    });

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("RESET_TOKEN_INVALID");
    expect(payload.error).toContain("2 attempts remaining");
    expect(mockedRecordFailedVerificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "auth:reset-password-failure",
        identity: buildFailureIdentity(validToken, "127.0.0.1"),
      }),
    );
  });

  it("locks reset flow after too many invalid reset token attempts", async () => {
    mockedResetPasswordWithToken.mockRejectedValue(
      new AppError(
        "This password reset link is invalid or expired. Please request a new link.",
        400,
        "RESET_TOKEN_INVALID",
      ),
    );
    mockedRecordFailedVerificationAttempt.mockReturnValue({
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: 900,
    });

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      error?: string;
      code?: string;
    };

    expect(response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("RESET_LOCKED");
    expect(payload.error).toBe("Too many invalid reset attempts. Please request a fresh reset link.");
  });

  it("returns app error when auth service throws non-token AppError", async () => {
    mockedResetPasswordWithToken.mockRejectedValue(
      new AppError("Account is not active.", 403, "ACCOUNT_NOT_ACTIVE"),
    );

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("ACCOUNT_NOT_ACTIVE");
    expect(payload.error).toBe("Account is not active.");
    expect(mockedRecordFailedVerificationAttempt).not.toHaveBeenCalled();
  });

  it("returns stable fallback error for unknown failures", async () => {
    mockedResetPasswordWithToken.mockRejectedValue(new Error("Unexpected"));

    const response = await POST(
      makeRequest({
        token: validToken,
        password: validPassword,
        confirmPassword: validPassword,
      }),
    );
    const payload = (await response.json()) as {
      success: boolean;
      code?: string;
      error?: string;
    };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("RESET_PASSWORD_FAILED");
    expect(payload.error).toBe("Unable to reset password");
  });
});
